/**
 * Turso (LibSQL) client initialization via Drizzle ORM
 * ⚠️ These credentials are exposed in the browser bundle.
 *    Use a write-scoped token from the Turso dashboard.
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';

let tursoClient: ReturnType<typeof createClient> | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

function getTursoUrl(): string {
  return (import.meta as any).env?.VITE_TURSO_DATABASE_URL || '';
}

function getTursoToken(): string {
  return (import.meta as any).env?.VITE_TURSO_AUTH_TOKEN || '';
}

export function isTursoConfigured(): boolean {
  const url = getTursoUrl();
  const token = getTursoToken();
  return Boolean(url && url !== 'libsql://maestro-dev.turso.io' && token && token !== 'placeholder-token');
}

export function getTursoClient() {
  if (!tursoClient) {
    const url = getTursoUrl();
    const token = getTursoToken();

    if (!url || !token) {
      console.warn('[Turso] Missing credentials — running in offline-only mode');
      return null;
    }

    try {
      tursoClient = createClient({
        url,
        authToken: token,
      });
    } catch (err) {
      console.error('[Turso] Failed to create client:', err);
      return null;
    }
  }
  return tursoClient;
}

export function getDrizzleDb() {
  if (!drizzleDb) {
    const client = getTursoClient();
    if (!client) return null;
    drizzleDb = drizzle(client);
  }
  return drizzleDb;
}

/**
 * Execute a raw SQL query against Turso
 * Used by the sync engine for push/pull operations
 */
export async function executeTursoQuery(sql: string, args: any[] = []) {
  const client = getTursoClient();
  if (!client) throw new Error('Turso not configured');
  return client.execute({ sql, args });
}

/**
 * Execute a batch of SQL statements against Turso
 */
export async function executeTursoBatch(statements: Array<{ sql: string; args: any[] }>) {
  const client = getTursoClient();
  if (!client) throw new Error('Turso not configured');
  return client.batch(statements.map(s => ({ sql: s.sql, args: s.args })));
}
