// Phase 3.6.1 / FIX 7 — purge thin-content scrape_cache rows.
//
// The Phase 3.6 / Fix C scrape guard raised MIN_VISIBLE_TEXT_LENGTH
// from 300 to 1500 chars. Pre-existing scrape_cache rows that pass the
// old threshold but fail the new one (e.g. the AUS Medicare 484-char
// redirect-stub row) are still served on cache hit, bypassing the new
// guard entirely. This script DELETEs scrape_cache rows whose content
// length is below the new floor so the next canary forces a fresh
// Cloud Run scrape that exercises Fix C.
//
// Country-agnostic: applies to every cohort country.
//
// Dry-run by default. Pass --execute to actually delete.
//
// Usage:
//   pnpm exec tsx scripts/purge-thin-scrape-cache.ts            (dry run)
//   pnpm exec tsx scripts/purge-thin-scrape-cache.ts --execute  (delete)

import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

const MIN_CHARS = 1500;

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 15 });
  try {
    const rows = (await sql`
      SELECT url, length(content_markdown) AS chars, scraped_at
      FROM scrape_cache
      WHERE length(content_markdown) < ${MIN_CHARS}
      ORDER BY scraped_at DESC
    `) as Array<{ url: string; chars: number; scraped_at: Date }>;

    console.log(`[purge-thin-scrape-cache] Found ${rows.length} rows below ${MIN_CHARS} chars.`);
    for (const row of rows.slice(0, 10)) {
      console.log(
        `  ${row.chars} chars | ${row.scraped_at.toISOString().slice(0, 16)} | ${row.url}`
      );
    }
    if (rows.length > 10) {
      console.log(`  ... and ${rows.length - 10} more.`);
    }

    if (!execute) {
      console.log('');
      console.log('[DRY RUN] No rows deleted. Re-run with --execute to delete.');
      return;
    }

    const result = await sql`
      DELETE FROM scrape_cache WHERE length(content_markdown) < ${MIN_CHARS}
    `;
    console.log(`[EXECUTED] Deleted ${result.count} rows from scrape_cache.`);
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
