/**
 * Phase 3.3 cache invalidation — DELETE extraction_cache rows whose
 * cache_key was generated from a v1 prompt for any of the rewritten
 * Phase 3.3 fields.
 *
 * Why this script exists:
 * The extraction_cache schema has only `cache_key` (the sha256 hash) — no
 * field_key column. So we can't `DELETE WHERE field_key IN (...)` directly.
 * Instead we recompute every (contentHash, fieldKey) pair's v1 cache_key
 * from the available scrape_cache content hashes and delete those exact rows.
 *
 * Why this is safe even if you skip it:
 * The cache_key includes a hash of the prompt text. After
 * `sync-prompts-from-seed.ts --source v2 --execute` updates the
 * field_definitions row, future extractions compute a DIFFERENT cache_key
 * and miss the cache automatically — old rows are inert and just sit there
 * as orphans. Running this script is hygiene; it removes orphan rows and
 * makes the storage footprint match expectations.
 *
 * Dry-run by default. Pass --execute to actually delete.
 *
 * Usage:
 *   npx tsx scripts/invalidate-extraction-cache-phase-3-3.ts            (dry run)
 *   npx tsx scripts/invalidate-extraction-cache-phase-3-3.ts --execute  (delete)
 */

import * as dotenv from 'dotenv';
import { join } from 'node:path';
dotenv.config({ path: join(__dirname, '..', '.env') });

import {
  client,
  db,
  extractionCache,
  scrapeCache,
  PHASE_3_3_REWRITTEN_KEYS,
  methodologyV1,
} from '@gtmi/db';
import { computeExtractionCacheKey } from '@gtmi/extraction';
import { inArray } from 'drizzle-orm';

interface CliArgs {
  execute: boolean;
}
function parseArgs(argv: string[]): CliArgs {
  return { execute: argv.includes('--execute') };
}

async function main(): Promise<void> {
  const { execute } = parseArgs(process.argv.slice(2));
  console.log(`Phase 3.3 extraction_cache invalidation — ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(
    `Rewritten field keys (${PHASE_3_3_REWRITTEN_KEYS.length}): ${PHASE_3_3_REWRITTEN_KEYS.join(', ')}`
  );

  // Build a fieldKey -> v1 promptMd lookup so we can recompute v1 cache keys.
  const v1PromptByKey = new Map<string, string>();
  for (const ind of methodologyV1.indicators) {
    if (PHASE_3_3_REWRITTEN_KEYS.includes(ind.key)) {
      v1PromptByKey.set(ind.key, ind.extractionPromptMd);
    }
  }

  // Pull every scrape_cache row's contentHash. The extraction cache is keyed
  // partly on contentHash; we need every contentHash that may have produced
  // an extraction_cache row.
  const scrapeRows = await db.select({ contentHash: scrapeCache.contentHash }).from(scrapeCache);
  const contentHashes = [...new Set(scrapeRows.map((r) => r.contentHash))].filter(
    (h): h is string => Boolean(h)
  );
  console.log(`Distinct content hashes in scrape_cache: ${contentHashes.length}`);

  // Compute every v1 cache_key for (contentHash × rewrittenFieldKey × v1 promptMd).
  const candidateKeys: string[] = [];
  for (const contentHash of contentHashes) {
    for (const fieldKey of PHASE_3_3_REWRITTEN_KEYS) {
      const promptMd = v1PromptByKey.get(fieldKey);
      if (!promptMd) continue;
      candidateKeys.push(computeExtractionCacheKey(contentHash, fieldKey, promptMd));
    }
  }
  console.log(`Candidate cache keys to check: ${candidateKeys.length}`);

  // Find which of those candidate keys actually exist in extraction_cache.
  // Chunk to avoid massive IN-clauses.
  const CHUNK = 500;
  const present: string[] = [];
  for (let i = 0; i < candidateKeys.length; i += CHUNK) {
    const slice = candidateKeys.slice(i, i + CHUNK);
    const rows = await db
      .select({ cacheKey: extractionCache.cacheKey })
      .from(extractionCache)
      .where(inArray(extractionCache.cacheKey, slice));
    for (const r of rows) present.push(r.cacheKey);
  }
  console.log(`Present in extraction_cache: ${present.length}`);

  if (present.length === 0) {
    console.log('Nothing to delete.');
    await client.end({ timeout: 5 });
    return;
  }

  if (!execute) {
    console.log('\nDry-run — pass --execute to apply the DELETE.');
    console.log('Sample of keys that would be deleted:');
    for (const k of present.slice(0, 5)) console.log(`  ${k}`);
    if (present.length > 5) console.log(`  … and ${present.length - 5} more`);
    await client.end({ timeout: 5 });
    return;
  }

  console.log('Deleting...');
  let deleted = 0;
  for (let i = 0; i < present.length; i += CHUNK) {
    const slice = present.slice(i, i + CHUNK);
    const res = await db
      .delete(extractionCache)
      .where(inArray(extractionCache.cacheKey, slice))
      .returning({ cacheKey: extractionCache.cacheKey });
    deleted += res.length;
  }
  console.log(`Deleted ${deleted} extraction_cache row(s) for Phase 3.3 rewritten fields.`);
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
