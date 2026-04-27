/**
 * scripts/check-programs-columns.ts
 *
 * Diagnostic: list the columns on `programs` as known to the live database.
 * Read-only — does not write.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx check-programs-columns.ts
 *
 * Connects via DIRECT_URL (port 5432) when present, falls back to
 * DATABASE_URL. Used to verify migrations that touch the `programs`
 * table — `search_tsv` (00006), `long_summary_*` (00007), and any
 * future column-level changes — landed correctly.
 *
 * Pairs with ADR-012 and `scripts/apply-migration.ts`.
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
  console.log(`Using port ${port} (${port === '5432' ? 'DIRECT_URL' : 'pooler'})`);

  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    const cols = await sql<{ column_name: string; data_type: string; is_nullable: string }[]>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'programs'
      ORDER BY ordinal_position
    `;
    console.log('programs columns:');
    for (const c of cols) {
      console.log(
        `  ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
      );
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
