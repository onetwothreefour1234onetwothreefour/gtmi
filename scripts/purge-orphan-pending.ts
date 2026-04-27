/**
 * One-off purge of pending_review field_values rows whose provenance is missing
 * the canonical 13 ProvenanceRecord keys. These are orphans from canary runs
 * predating the Session-9 HumanReviewStage.enqueue fix: their provenance was
 * never written with sourceUrl / contentHash / etc., and a subsequent canary
 * run can't overwrite them because the cached extraction now returns empty
 * (so enqueue never fires).
 *
 * Deletes both the field_values row and the matching review_queue rows.
 *
 * Dry-run by default; pass --execute to apply.
 *
 * Usage:
 *   npx tsx scripts/purge-orphan-pending.ts --country AUS
 *   npx tsx scripts/purge-orphan-pending.ts --country AUS --execute
 */

import { db, fieldValues, reviewQueue, programs } from '@gtmi/db';
import { eq, inArray, and } from 'drizzle-orm';

const REQUIRED_KEYS = [
  'sourceUrl',
  'geographicLevel',
  'sourceTier',
  'scrapeTimestamp',
  'contentHash',
  'crossCheckResult',
  'methodologyVersion',
];

interface CliArgs {
  country?: string;
  programId?: string;
  execute: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { execute: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--country' && next) {
      out.country = next.toUpperCase();
      i++;
    } else if (a === '--programId' && next) {
      out.programId = next;
      i++;
    } else if (a === '--execute') {
      out.execute = true;
    }
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.country && !args.programId) {
    console.error(
      'Usage: purge-orphan-pending.ts --country <ISO3> | --programId <uuid> [--execute]'
    );
    process.exit(2);
  }

  const programRows = args.programId
    ? await db.select().from(programs).where(eq(programs.id, args.programId))
    : await db.select().from(programs).where(eq(programs.countryIso, args.country!));

  if (programRows.length === 0) {
    console.error('No matching programs.');
    process.exit(2);
  }
  const programIds = programRows.map((p) => p.id);

  const pending = await db
    .select({
      id: fieldValues.id,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      provenance: fieldValues.provenance,
    })
    .from(fieldValues)
    .where(
      and(inArray(fieldValues.programId, programIds), eq(fieldValues.status, 'pending_review'))
    );

  const orphans = pending.filter((row) => {
    const prov = isObject(row.provenance) ? row.provenance : {};
    return REQUIRED_KEYS.some((k) => !(k in prov) || prov[k] === undefined || prov[k] === null);
  });

  console.log(`Pending rows in scope: ${pending.length}`);
  console.log(`Orphans (incomplete provenance): ${orphans.length}`);
  for (const o of orphans) {
    console.log(`  ${o.id}`);
  }

  if (orphans.length === 0) {
    console.log('Nothing to purge.');
    return;
  }

  if (!args.execute) {
    console.log('\nDry run — no rows deleted. Pass --execute to apply.');
    return;
  }

  const orphanIds = orphans.map((o) => o.id);

  const deletedQueue = await db
    .delete(reviewQueue)
    .where(inArray(reviewQueue.fieldValueId, orphanIds))
    .returning({ id: reviewQueue.id });
  console.log(`Deleted review_queue rows: ${deletedQueue.length}`);

  const deletedFv = await db
    .delete(fieldValues)
    .where(inArray(fieldValues.id, orphanIds))
    .returning({ id: fieldValues.id });
  console.log(`Deleted field_values rows: ${deletedFv.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
