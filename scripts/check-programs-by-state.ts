/**
 * scripts/check-programs-by-state.ts
 *
 * Diagnostic: list one program per state on the live DB so the
 * /programs/[id] route can be smoke-tested across scored / placeholder /
 * unscored. Read-only.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx check-programs-by-state.ts
 *
 * Connects via DIRECT_URL when present, falls back to DATABASE_URL.
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
  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    const scored = await sql<{ id: string; name: string; country_iso: string; phase2: boolean }[]>`
      SELECT
        p.id,
        p.name,
        p.country_iso,
        (s.metadata ->> 'phase2Placeholder')::boolean AS phase2
      FROM programs p
      INNER JOIN scores s ON s.program_id = p.id
      ORDER BY s.scored_at DESC
      LIMIT 5
    `;
    console.log('Scored programs (latest 5):');
    for (const r of scored) {
      console.log(
        `  ${r.id}  ${r.country_iso}  ${r.phase2 ? '[PLACEHOLDER]' : '[CALIBRATED]'}  ${r.name}`
      );
    }

    const unscored = await sql<{ id: string; name: string; country_iso: string }[]>`
      SELECT p.id, p.name, p.country_iso
      FROM programs p
      LEFT JOIN scores s ON s.program_id = p.id
      WHERE s.id IS NULL
      ORDER BY p.country_iso, p.name
      LIMIT 5
    `;
    console.log('\nUnscored programs (first 5):');
    for (const r of unscored) {
      console.log(`  ${r.id}  ${r.country_iso}  ${r.name}`);
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
