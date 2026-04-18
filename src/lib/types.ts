/**
 * Core type definitions for the Maestro billing system
 * These types are used across Dexie (IndexedDB) and Drizzle (Turso)
 */

import type { VoucherType, VoucherStatus, PartyType, SyncOperation, EntityType } from './constants';

// ─── Company ────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  address: string;
  gstin: string;
  stateCode: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  logoBase64: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Party ──────────────────────────────────────────
export interface Party {
  id: string;
  name: string;
  gstin: string | null;
  address: string;
  stateCode: string;
  phone: string;
  email: string;
  balance: number;
  partyType: PartyType;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Item ───────────────────────────────────────────
export interface Item {
  id: string;
  name: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  defaultPrice: number;
  description: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Voucher ────────────────────────────────────────
export interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: VoucherType;
  partyId: string;
  companyId: string;
  voucherDate: number;
  dueDate: number | null;
  placeOfSupply: string;
  isInterState: number; // 0 or 1 (boolean stored as int for SQLite compat)
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  discountAmount: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  notes: string;
  terms: string;
  status: VoucherStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Voucher Item ───────────────────────────────────
export interface VoucherItem {
  id: string;
  voucherId: string;
  itemId: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Sync Log ───────────────────────────────────────
export interface SyncLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  direction: 'push' | 'pull';
  status: 'success' | 'failed';
  errorMessage: string | null;
  syncedAt: number;
}

// ─── Sync Queue (IndexedDB only) ────────────────────
export interface SyncQueueEntry {
  id?: number; // auto-increment
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string; // JSON-serialized record
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'in_progress' | 'failed';
}

// ─── Conflicts (IndexedDB only) ─────────────────────
export interface Conflict {
  id?: number; // auto-increment
  entityType: EntityType;
  entityId: string;
  localVersion: string; // JSON
  remoteVersion: string; // JSON
  conflictType: 'update_update' | 'delete_update' | 'update_delete';
  resolved: number; // 0 or 1
  resolution: 'local' | 'remote' | null;
  createdAt: number;
  resolvedAt: number | null;
}

// ─── Form / UI types ────────────────────────────────
export interface VoucherItemFormRow {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface VoucherFormData {
  id: string;
  voucherNumber: string;
  voucherType: VoucherType;
  partyId: string;
  partyName: string;
  companyId: string;
  voucherDate: string; // ISO date string for form input
  dueDate: string;
  placeOfSupply: string;
  notes: string;
  terms: string;
  status: VoucherStatus;
  items: VoucherItemFormRow[];
}
