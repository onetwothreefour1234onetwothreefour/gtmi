/**
 * Audit scrape_cache for pages that likely failed to capture useful content.
 * Flags: short body, HTTP error status, common error-page markers.
 */
import postgres from 'postgres';
import { writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

dotenv.config({ path: join(__dirname, '../.env') });
const DB_URL = process.env['DATABASE_URL'];
if (!DB_URL) throw new Error('DATABASE_URL not set — add it to .env at the monorepo root');

const ERROR_MARKERS = [
  'access denied',
  'forbidden',
  '403 forbidden',
  '404 not found',
  'page not found',
  'page cannot be found',
  "can't find the page",
  'something went wrong',
  'checking your browser',
  'cloudflare',
  'enable javascript',
  'please enable js',
  'attention required',
  'are you a human',
  'captcha',
  'just a moment',
  'verifying you are human',
  'bot detection',
  'rate limit',
  'too many requests',
  '502 bad gateway',
  '503 service unavailable',
  'timeout',
  'verification required',
  'sign in to continue',
  'login required',
];

async function main() {
  const sql = postgres(DB_URL, { ssl: 'require' });
  const rows = await sql<
    Array<{
      url: string;
      content_markdown: string;
      content_hash: string;
      http_status: number;
      scraped_at: Date;
      len: number;
    }>
  >`
    SELECT url, content_markdown, content_hash, http_status, scraped_at,
           LENGTH(content_markdown) AS len
    FROM scrape_cache
    ORDER BY scraped_at DESC
  `;

  const out: string[] = [];
  out.push(`total rows: ${rows.length}`);
  out.push('');

  const flagged: Array<{
    url: string;
    len: number;
    status: number;
    reasons: string[];
    preview: string;
  }> = [];

  for (const r of rows) {
    const md = (r.content_markdown || '').toLowerCase();
    const reasons: string[] = [];
    if (r.http_status >= 400) reasons.push(`http_${r.http_status}`);
    if (r.len < 500) reasons.push(`short_body(${r.len})`);
    for (const m of ERROR_MARKERS) {
      if (md.includes(m)) {
        reasons.push(`marker:"${m}"`);
        break;
      }
    }
    const visibleText = (r.content_markdown || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/[#*`_>|-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (visibleText.length < 300 && r.len >= 500) {
      reasons.push(`low_text_ratio(visible=${visibleText.length}/raw=${r.len})`);
    }
    if (reasons.length === 0) continue;
    flagged.push({
      url: r.url,
      len: r.len,
      status: r.http_status,
      reasons,
      preview: (r.content_markdown || '').slice(0, 400).replace(/\s+/g, ' '),
    });
  }

  out.push(`flagged rows: ${flagged.length} / ${rows.length}`);
  out.push('');
  for (const f of flagged) {
    out.push(`URL: ${f.url}`);
    out.push(`  http=${f.status}  len=${f.len}  reasons=${f.reasons.join(', ')}`);
    out.push(`  preview: ${f.preview}`);
    out.push('');
  }

  writeFileSync('scrape-audit.txt', out.join('\n'));
  console.log(out.join('\n'));
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
