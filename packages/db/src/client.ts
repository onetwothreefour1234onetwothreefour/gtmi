import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { join } from 'node:path';
import postgres from 'postgres';
import * as schema from './schema';

// In local dev: load .env from monorepo root (packages/db/src → ../../../).
// In cloud (Trigger.dev, Cloud Run): env vars are injected directly — dotenv
// returns silently if the file is missing, leaving injected values intact.
dotenv.config({ path: join(__dirname, '../../../.env') });

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

let _client: ReturnType<typeof postgres> | null = null;
let _db: Drizzle | null = null;

function init(): { client: ReturnType<typeof postgres>; db: Drizzle } {
  if (_db && _client) return { client: _client, db: _db };
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Create a .env file at the monorepo root with your Supabase connection string.'
    );
  }
  _client = postgres(connectionString);
  _db = drizzle(_client, { schema });
  return { client: _client, db: _db };
}

// Lazy proxies so importing @gtmi/db doesn't throw when DATABASE_URL is absent
// (e.g. Next.js build-time page-data collection). Access triggers init.
export const client = new Proxy({} as ReturnType<typeof postgres>, {
  get(_t, prop) {
    const { client } = init();
    const v = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
  apply(_t, _thisArg, args: unknown[]) {
    const { client } = init();
    return (client as unknown as (...a: unknown[]) => unknown).apply(client, args);
  },
}) as unknown as ReturnType<typeof postgres>;

export const db = new Proxy({} as Drizzle, {
  get(_t, prop) {
    const { db } = init();
    const v = (db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(db) : v;
  },
}) as Drizzle;
