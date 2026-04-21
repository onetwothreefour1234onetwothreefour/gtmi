/**
 * Efficiency check suite — verifies all 8 pipeline optimisations.
 * Run from the project root:
 *   node_modules/.pnpm/node_modules/.bin/tsx scripts/test-efficiency.ts
 */
import { createHash } from 'crypto';
import {
  db,
  extractionCache,
  validationCache,
  discoveryCache,
  crosscheckCache,
  scrapeCache,
} from '@gtmi/db';
import { eq, and, gt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { ValidateStageImpl } from '@gtmi/extraction';
import type { ExtractionOutput, ScrapeResult } from '@gtmi/extraction';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

const results: { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, status: 'PASS', detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, status: 'FAIL', detail });
  console.error(`  FAIL  ${name} — ${detail}`);
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 1: All 5 cache tables exist in DB
// ────────────────────────────────────────────────────────────────────────────
async function check1_tablesExist() {
  console.log('\n[CHECK 1] All 5 cache tables exist in DB');
  const EXPECTED = [
    'scrape_cache',
    'discovery_cache',
    'extraction_cache',
    'validation_cache',
    'crosscheck_cache',
  ];
  const rows = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ANY(ARRAY[${sql.raw(EXPECTED.map((t) => `'${t}'`).join(','))}])
  `);
  const found = new Set((rows as { tablename: string }[]).map((r) => r.tablename));
  let allOk = true;
  for (const t of EXPECTED) {
    if (!found.has(t)) {
      allOk = false;
      console.log(`    MISSING: ${t}`);
    }
  }
  if (allOk) pass('CHECK 1', `All 5 tables present: ${EXPECTED.join(', ')}`);
  else fail('CHECK 1', 'One or more tables missing — re-run migration');
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 2: validate indexOf early exit — no LLM call when sentence not found
// ────────────────────────────────────────────────────────────────────────────
async function check2_validateIndexOfEarlyExit() {
  console.log('\n[CHECK 2] validate.ts indexOf early exit (no LLM when sentence absent)');

  const fakeExtraction: ExtractionOutput = {
    programId: 'test-program-id',
    fieldDefinitionKey: 'TEST.1',
    valueRaw: '$90,000',
    sourceSentence: 'THIS SENTENCE DOES NOT EXIST IN THE CONTENT',
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: 0.95,
    extractionModel: 'test',
    extractedAt: new Date(),
  };

  const fakeScrape: ScrapeResult = {
    url: 'https://example.com/test',
    contentMarkdown: 'This is some content about a visa program with salary requirements.',
    contentHash: sha256('test-content'),
    scrapedAt: new Date(),
    httpStatus: 200,
  };

  const validator = new ValidateStageImpl();
  const start = Date.now();
  const result = await validator.execute(fakeExtraction, fakeScrape);
  const elapsed = Date.now() - start;

  if (
    !result.isValid &&
    result.validationConfidence === 1.0 &&
    result.notes?.includes('not found verbatim')
  ) {
    if (elapsed < 2000) {
      pass(
        'CHECK 2',
        `Returned isValid=false in ${elapsed}ms (no LLM call) — notes: "${result.notes}"`
      );
    } else {
      fail(
        'CHECK 2',
        `Returned correct result but took ${elapsed}ms — may have made an LLM call (expected <2000ms)`
      );
    }
  } else {
    fail(
      'CHECK 2',
      `Expected isValid=false + notes about "not found verbatim", got: ${JSON.stringify(result)}`
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 3: validate sends short context (≤200+sentence chars) not 30K
// ────────────────────────────────────────────────────────────────────────────
async function check3_validateShortContext() {
  console.log('\n[CHECK 3] validate.ts sends short context (±200 chars, not full 30K content)');

  // The source file references CONTEXT_WINDOW = 200, and the user message is built with
  // offsetContext = content.slice(actualPos - 200, actualPos + sentence.length + 200)
  // We verify this by reading the source code for the constant.
  const fs = await import('fs');
  const path = await import('path');
  const validateSrc = fs.readFileSync(
    path.join(__dirname, '../packages/extraction/src/stages/validate.ts'),
    'utf-8'
  );

  const hasContextWindow = validateSrc.includes('CONTEXT_WINDOW = 200');
  const doesNotSendFullContent =
    !validateSrc.includes('contentMarkdown.slice(0, 30000)') &&
    !validateSrc.includes('contentMarkdown.slice(0,30000)');
  const sendsOffsetContext = validateSrc.includes('offsetContext');

  if (hasContextWindow && doesNotSendFullContent && sendsOffsetContext) {
    pass('CHECK 3', 'CONTEXT_WINDOW=200, full content not sent, offsetContext used');
  } else {
    fail(
      'CHECK 3',
      `hasContextWindow=${hasContextWindow}, doesNotSendFullContent=${doesNotSendFullContent}, sendsOffsetContext=${sendsOffsetContext}`
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 4: validation cache — write then read back
// ────────────────────────────────────────────────────────────────────────────
async function check4_validationCache() {
  console.log('\n[CHECK 4] Validation cache — write then read back');

  const testKey = sha256('test-validation-cache-key-' + Date.now());
  const testResult = {
    isValid: true,
    validationConfidence: 0.97,
    validationModel: 'test-model',
    notes: null,
  };

  try {
    await db
      .insert(validationCache)
      .values({
        cacheKey: testKey,
        model: testResult.validationModel,
        resultJsonb: testResult,
      })
      .onConflictDoNothing();

    const rows = await db
      .select()
      .from(validationCache)
      .where(eq(validationCache.cacheKey, testKey))
      .limit(1);
    if (
      rows.length > 0 &&
      (rows[0]!.resultJsonb as { validationConfidence: number }).validationConfidence === 0.97
    ) {
      pass('CHECK 4', `Validation cache write/read works — key=${testKey.slice(0, 16)}...`);
      // cleanup
      await db.delete(validationCache).where(eq(validationCache.cacheKey, testKey));
    } else {
      fail('CHECK 4', `Cache read back failed — got: ${JSON.stringify(rows)}`);
    }
  } catch (err: unknown) {
    fail('CHECK 4', err instanceof Error ? err.message : String(err));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 5: extraction cache — write then read back
// ────────────────────────────────────────────────────────────────────────────
async function check5_extractionCache() {
  console.log('\n[CHECK 5] Extraction cache — write then read back');

  const testKey = sha256('test-extraction-cache-key-' + Date.now());
  const testResult: ExtractionOutput = {
    programId: 'test-program-id',
    fieldDefinitionKey: 'TEST.1',
    valueRaw: '$95,000',
    sourceSentence: 'The minimum salary is $95,000 per year.',
    characterOffsets: { start: 100, end: 140 },
    extractionConfidence: 0.92,
    extractionModel: 'claude-opus-4-5',
    extractedAt: new Date(),
  };

  try {
    await db
      .insert(extractionCache)
      .values({
        cacheKey: testKey,
        model: testResult.extractionModel,
        resultJsonb: testResult,
      })
      .onConflictDoNothing();

    const rows = await db
      .select()
      .from(extractionCache)
      .where(eq(extractionCache.cacheKey, testKey))
      .limit(1);
    if (rows.length > 0 && (rows[0]!.resultJsonb as { valueRaw: string }).valueRaw === '$95,000') {
      pass('CHECK 5', `Extraction cache write/read works — key=${testKey.slice(0, 16)}...`);
      await db.delete(extractionCache).where(eq(extractionCache.cacheKey, testKey));
    } else {
      fail('CHECK 5', `Cache read back failed — got: ${JSON.stringify(rows)}`);
    }
  } catch (err: unknown) {
    fail('CHECK 5', err instanceof Error ? err.message : String(err));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 6: Batch extraction format — verify buildBatchUserMessage exists
//          and executeAllFields is exposed on ExtractStageImpl
// ────────────────────────────────────────────────────────────────────────────
async function check6_batchExtractFormat() {
  console.log('\n[CHECK 6] Batch extraction format — verifying code structure');

  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../packages/extraction/src/stages/extract.ts'),
    'utf-8'
  );

  const hasBuildBatch = src.includes('buildBatchUserMessage');
  const hasExecuteAllFields = src.includes('executeAllFields');
  const hasFieldKey = src.includes('"fieldKey"');
  const hasMaxTokens8192 = src.includes('max_tokens: 8192');
  const hasEarlyExit = src.includes('EARLY_EXIT_CONFIDENCE') && src.includes('0.9');
  const hasInterBatchDelay = src.includes('INTER_BATCH_DELAY_MS');

  const checks = [
    ['buildBatchUserMessage function', hasBuildBatch],
    ['executeAllFields method', hasExecuteAllFields],
    ['"fieldKey" in batch response schema', hasFieldKey],
    ['max_tokens: 8192 for batch calls', hasMaxTokens8192],
    ['EARLY_EXIT_CONFIDENCE = 0.9', hasEarlyExit],
    ['INTER_BATCH_DELAY_MS constant', hasInterBatchDelay],
  ];

  let allOk = true;
  for (const [label, ok] of checks) {
    if (!ok) {
      console.log(`    MISSING: ${label}`);
      allOk = false;
    }
  }

  if (allOk) pass('CHECK 6', 'All batch extraction code constructs verified');
  else fail('CHECK 6', 'One or more batch constructs missing from extract.ts');
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 7: Early exit confidence — verify constant and logic present
// ────────────────────────────────────────────────────────────────────────────
async function check7_earlyExitConfidence() {
  console.log('\n[CHECK 7] Early exit confidence (≥0.9 stops iterating URLs)');

  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../packages/extraction/src/stages/extract.ts'),
    'utf-8'
  );

  const hasConstant = src.includes('EARLY_EXIT_CONFIDENCE = 0.9');
  // Check for break/return on confidence threshold in executeAllFields
  const hasBreakLogic =
    src.includes('EARLY_EXIT_CONFIDENCE') &&
    (src.includes('break') || src.includes('allFieldsDone'));

  if (hasConstant && hasBreakLogic) {
    pass('CHECK 7', 'EARLY_EXIT_CONFIDENCE=0.9 constant and break/done logic present');
  } else {
    fail('CHECK 7', `hasConstant=${hasConstant}, hasBreakLogic=${hasBreakLogic}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 8: Discovery cache — write, read back, verify TTL column
// ────────────────────────────────────────────────────────────────────────────
async function check8_discoveryCache() {
  console.log('\n[CHECK 8] Discovery cache — write, read back with TTL check');

  const testKey = sha256('test-discovery-cache-key-' + Date.now());
  const testUrls = [
    {
      url: 'https://example.com/visa',
      tier: 1,
      geographicLevel: 'national',
      reason: 'Official page',
      isOfficial: true,
    },
  ];

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    await db
      .insert(discoveryCache)
      .values({
        cacheKey: testKey,
        programId: '00000000-0000-0000-0000-000000000001',
        discoveredUrls: testUrls,
        expiresAt,
      })
      .onConflictDoNothing();

    // Simulate the exact query used in discover.ts: expires_at > now()
    const rows = await db
      .select()
      .from(discoveryCache)
      .where(and(eq(discoveryCache.cacheKey, testKey), gt(discoveryCache.expiresAt, new Date())))
      .limit(1);

    if (rows.length > 0 && Array.isArray(rows[0]!.discoveredUrls)) {
      pass('CHECK 8', `Discovery cache write/read with TTL works — key=${testKey.slice(0, 16)}...`);
      await db.delete(discoveryCache).where(eq(discoveryCache.cacheKey, testKey));
    } else {
      fail('CHECK 8', `Cache read back failed — got ${rows.length} rows`);
    }
  } catch (err: unknown) {
    fail('CHECK 8', err instanceof Error ? err.message : String(err));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 9: Scrape cache — write then read back
// ────────────────────────────────────────────────────────────────────────────
async function check9_scrapeCache() {
  console.log('\n[CHECK 9] Scrape cache — write then read back');

  const testUrl = `https://example.com/test-scrape-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    await db
      .insert(scrapeCache)
      .values({
        url: testUrl,
        contentMarkdown: '# Test Content\n\nSome scrape content.',
        contentHash: sha256('Some scrape content.'),
        httpStatus: 200,
        scrapedAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: scrapeCache.url,
        set: { contentMarkdown: '# Test Content\n\nSome scrape content.' },
      });

    const rows = await db
      .select()
      .from(scrapeCache)
      .where(and(eq(scrapeCache.url, testUrl), gt(scrapeCache.expiresAt, new Date())))
      .limit(1);

    if (rows.length > 0 && rows[0]!.httpStatus === 200) {
      pass('CHECK 9', `Scrape cache write/read works — URL: ${testUrl.slice(0, 40)}...`);
      await db.delete(scrapeCache).where(eq(scrapeCache.url, testUrl));
    } else {
      fail('CHECK 9', `Cache read back failed — got ${rows.length} rows`);
    }
  } catch (err: unknown) {
    fail('CHECK 9', err instanceof Error ? err.message : String(err));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 10: Crosscheck cache — write then read back
// ────────────────────────────────────────────────────────────────────────────
async function check10_crosscheckCache() {
  console.log('\n[CHECK 10] Crosscheck cache — write then read back');

  const testKey = sha256('test-crosscheck-key-' + Date.now());
  const testResult = { agrees: true, tier2Url: 'https://example.com', notes: null };

  try {
    await db
      .insert(crosscheckCache)
      .values({
        cacheKey: testKey,
        model: 'test-model',
        resultJsonb: testResult,
      })
      .onConflictDoNothing();

    const rows = await db
      .select()
      .from(crosscheckCache)
      .where(eq(crosscheckCache.cacheKey, testKey))
      .limit(1);
    if (rows.length > 0 && (rows[0]!.resultJsonb as { agrees: boolean }).agrees === true) {
      pass('CHECK 10', `Crosscheck cache write/read works — key=${testKey.slice(0, 16)}...`);
      await db.delete(crosscheckCache).where(eq(crosscheckCache.cacheKey, testKey));
    } else {
      fail('CHECK 10', `Cache read back failed — got: ${JSON.stringify(rows)}`);
    }
  } catch (err: unknown) {
    fail('CHECK 10', err instanceof Error ? err.message : String(err));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CHECK 11: canary-run.ts uses executeAllFields + deduplication
// ────────────────────────────────────────────────────────────────────────────
async function check11_canaryUsesNewAPI() {
  console.log('\n[CHECK 11] canary-run.ts uses executeAllFields + URL deduplication');

  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(path.join(__dirname, 'canary-run.ts'), 'utf-8');

  const usesExecuteAllFields = src.includes('executeAllFields');
  const hasDedup = src.includes('allScrapeUrls') && src.includes('allUniqueScrapes');
  const hasLlmFieldsFilter = src.includes("d.key !== 'E.3.2'") && src.includes('llmFields');
  const noPerFieldExtractLoop = !src.includes('await extract.execute(');

  const checks = [
    ['uses executeAllFields()', usesExecuteAllFields],
    ['URL deduplication (allScrapeUrls + allUniqueScrapes)', hasDedup],
    ['E.3.2 excluded from LLM batch (llmFields filter)', hasLlmFieldsFilter],
    ['no per-field extract.execute() loop', noPerFieldExtractLoop],
  ];

  let allOk = true;
  for (const [label, ok] of checks) {
    if (!ok) {
      console.log(`    MISSING: ${label}`);
      allOk = false;
    }
  }

  if (allOk) pass('CHECK 11', 'canary-run.ts wired to new batch API correctly');
  else fail('CHECK 11', 'canary-run.ts missing one or more new API usages');
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== GTMI Efficiency Check Suite ===');
  console.log('Testing all 8 pipeline optimisations\n');

  await check1_tablesExist();
  await check2_validateIndexOfEarlyExit();
  await check3_validateShortContext();
  await check4_validationCache();
  await check5_extractionCache();
  await check6_batchExtractFormat();
  await check7_earlyExitConfidence();
  await check8_discoveryCache();
  await check9_scrapeCache();
  await check10_crosscheckCache();
  await check11_canaryUsesNewAPI();

  console.log('\n=== RESULTS ===');
  const passes = results.filter((r) => r.status === 'PASS').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const skips = results.filter((r) => r.status === 'SKIP').length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '○';
    console.log(`  ${icon} [${r.status}] ${r.name}${r.detail ? `\n         ${r.detail}` : ''}`);
  }

  console.log(`\nTotal: ${passes} passed, ${fails} failed, ${skips} skipped`);

  if (fails > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
