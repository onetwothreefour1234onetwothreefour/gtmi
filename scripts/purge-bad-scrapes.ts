/**
 * Identify and optionally delete scrape_cache rows with bad/unusable content.
 * Default: dry run. Pass --execute to actually delete.
 *
 * Usage:
 *   npx tsx scripts/purge-bad-scrapes.ts
 *   npx tsx scripts/purge-bad-scrapes.ts --execute
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

dotenv.config({ path: join(__dirname, '../.env') });
const DB_URL = process.env['DATABASE_URL'];
if (!DB_URL) throw new Error('DATABASE_URL not set — add it to .env at the monorepo root');

const SOFT_404_PATTERNS: RegExp[] = [
  /\b404\b.*\bnot found\b/i,
  /\bpage (not|cannot be) found\b/i,
  /\bcan't find (the )?page\b/i,
  /\bthis page (doesn't|does not) exist\b/i,
];
const MIN_VISIBLE_TEXT = 300;

function visibleTextLength(md: string): number {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*`_>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

type Rejection = { reason: string };

function checkContent(content: string, httpStatus: number): Rejection | null {
  if (httpStatus >= 400) return { reason: `http_${httpStatus}` };
  const snippet = content.slice(0, 2048);
  for (const p of SOFT_404_PATTERNS) {
    if (p.test(snippet)) return { reason: `soft_404` };
  }
  const vLen = visibleTextLength(content);
  if (vLen < MIN_VISIBLE_TEXT) return { reason: `short_content(visible=${vLen})` };
  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const sql = postgres(DB_URL, { ssl: 'require' });

  const rows = await sql<
    Array<{ url: string; content_markdown: string; http_status: number }>
  >`SELECT url, content_markdown, http_status FROM scrape_cache`;

  const toDelete: Array<{ url: string; reason: string }> = [];

  for (const r of rows) {
    const rejection = checkContent(r.content_markdown ?? '', r.http_status);
    if (rejection) {
      toDelete.push({ url: r.url, reason: rejection.reason });
    }
  }

  if (toDelete.length === 0) {
    console.log(`Checked ${rows.length} rows — all clean.`);
    await sql.end();
    return;
  }

  console.log(`Checked ${rows.length} rows — ${toDelete.length} flagged:\n`);
  for (const d of toDelete) {
    console.log(`  ${d.url}`);
    console.log(`    reason: ${d.reason}`);
  }

  if (dryRun) {
    console.log('\nDry run — pass --execute to delete these rows.');
  } else {
    const urls = toDelete.map((d) => d.url);
    await sql`DELETE FROM scrape_cache WHERE url = ANY(${urls})`;
    console.log(`\nDeleted ${toDelete.length} rows.`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
