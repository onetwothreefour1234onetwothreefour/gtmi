/**
 * One-shot sync: push the `extractionPromptMd` value from `methodology-v1.ts`
 * into the live `field_definitions` table for a given subset of field keys.
 *
 * The seed file is the source of truth for prompts; existing DB rows were
 * inserted at first run and aren't auto-updated when the seed changes. This
 * script reconciles them on demand.
 *
 * Dry-run by default; pass --execute to apply.
 *
 * Usage:
 *   # Sync the 6 LLM_MISS prompts tuned in Phase 2 close-out:
 *   npx tsx scripts/sync-prompts-from-seed.ts \
 *     --keys A.1.2,B.3.1,C.2.1,D.2.2,D.2.4,E.1.1
 *
 *   # Sync everything:
 *   npx tsx scripts/sync-prompts-from-seed.ts --all --execute
 */

import { db, fieldDefinitions, methodologyV1 } from '@gtmi/db';
import { eq, inArray } from 'drizzle-orm';

// methodologyV1.indicators carries the canonical {key, label, extractionPromptMd, ...}
// rows. We narrow to the shape this script needs.
interface SeedIndicator {
  key: string;
  extractionPromptMd: string;
}
const fieldDefinitionsSeed: SeedIndicator[] = (methodologyV1 as { indicators: SeedIndicator[] })
  .indicators;

interface CliArgs {
  keys: string[];
  all: boolean;
  execute: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { keys: [], all: false, execute: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--keys' && next) {
      out.keys = next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
    } else if (a === '--all') {
      out.all = true;
    } else if (a === '--execute') {
      out.execute = true;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.keys.length === 0) {
    console.error(
      'Usage: sync-prompts-from-seed.ts --keys A.1.2,B.3.1,... [--execute]  |  --all [--execute]'
    );
    process.exit(2);
  }

  const seedRows = fieldDefinitionsSeed.filter((s) => args.all || args.keys.includes(s.key));
  if (seedRows.length === 0) {
    console.error(`No seed rows match keys ${args.keys.join(',')}`);
    process.exit(2);
  }

  // Pull live rows for the same keys.
  const liveRows = await db
    .select({
      key: fieldDefinitions.key,
      extractionPromptMd: fieldDefinitions.extractionPromptMd,
    })
    .from(fieldDefinitions)
    .where(
      inArray(
        fieldDefinitions.key,
        seedRows.map((r) => r.key)
      )
    );

  const liveByKey = new Map(liveRows.map((r) => [r.key, r.extractionPromptMd]));

  const changes: Array<{ key: string; oldLen: number; newLen: number }> = [];
  let unchanged = 0;
  let missingInDb = 0;

  for (const seed of seedRows) {
    const current = liveByKey.get(seed.key);
    if (current === undefined) {
      missingInDb++;
      console.warn(
        `  [${seed.key}] not present in DB — skipping (will land on next full seed run)`
      );
      continue;
    }
    if (current === seed.extractionPromptMd) {
      unchanged++;
      continue;
    }
    changes.push({
      key: seed.key,
      oldLen: current.length,
      newLen: seed.extractionPromptMd.length,
    });
  }

  console.log(`Seed prompts in scope: ${seedRows.length}`);
  console.log(`  unchanged: ${unchanged}`);
  console.log(`  to update: ${changes.length}`);
  console.log(`  missing in DB: ${missingInDb}`);

  if (changes.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('\nPlanned updates:');
  for (const c of changes) {
    console.log(`  ${c.key}: ${c.oldLen} → ${c.newLen} chars`);
  }

  if (!args.execute) {
    console.log('\nDry run — no rows updated. Pass --execute to apply.');
    return;
  }

  console.log('\nApplying updates...');
  for (const seed of seedRows) {
    if (!changes.find((c) => c.key === seed.key)) continue;
    await db
      .update(fieldDefinitions)
      .set({ extractionPromptMd: seed.extractionPromptMd })
      .where(eq(fieldDefinitions.key, seed.key));
    console.log(`  ${seed.key} updated`);
  }
  console.log(`Done — ${changes.length} row(s) updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
