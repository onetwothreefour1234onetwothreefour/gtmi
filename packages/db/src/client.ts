import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { join } from 'node:path';
import postgres from 'postgres';
import * as schema from './schema';

// Resolve .env relative to this file so it works regardless of CWD.
// packages/db/src/client.ts → ../../../.env == monorepo root
dotenv.config({ path: join(__dirname, '../../../.env') });

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file at the monorepo root with your Supabase connection string.'
  );
}

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
