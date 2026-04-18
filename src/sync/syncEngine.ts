/**
 * Sync Engine Orchestrator
 * - Runs push → pull → conflict auto-resolve cycle
 * - Triggers every SYNC_INTERVAL (30s) or on reconnect
 * - Leader election prevents multi-tab races
 */

import { pushToTurso } from './pushWorker';
import { pullFromTurso, forceFullPull } from './pullWorker';
import { autoResolveConflicts, getConflictCount } from './conflictResolver';
import { getPendingCount, getFailedCount, clearFailedQueue, retryFailed } from './queueManager';
import { isTursoConfigured } from '../db/turso';
import { SYNC_INTERVAL } from '../lib/constants';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  isOnline: boolean;
  isLeader: boolean;
  lastError: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private listeners: Set<SyncListener> = new Set();
  private _state: SyncState = {
    status: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    isOnline: navigator.onLine,
    isLeader: false,
    lastError: null,
  };
  private channel: BroadcastChannel | null = null;
  private leaderHeartbeat: ReturnType<typeof setInterval> | null = null;

  get state(): SyncState {
    return { ...this._state };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.state;
    this.listeners.forEach((l) => l(snapshot));
  }

  private updateState(partial: Partial<SyncState>): void {
    Object.assign(this._state, partial);
    this.notify();
  }

  /**
   * Start the sync engine
   */
  start(): void {
    if (this.intervalId) return;

    // Check if Turso is configured
    if (!isTursoConfigured()) {
      this.updateState({ status: 'disabled' });
      console.info('[Sync] Turso not configured — running offline only');
      this.startCountUpdater();
      return;
    }

    // Leader election via BroadcastChannel
    this.electLeader();

    // Online/offline listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Start sync interval
    this.intervalId = setInterval(() => this.runCycle(), SYNC_INTERVAL);

    // Initial sync
    this.updateState({ isOnline: navigator.onLine });
    if (navigator.onLine) {
      setTimeout(() => this.runCycle(), 1000);
    }

    this.startCountUpdater();
  }

  /**
   * Stop the sync engine
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.leaderHeartbeat) {
      clearInterval(this.leaderHeartbeat);
      this.leaderHeartbeat = null;
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.channel?.close();
    this.channel = null;
  }

  private handleOnline = (): void => {
    this.updateState({ isOnline: true, status: 'idle' });
    // Immediate sync on reconnect
    this.runCycle();
  };

  private handleOffline = (): void => {
    this.updateState({ isOnline: false, status: 'offline' });
  };

  /**
   * Leader election using BroadcastChannel
   * Only the leader tab runs actual sync operations
   */
  private electLeader(): void {
    try {
      this.channel = new BroadcastChannel('maestro_sync_leader');
      
      // Try to claim leadership
      this.updateState({ isLeader: true });
      this.channel.postMessage({ type: 'leader_claim', ts: Date.now() });

      this.channel.onmessage = (event) => {
        if (event.data.type === 'leader_claim' && !this._state.isLeader) {
          // Another tab claimed leadership
          this.updateState({ isLeader: false });
        }
      };

      // Heartbeat
      this.leaderHeartbeat = setInterval(() => {
        if (this._state.isLeader) {
          this.channel?.postMessage({ type: 'leader_heartbeat', ts: Date.now() });
        }
      }, 10_000);
    } catch {
      // BroadcastChannel not supported — default to leader
      this.updateState({ isLeader: true });
    }
  }

  /**
   * Run a full sync cycle: push → pull → auto-resolve
   */
  async runCycle(): Promise<void> {
    if (this.isRunning) return;
    if (!this._state.isOnline) {
      this.updateState({ status: 'offline' });
      return;
    }
    if (!this._state.isLeader) return;

    this.isRunning = true;
    this.updateState({ status: 'syncing', lastError: null });

    try {
      // 1. Push local changes
      const pushResult = await pushToTurso();

      // 2. Pull remote changes
      const pullResult = await pullFromTurso();

      // 3. Auto-resolve conflicts
      await autoResolveConflicts();

      // 4. Update counts
      const [pendingCount, failedCount, conflictCount] = await Promise.all([
        getPendingCount(),
        getFailedCount(),
        getConflictCount(),
      ]);

      const hasErrors = pushResult.failed > 0 || pullResult.errors.length > 0;
      this.updateState({
        status: hasErrors ? 'error' : 'idle',
        lastSyncAt: Date.now(),
        pendingCount,
        failedCount,
        conflictCount,
        lastError: hasErrors
          ? `Push: ${pushResult.failed} failed. ${pullResult.errors.join('; ')}`
          : null,
      });
    } catch (err: any) {
      console.error('[Sync] Cycle failed:', err);
      this.updateState({
        status: 'error',
        lastError: err?.message || String(err),
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force push all pending
   */
  async forcePush(): Promise<void> {
    await this.runCycle();
  }

  /**
   * Force pull everything from remote
   */
  async forcePull(): Promise<void> {
    if (!this._state.isOnline) return;
    this.updateState({ status: 'syncing' });
    try {
      await forceFullPull();
      await autoResolveConflicts();
      await this.refreshCounts();
      this.updateState({ status: 'idle', lastSyncAt: Date.now() });
    } catch (err: any) {
      this.updateState({ status: 'error', lastError: err?.message });
    }
  }

  /**
   * Clear failed queue
   */
  async clearFailed(): Promise<number> {
    const cleared = await clearFailedQueue();
    await this.refreshCounts();
    return cleared;
  }

  /**
   * Retry failed items
   */
  async retryAllFailed(): Promise<number> {
    const retried = await retryFailed();
    await this.refreshCounts();
    return retried;
  }

  private async refreshCounts(): Promise<void> {
    const [pendingCount, failedCount, conflictCount] = await Promise.all([
      getPendingCount(),
      getFailedCount(),
      getConflictCount(),
    ]);
    this.updateState({ pendingCount, failedCount, conflictCount });
  }

  /**
   * Periodically update counts even when not syncing (for UI reactivity)
   */
  private startCountUpdater(): void {
    setInterval(() => this.refreshCounts(), 5000);
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
