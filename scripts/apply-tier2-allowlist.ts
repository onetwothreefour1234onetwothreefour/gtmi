/**
 * Phase 3.4 / ADR-013 — apply the Tier 2 backfill allowlist to the
 * live `field_definitions` table.
 *
 * Sets `tier2_allowed = true` for every key in
 * `TIER2_BACKFILL_ALLOWLIST` (currently 3 keys: B.3.3, C.2.4, D.2.3).
 * Sets `tier2_allowed = false` for every other key, so a re-run of
 * this script after revoking an entry from the allowlist correctly
 * narrows the live state.
 *
 * Dry-run by default. Pass --execute to actually update.
 *
 * Usage:
 *   npx tsx scripts/apply-tier2-allowlist.ts            (dry run)
 *   npx tsx scripts/apply-tier2-allowlist.ts --execute  (apply)
 */

import * as dotenv from 'dotenv';
import { join } from 'node:path';
dotenv.config({ path: join(__dirname, '..', '.env') });

import { client, db, fieldDefinitions, TIER2_BACKFILL_ALLOWLIST } from '@gtmi/db';
import { inArray } from 'drizzle-orm';

interface CliArgs {
  execute: boolean;
}
function parseArgs(argv: string[]): CliArgs {
  return { execute: argv.includes('--execute') };
}

async function main(): Promise<void> {
  const { execute } = parseArgs(process.argv.slice(2));
  console.log(`Phase 3.4 Tier 2 allowlist — ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(
    `Allowlist (${TIER2_BACKFILL_ALLOWLIST.length}): ${TIER2_BACKFILL_ALLOWLIST.join(', ')}`
  );

  const liveRows = await db
    .select({ key: fieldDefinitions.key, tier2Allowed: fieldDefinitions.tier2Allowed })
    .from(fieldDefinitions);

  const allowSet = new Set<string>(TIER2_BACKFILL_ALLOWLIST);
  const toEnable: string[] = [];
  const toDisable: string[] = [];
  let alreadyConsistent = 0;
  let missingFromDb = 0;

  for (const k of TIER2_BACKFILL_ALLOWLIST) {
    const row = liveRows.find((r) => r.key === k);
    if (!row) {
      missingFromDb++;
      console.warn(`  [${k}] not present in DB — skipping`);
    }
  }

  for (const r of liveRows) {
    const shouldBeTrue = allowSet.has(r.key);
    if (shouldBeTrue && !r.tier2Allowed) toEnable.push(r.key);
    else if (!shouldBeTrue && r.tier2Allowed) toDisable.push(r.key);
    else alreadyConsistent++;
  }

  console.log(`Live field_definitions rows: ${liveRows.length}`);
  console.log(`  already consistent: ${alreadyConsistent}`);
  console.log(`  to enable (false → true): ${toEnable.length} ${toEnable.join(', ')}`);
  console.log(`  to disable (true → false): ${toDisable.length} ${toDisable.join(', ')}`);
  console.log(`  missing from DB: ${missingFromDb}`);

  if (toEnable.length === 0 && toDisable.length === 0) {
    console.log('Nothing to do.');
    await client.end({ timeout: 5 });
    return;
  }

  if (!execute) {
    console.log('\nDry-run — pass --execute to apply.');
    await client.end({ timeout: 5 });
    return;
  }

  console.log('\nApplying...');
  if (toEnable.length > 0) {
    const r = await db
      .update(fieldDefinitions)
      .set({ tier2Allowed: true })
      .where(inArray(fieldDefinitions.key, toEnable))
      .returning({ key: fieldDefinitions.key });
    console.log(`  enabled (true): ${r.map((x) => x.key).join(', ')}`);
  }
  if (toDisable.length > 0) {
    const r = await db
      .update(fieldDefinitions)
      .set({ tier2Allowed: false })
      .where(inArray(fieldDefinitions.key, toDisable))
      .returning({ key: fieldDefinitions.key });
    console.log(`  disabled (false): ${r.map((x) => x.key).join(', ')}`);
  }
  console.log('Done.');
  await client.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(1);
});
