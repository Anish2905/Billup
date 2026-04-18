/**
 * Pull Worker
 * Fetches records from Turso that have been updated since the last pull.
 * Inserts/updates into IndexedDB, detects conflicts.
 */

import { executeTursoQuery } from '../db/turso';
import { db } from '../db/dexie';
import { generateId, now } from '../lib/uuid';
import type { EntityType } from '../lib/constants';

const LAST_PULL_KEY = 'maestro_last_pull';

function getLastPullTimestamp(): number {
  const stored = localStorage.getItem(LAST_PULL_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

function setLastPullTimestamp(ts: number): void {
  localStorage.setItem(LAST_PULL_KEY, String(ts));
}

// Map Turso snake_case rows to Dexie camelCase
function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

interface PullResult {
  pulled: number;
  conflicts: number;
  errors: string[];
}

const TABLES_TO_PULL: Array<{ tursoTable: string; entityType: EntityType; dexieTable: string }> = [
  { tursoTable: 'companies', entityType: 'company', dexieTable: 'companies' },
  { tursoTable: 'parties', entityType: 'party', dexieTable: 'parties' },
  { tursoTable: 'items', entityType: 'item', dexieTable: 'items' },
  { tursoTable: 'vouchers', entityType: 'voucher', dexieTable: 'vouchers' },
  { tursoTable: 'voucher_items', entityType: 'voucher_item', dexieTable: 'voucherItems' },
];

/**
 * Pull all updated records from Turso since last sync
 */
export async function pullFromTurso(): Promise<PullResult> {
  const since = getLastPullTimestamp();
  const pullTime = now();
  let totalPulled = 0;
  let totalConflicts = 0;
  const errors: string[] = [];

  for (const { tursoTable, entityType, dexieTable } of TABLES_TO_PULL) {
    try {
      const result = await executeTursoQuery(
        `SELECT * FROM ${tursoTable} WHERE updated_at > ?`,
        [since]
      );

      if (!result.rows || result.rows.length === 0) continue;

      const dexieTbl = (db as any)[dexieTable];

      for (const row of result.rows) {
        const record = snakeToCamel(row as Record<string, any>);
        const localRecord = await dexieTbl.get(record.id);

        if (!localRecord) {
          // No local version — just insert
          await dexieTbl.put(record);
          totalPulled++;
        } else {
          // Check if local record has pending changes in sync queue
          const pendingCount = await db._syncQueue
            .where('entityId')
            .equals(record.id)
            .and((e: any) => e.status === 'pending' || e.status === 'in_progress')
            .count();

          if (pendingCount > 0) {
            // CONFLICT: local has pending changes AND remote has updates
            await db._conflicts.add({
              entityType,
              entityId: record.id as string,
              localVersion: JSON.stringify(localRecord),
              remoteVersion: JSON.stringify(record),
              conflictType: record.deletedAt ? 'delete_update' : 'update_update',
              resolved: 0,
              resolution: null,
              createdAt: pullTime,
              resolvedAt: null,
            });
            totalConflicts++;
          } else {
            // No pending local changes — safe to overwrite
            await dexieTbl.put(record);
            totalPulled++;
          }
        }
      }

      // Log sync
      await db.syncLog.add({
        id: generateId(),
        entityType,
        entityId: '*',
        operation: 'update',
        direction: 'pull',
        status: 'success',
        errorMessage: null,
        syncedAt: pullTime,
      });

    } catch (err: any) {
      const msg = `[Pull] Failed for ${tursoTable}: ${err?.message || err}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  setLastPullTimestamp(pullTime);

  return {
    pulled: totalPulled,
    conflicts: totalConflicts,
    errors,
  };
}

/**
 * Force a full pull (ignore last timestamp)
 */
export async function forceFullPull(): Promise<PullResult> {
  localStorage.setItem(LAST_PULL_KEY, '0');
  return pullFromTurso();
}
