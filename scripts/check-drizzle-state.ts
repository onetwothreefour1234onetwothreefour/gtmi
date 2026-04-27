/**
 * scripts/check-drizzle-state.ts
 *
 * Diagnostic: report what migration tracking state the live database is in.
 * Read-only — does not write.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx check-drizzle-state.ts
 *
 * Lists every `*migration*` table in `information_schema.tables`, then tries
 * to read `drizzle.__drizzle_migrations`. The expected outcome on this
 * project today is that `drizzle.__drizzle_migrations` does NOT exist —
 * migrations have historically been applied via Supabase SQL editor or via
 * `scripts/apply-migration.ts` (the formalised replacement). See ADR-012
 * (`docs/decisions/012-drizzle-kit-migration-mismatch.md`) for why
 * `drizzle-kit migrate` is not the canonical runner here.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

async function main(): Promise<void> {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  const port = url.match(/:(\d+)\/[^/]*$/)?.[1] ?? '?';
  console.log(`Using port ${port} (${port === '5432' ? 'DIRECT_URL' : 'DATABASE_URL pooler'})`);

  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    const tables = await sql<{ table_schema: string; table_name: string }[]>`
      SELECT table_schema, table_name FROM information_schema.tables
      WHERE table_name LIKE '%migration%'
      ORDER BY table_schema, table_name
    `;
    console.log('migration tables:', JSON.stringify(tables, null, 2));

    try {
      const entries = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
      console.log('drizzle.__drizzle_migrations:');
      console.log(JSON.stringify(entries, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('drizzle.__drizzle_migrations: ERR —', msg);
    }
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('ERROR:', msg);
  process.exit(1);
});
