/**
 * Sync Queue Manager
 * Handles enqueueing operations for later push to Turso.
 * All writes go through writeWithSync() in dexie.ts which calls this internally.
 */

import { db } from '../db/dexie';
import type { SyncQueueEntry } from '../lib/types';
import type { EntityType, SyncOperation } from '../lib/constants';

/**
 * Get all pending items from the sync queue, ordered by creation time
 */
export async function getPendingQueue(limit = 50): Promise<SyncQueueEntry[]> {
  return db._syncQueue
    .where('status')
    .equals('pending')
    .sortBy('createdAt')
    .then((items) => items.slice(0, limit));
}

/**
 * Get count of pending sync operations
 */
export async function getPendingCount(): Promise<number> {
  return db._syncQueue.where('status').anyOf(['pending', 'in_progress']).count();
}

/**
 * Get count of failed sync operations
 */
export async function getFailedCount(): Promise<number> {
  return db._syncQueue.where('status').equals('failed').count();
}

/**
 * Mark a queue entry as in-progress
 */
export async function markInProgress(id: number): Promise<void> {
  await db._syncQueue.update(id, { status: 'in_progress' });
}

/**
 * Mark a queue entry as completed (remove from queue)
 */
export async function markCompleted(id: number): Promise<void> {
  await db._syncQueue.delete(id);
}

/**
 * Mark a queue entry as failed, incrementing retry count
 */
export async function markFailed(id: number, maxRetries = 5): Promise<void> {
  const entry = await db._syncQueue.get(id);
  if (!entry) return;

  const newRetryCount = (entry.retryCount || 0) + 1;
  if (newRetryCount >= maxRetries) {
    await db._syncQueue.update(id, {
      status: 'failed',
      retryCount: newRetryCount,
    });
  } else {
    await db._syncQueue.update(id, {
      status: 'pending',
      retryCount: newRetryCount,
    });
  }
}

/**
 * Clear all failed entries from the queue
 */
export async function clearFailedQueue(): Promise<number> {
  const failed = await db._syncQueue.where('status').equals('failed').toArray();
  const ids = failed.map((e) => e.id!).filter(Boolean);
  await db._syncQueue.bulkDelete(ids);
  return ids.length;
}

/**
 * Retry all failed entries by resetting status to pending
 */
export async function retryFailed(): Promise<number> {
  const failed = await db._syncQueue.where('status').equals('failed').toArray();
  const ids = failed.map((e) => e.id!).filter(Boolean);
  for (const id of ids) {
    await db._syncQueue.update(id, { status: 'pending', retryCount: 0 });
  }
  return ids.length;
}

/**
 * Check if an entity has pending sync operations
 */
export async function hasPendingSync(entityType: EntityType, entityId: string): Promise<boolean> {
  const count = await db._syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .count();
  return count > 0;
}
