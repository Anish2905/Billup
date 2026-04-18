/**
 * Dexie (IndexedDB) database definition
 * This is the SOURCE OF TRUTH — the UI reads and writes only here.
 */

import Dexie, { type EntityTable } from 'dexie';
import type {
  Company, Party, Item, Voucher, VoucherItem,
  SyncLog, SyncQueueEntry, Conflict,
} from '../lib/types';

class MaestroDB extends Dexie {
  companies!: EntityTable<Company, 'id'>;
  parties!: EntityTable<Party, 'id'>;
  items!: EntityTable<Item, 'id'>;
  vouchers!: EntityTable<Voucher, 'id'>;
  voucherItems!: EntityTable<VoucherItem, 'id'>;
  syncLog!: EntityTable<SyncLog, 'id'>;
  _syncQueue!: EntityTable<SyncQueueEntry, 'id'>;
  _conflicts!: EntityTable<Conflict, 'id'>;

  constructor() {
    super('MaestroDB');

    this.version(1).stores({
      // Core tables (mirroring Turso)
      companies: 'id, name, gstin, stateCode, updatedAt, deletedAt',
      parties: 'id, name, gstin, stateCode, partyType, updatedAt, deletedAt',
      items: 'id, name, hsnCode, gstRate, updatedAt, deletedAt',
      vouchers: 'id, voucherNumber, voucherType, partyId, companyId, voucherDate, status, updatedAt, deletedAt',
      voucherItems: 'id, voucherId, itemId, sortOrder, updatedAt, deletedAt',
      syncLog: 'id, entityType, entityId, direction, status, syncedAt',

      // Local-only tables
      _syncQueue: '++id, entityType, entityId, operation, status, createdAt, retryCount',
      _conflicts: '++id, entityType, entityId, conflictType, resolved, createdAt',
    });
  }
}

export const db = new MaestroDB();

// ─── Helper: Write with sync queue ──────────────────
/**
 * Wrapper that writes to a Dexie table AND enqueues a sync operation atomically
 */
export async function writeWithSync<T extends { id: string }>(
  table: EntityTable<T, 'id'>,
  operation: 'create' | 'update' | 'delete',
  record: T,
  entityType: string,
): Promise<void> {
  await db.transaction('rw', [table, db._syncQueue], async () => {
    if (operation === 'create' || operation === 'update') {
      await table.put(record);
    } else if (operation === 'delete') {
      // Soft delete: update the record with deletedAt
      await table.put(record);
    }

    await db._syncQueue.add({
      entityType: entityType as any,
      entityId: record.id,
      operation,
      payload: JSON.stringify(record),
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
  });
}

// ─── Helper: Get active records (not soft-deleted) ──
export async function getActive<T extends { deletedAt: number | null }>(
  table: EntityTable<T, any>,
): Promise<T[]> {
  return table.filter((r) => r.deletedAt === null || r.deletedAt === undefined).toArray();
}
