/**
 * One-shot sync: push the `extractionPromptMd` value from a methodology
 * seed file (v1 or v2) into the live `field_definitions` table.
 *
 * The seed file is the source of truth for prompts; existing DB rows were
 * inserted at first run and aren't auto-updated when the seed changes. This
 * script reconciles them on demand.
 *
 * --source defaults to v1 for backward compatibility (Phase 2 behaviour).
 * Pass --source v2 to push the Phase 3.3 prompt overrides.
 *
 * Dry-run by default; pass --execute to apply.
 *
 * Usage:
 *   # Phase 3.3 — push v2 prompt rewrites (LLM_MISS sweep):
 *   npx tsx scripts/sync-prompts-from-seed.ts --source v2 --all --execute
 *
 *   # Sync a specific key set from v1 (rollback):
 *   npx tsx scripts/sync-prompts-from-seed.ts --source v1 --all --execute
 *
 *   # Dry-run a v2 push for a subset:
 *   npx tsx scripts/sync-prompts-from-seed.ts --source v2 --keys A.1.2,B.3.1
 */

import { client, db, fieldDefinitions, methodologyV1, methodologyV2 } from '@gtmi/db';
import { eq, inArray } from 'drizzle-orm';

// methodology objects expose .indicators with the canonical rows.
interface SeedIndicator {
  key: string;
  extractionPromptMd: string;
}

type SourceTag = 'v1' | 'v2';

function getSeed(source: SourceTag): SeedIndicator[] {
  const m = source === 'v2' ? methodologyV2 : methodologyV1;
  return (m as { indicators: SeedIndicator[] }).indicators;
}

interface CliArgs {
  keys: string[];
  all: boolean;
  execute: boolean;
  source: SourceTag;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { keys: [], all: false, execute: false, source: 'v1' };
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
    } else if (a === '--source' && next) {
      if (next !== 'v1' && next !== 'v2') {
        console.error(`--source must be 'v1' or 'v2' (got "${next}")`);
        process.exit(2);
      }
      out.source = next;
      i++;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.keys.length === 0) {
    console.error(
      'Usage: sync-prompts-from-seed.ts --source v1|v2 [--keys A.1.2,B.3.1,...] [--all] [--execute]'
    );
    process.exit(2);
  }

  console.log(`Source seed: methodology-${args.source}`);
  const fieldDefinitionsSeed = getSeed(args.source);
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

main()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      // ignore
    }
    process.exit(1);
  });
