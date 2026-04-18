/**
 * Conflict Resolver
 * 
 * Rules:
 * - Vouchers: Confirmed > Draft (auto). Confirmed vs Confirmed → manual only.
 * - Master data: Last-write-wins, store overwritten in _conflicts for audit.
 * - Deletes: Remote delete + local edit → conflict. Both deleted → auto-resolve.
 */

import { db } from '../db/dexie';
import type { Conflict } from '../lib/types';

export type ResolutionChoice = 'local' | 'remote';

/**
 * Get all unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<Conflict[]> {
  return db._conflicts.where('resolved').equals(0).toArray();
}

/**
 * Get conflict count
 */
export async function getConflictCount(): Promise<number> {
  return db._conflicts.where('resolved').equals(0).count();
}

/**
 * Auto-resolve conflicts where possible
 * Returns the number of auto-resolved conflicts
 */
export async function autoResolveConflicts(): Promise<number> {
  const unresolved = await getUnresolvedConflicts();
  let resolved = 0;

  for (const conflict of unresolved) {
    const local = JSON.parse(conflict.localVersion);
    const remote = JSON.parse(conflict.remoteVersion);

    // Rule: Both deleted → auto-resolve (keep tombstone)
    if (local.deletedAt && remote.deletedAt) {
      await resolveConflict(conflict.id!, 'remote');
      resolved++;
      continue;
    }

    // Rule: Vouchers — confirmed > draft
    if (conflict.entityType === 'voucher') {
      if (remote.status === 'confirmed' && local.status === 'draft') {
        await resolveConflict(conflict.id!, 'remote');
        resolved++;
        continue;
      }
      if (local.status === 'confirmed' && remote.status === 'draft') {
        await resolveConflict(conflict.id!, 'local');
        resolved++;
        continue;
      }
      // Confirmed vs Confirmed → NO auto-resolve (manual only)
      continue;
    }

    // Rule: Master data (party, item, company) → last-write-wins
    if (['party', 'item', 'company'].includes(conflict.entityType)) {
      const localTime = local.updatedAt || 0;
      const remoteTime = remote.updatedAt || 0;

      if (remoteTime >= localTime) {
        await resolveConflict(conflict.id!, 'remote');
      } else {
        await resolveConflict(conflict.id!, 'local');
      }
      resolved++;
      continue;
    }
  }

  return resolved;
}

/**
 * Resolve a specific conflict
 */
export async function resolveConflict(
  conflictId: number,
  choice: ResolutionChoice
): Promise<void> {
  const conflict = await db._conflicts.get(conflictId);
  if (!conflict) return;

  const chosenVersion = choice === 'local'
    ? JSON.parse(conflict.localVersion)
    : JSON.parse(conflict.remoteVersion);

  // Get the appropriate Dexie table
  const tableMap: Record<string, string> = {
    company: 'companies',
    party: 'parties',
    item: 'items',
    voucher: 'vouchers',
    voucher_item: 'voucherItems',
  };

  const tableName = tableMap[conflict.entityType];
  if (tableName) {
    const table = (db as any)[tableName];
    await table.put(chosenVersion);
  }

  // If user chose local, we need to re-queue a push
  if (choice === 'local') {
    await db._syncQueue.add({
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      operation: 'update',
      payload: JSON.stringify(chosenVersion),
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
  } else {
    // Remote chosen — remove any pending queue entries for this entity
    const pendingEntries = await db._syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .toArray();
    const ids = pendingEntries.map((e) => e.id!).filter(Boolean);
    if (ids.length > 0) {
      await db._syncQueue.bulkDelete(ids);
    }
  }

  // Mark conflict as resolved
  await db._conflicts.update(conflictId, {
    resolved: 1,
    resolution: choice,
    resolvedAt: Date.now(),
  });
}

/**
 * Dismiss all resolved conflicts older than N days
 */
export async function cleanupResolvedConflicts(daysOld = 30): Promise<number> {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const old = await db._conflicts
    .where('resolved')
    .equals(1)
    .and((c) => (c.resolvedAt || 0) < cutoff)
    .toArray();
  const ids = old.map((c) => c.id!).filter(Boolean);
  await db._conflicts.bulkDelete(ids);
  return ids.length;
}
