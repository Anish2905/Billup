// Indian states and UTs with their GST state codes
export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;
export type GSTRate = (typeof GST_RATES)[number];

export const UNITS = [
  'NOS', 'KGS', 'MTR', 'LTR', 'SQM', 'CMT', 'PCS',
  'SET', 'BOX', 'PAC', 'ROL', 'TON', 'BAG', 'BTL',
  'CTN', 'DOZ', 'DRM', 'GMS', 'MLT', 'QTL', 'UNT',
] as const;
export type Unit = (typeof UNITS)[number];

export const VOUCHER_TYPES = ['invoice', 'credit_note', 'debit_note'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_STATUS = ['draft', 'confirmed', 'cancelled'] as const;
export type VoucherStatus = (typeof VOUCHER_STATUS)[number];

export const PARTY_TYPES = ['customer', 'supplier'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const ENTITY_TYPES = ['company', 'party', 'item', 'voucher', 'voucher_item'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Session storage keys
export const SESSION_KEY = 'maestro_auth';
export const PERSIST_KEY = 'maestro_persist';
export const PERSIST_EXPIRY_DAYS = 7;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30_000; // 30 seconds

// Sync config
export const SYNC_INTERVAL = Number(
  typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.VITE_SYNC_INTERVAL
    : 30000
) || 30000;
export const MAX_SYNC_RETRIES = 5;
export const SYNC_BATCH_SIZE = 50;

// Financial year (India: April–March)
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  if (month >= 3) {
    // April onwards
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

// App name
export const APP_NAME = typeof import.meta !== 'undefined'
  ? (import.meta as any).env?.VITE_APP_NAME || 'Maestro Engineering Works'
  : 'Maestro Engineering Works';
