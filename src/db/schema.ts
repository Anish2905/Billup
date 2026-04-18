/**
 * Drizzle ORM schema for Turso (LibSQL)
 * This defines the remote database structure.
 * Dexie mirrors this schema locally.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').default(''),
  gstin: text('gstin').default(''),
  stateCode: text('state_code').default(''),
  phone: text('phone').default(''),
  email: text('email').default(''),
  bankName: text('bank_name').default(''),
  bankAccount: text('bank_account').default(''),
  bankIfsc: text('bank_ifsc').default(''),
  logoBase64: text('logo_base64').default(''),
  invoicePrefix: text('invoice_prefix').default('INV'),
  invoiceNextNumber: integer('invoice_next_number').default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const parties = sqliteTable('parties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gstin: text('gstin'),
  address: text('address').default(''),
  stateCode: text('state_code').default(''),
  phone: text('phone').default(''),
  email: text('email').default(''),
  balance: real('balance').default(0),
  partyType: text('party_type').default('customer'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hsnCode: text('hsn_code').default(''),
  unit: text('unit').default('NOS'),
  gstRate: real('gst_rate').default(18),
  defaultPrice: real('default_price').default(0),
  description: text('description').default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey(),
  voucherNumber: text('voucher_number').unique().notNull(),
  voucherType: text('voucher_type').default('invoice'),
  partyId: text('party_id').notNull(),
  companyId: text('company_id').notNull(),
  voucherDate: integer('voucher_date').notNull(),
  dueDate: integer('due_date'),
  placeOfSupply: text('place_of_supply').default(''),
  isInterState: integer('is_inter_state').default(0),
  subtotal: real('subtotal').default(0),
  totalCgst: real('total_cgst').default(0),
  totalSgst: real('total_sgst').default(0),
  totalIgst: real('total_igst').default(0),
  totalTax: real('total_tax').default(0),
  discountAmount: real('discount_amount').default(0),
  roundOff: real('round_off').default(0),
  grandTotal: real('grand_total').default(0),
  amountInWords: text('amount_in_words').default(''),
  notes: text('notes').default(''),
  terms: text('terms').default(''),
  status: text('status').default('draft'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const voucherItems = sqliteTable('voucher_items', {
  id: text('id').primaryKey(),
  voucherId: text('voucher_id').notNull(),
  itemId: text('item_id').notNull(),
  description: text('description').default(''),
  hsnCode: text('hsn_code').default(''),
  quantity: real('quantity').notNull(),
  unit: text('unit').default('NOS'),
  rate: real('rate').notNull(),
  discountPercent: real('discount_percent').default(0),
  taxableAmount: real('taxable_amount').default(0),
  gstRate: real('gst_rate').default(18),
  cgstAmount: real('cgst_amount').default(0),
  sgstAmount: real('sgst_amount').default(0),
  igstAmount: real('igst_amount').default(0),
  totalAmount: real('total_amount').default(0),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(),
  direction: text('direction').notNull(),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  syncedAt: integer('synced_at').notNull(),
});
