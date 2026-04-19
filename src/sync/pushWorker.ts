/**
 * Push Worker
 * Reads pending items from _syncQueue and pushes them to Turso.
 */

import { getPendingQueue, markInProgress, markCompleted, markFailed } from './queueManager';
import { executeTursoQuery } from '../db/turso';
import { db } from '../db/dexie';
import { generateId, now } from '../lib/uuid';


// Column mapping: camelCase (Dexie) → snake_case (Turso)
const COLUMN_MAPS: Record<string, Record<string, string>> = {
  company: {
    stateCode: 'state_code', bankName: 'bank_name', bankAccount: 'bank_account',
    bankIfsc: 'bank_ifsc', logoBase64: 'logo_base64', invoicePrefix: 'invoice_prefix',
    invoiceNextNumber: 'invoice_next_number', createdAt: 'created_at',
    updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  party: {
    stateCode: 'state_code', partyType: 'party_type',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  item: {
    hsnCode: 'hsn_code', gstRate: 'gst_rate', defaultPrice: 'default_price',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  voucher: {
    voucherNumber: 'voucher_number', voucherType: 'voucher_type', partyId: 'party_id',
    companyId: 'company_id', voucherDate: 'voucher_date', dueDate: 'due_date',
    placeOfSupply: 'place_of_supply', isInterState: 'is_inter_state',
    totalCgst: 'total_cgst', totalSgst: 'total_sgst', totalIgst: 'total_igst',
    totalTax: 'total_tax', discountAmount: 'discount_amount', roundOff: 'round_off',
    grandTotal: 'grand_total', amountInWords: 'amount_in_words',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  voucher_item: {
    voucherId: 'voucher_id', itemId: 'item_id', hsnCode: 'hsn_code',
    discountPercent: 'discount_percent', taxableAmount: 'taxable_amount',
    gstRate: 'gst_rate', cgstAmount: 'cgst_amount', sgstAmount: 'sgst_amount',
    igstAmount: 'igst_amount', totalAmount: 'total_amount', sortOrder: 'sort_order',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
};

const TABLE_NAMES: Record<string, string> = {
  company: 'companies',
  party: 'parties',
  item: 'items',
  voucher: 'vouchers',
  voucher_item: 'voucher_items',
};

function toSnakeCase(entityType: string, obj: Record<string, any>): Record<string, any> {
  const map = COLUMN_MAPS[entityType] || {};
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = map[key] || key;
    result[snakeKey] = value;
  }
  return result;
}

function buildUpsertSQL(tableName: string, data: Record<string, any>): { sql: string; args: any[] } {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?');
  const args = Object.values(data);

  // Use INSERT OR REPLACE for upsert behavior  
  const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  return { sql, args };
}

function buildDeleteSQL(tableName: string, id: string, deletedAt: number): { sql: string; args: any[] } {
  return {
    sql: `UPDATE ${tableName} SET deleted_at = ? WHERE id = ?`,
    args: [deletedAt, id],
  };
}

/**
 * Push pending sync operations to Turso
 * Returns: { pushed: number, failed: number }
 */
export async function pushToTurso(): Promise<{ pushed: number; failed: number }> {
  const pending = await getPendingQueue(50);
  if (pending.length === 0) return { pushed: 0, failed: 0 };

  let pushed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await markInProgress(entry.id!);

      const tableName = TABLE_NAMES[entry.entityType];
      if (!tableName) {
        console.warn(`[Push] Unknown entity type: ${entry.entityType}`);
        await markFailed(entry.id!);
        failed++;
        continue;
      }

      const payload = JSON.parse(entry.payload);
      const snakePayload = toSnakeCase(entry.entityType, payload);

      let query: { sql: string; args: any[] };

      if (entry.operation === 'delete') {
        query = buildDeleteSQL(tableName, payload.id, payload.deletedAt || Date.now());
      } else {
        query = buildUpsertSQL(tableName, snakePayload);
      }

      await executeTursoQuery(query.sql, query.args);
      await markCompleted(entry.id!);

      // Log success
      await db.syncLog.add({
        id: generateId(),
        entityType: entry.entityType,
        entityId: entry.entityId,
        operation: entry.operation,
        direction: 'push',
        status: 'success',
        errorMessage: null,
        syncedAt: now(),
      });

      pushed++;
    } catch (err: any) {
      console.error(`[Push] Failed for ${entry.entityType}/${entry.entityId}:`, err);
      await markFailed(entry.id!);

      await db.syncLog.add({
        id: generateId(),
        entityType: entry.entityType,
        entityId: entry.entityId,
        operation: entry.operation,
        direction: 'push',
        status: 'failed',
        errorMessage: err?.message || String(err),
        syncedAt: now(),
      });

      failed++;
    }
  }

  return { pushed, failed };
}
