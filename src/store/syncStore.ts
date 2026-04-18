/**
 * Sync Store (Zustand)
 * Reactive state for sync engine — drives UI badges and panels
 */

import { create } from 'zustand';
import { syncEngine, type SyncState, type SyncStatus } from '../sync/syncEngine';

interface SyncStoreState extends SyncState {
  init: () => void;
  forcePush: () => Promise<void>;
  forcePull: () => Promise<void>;
  clearFailed: () => Promise<number>;
  retryFailed: () => Promise<number>;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle' as SyncStatus,
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isLeader: false,
  lastError: null,

  init: () => {
    syncEngine.subscribe((state) => {
      set(state);
    });
    syncEngine.start();
  },

  forcePush: async () => {
    await syncEngine.forcePush();
  },

  forcePull: async () => {
    await syncEngine.forcePull();
  },

  clearFailed: async () => {
    return syncEngine.clearFailed();
  },

  retryFailed: async () => {
    return syncEngine.retryAllFailed();
  },
}));
