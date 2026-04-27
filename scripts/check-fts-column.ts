/**
 * scripts/check-fts-column.ts
 *
 * Diagnostic: confirm the Phase 4.2 full-text-search column and GIN index
 * exist on the live database. Read-only — does not write.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx check-fts-column.ts
 *
 * Connects via DIRECT_URL (port 5432) when present, falls back to
 * DATABASE_URL. Prints the `programs.search_tsv` column row, the
 * `idx_programs_search_tsv` index row, and the row count of `programs`.
 * Empty results indicate migration 00006 has not been applied — apply
 * it via `scripts/apply-migration.ts 00006_add_programs_fts`.
 *
 * Pairs with `scripts/check-drizzle-state.ts` and ADR-012.
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
    const cols = await sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'programs' AND column_name = 'search_tsv'
    `;
    console.log('search_tsv column:', JSON.stringify(cols));
    const idx = await sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'programs' AND indexname = 'idx_programs_search_tsv'
    `;
    console.log('idx_programs_search_tsv:', JSON.stringify(idx));
    const counts = await sql<{ total: number; populated: number }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE search_tsv IS NOT NULL)::int AS populated
      FROM programs
    `;
    console.log('programs row count / search_tsv populated:', JSON.stringify(counts));
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('ERROR:', msg);
  process.exit(1);
});
