import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Load .env from monorepo root — needed when scripts import @gtmi/db directly
dotenv.config({ path: '../../.env' });

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file at the monorepo root with your Supabase connection string.'
  );
}

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
