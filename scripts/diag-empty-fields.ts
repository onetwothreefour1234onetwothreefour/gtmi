/**
 * Diagnostic script: identify WHY Wave 1 fields are empty for a given program.
 *
 * For each empty field, checks every scraped source URL and reports:
 *   - Total content length
 *   - Whether content is truncated (>30K)
 *   - Whether key terms appear in first 30K chars (what LLM saw)
 *   - Whether key terms appear AFTER 30K chars (what LLM missed due to truncation)
 *
 * Root cause classification:
 *   TRUNCATION   — keyword found only after 30K → content window strategy will help
 *   LLM_MISS     — keyword found in first 30K but extracted empty → prompt or LLM issue
 *   ABSENT       — keyword not found anywhere → data genuinely not on these sources
 *
 * Usage:
 *   npx tsx scripts/diag-empty-fields.ts --country AUS [--programId <uuid>]
 */

import { db, fieldDefinitions, fieldValues, programs, sources, scrapeCache } from '@gtmi/db';
import { and, eq, inArray } from 'drizzle-orm';
import { ACTIVE_FIELD_CODES } from './wave-config';

const MAX_CONTENT_CHARS = 30000;

// ---------------------------------------------------------------------------
// Keyword extraction from field label
// ---------------------------------------------------------------------------
function extractKeywords(label: string): string[] {
  const stopWords = new Set([
    'and',
    'or',
    'the',
    'a',
    'an',
    'of',
    'for',
    'in',
    'on',
    'to',
    'by',
    'as',
    'at',
    'with',
    'from',
    'vs',
    'per',
    'no',
    'not',
  ]);
  const tokens = label
    .toLowerCase()
    .split(/[\s/(),\-–]+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));
  // Return up to 4 unique tokens
  return [...new Set(tokens)].slice(0, 4);
}

// ---------------------------------------------------------------------------
// Root cause classification
// ---------------------------------------------------------------------------
type RootCause = 'TRUNCATION' | 'LLM_MISS' | 'ABSENT';

function classify(foundIn0to30k: boolean, foundAfter30k: boolean, isTruncated: boolean): RootCause {
  if (foundAfter30k && !foundIn0to30k && isTruncated) return 'TRUNCATION';
  if (foundIn0to30k) return 'LLM_MISS';
  return 'ABSENT';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const countryArgIdx = process.argv.indexOf('--country');
  const countryArg = countryArgIdx !== -1 ? process.argv[countryArgIdx + 1] : undefined;
  if (!countryArg) {
    console.error(
      'Usage: npx tsx scripts/diag-empty-fields.ts --country <AUS|SGP> [--programId <uuid>]'
    );
    process.exit(1);
  }

  const programIdArgIdx = process.argv.indexOf('--programId');
  const programIdArg = programIdArgIdx !== -1 ? process.argv[programIdArgIdx + 1] : undefined;

  // --- 1. Find program ---
  const programRows = await db
    .select()
    .from(programs)
    .where(programIdArg ? eq(programs.id, programIdArg) : eq(programs.countryIso, countryArg));

  if (programRows.length === 0) {
    console.error(
      `No program found for country=${countryArg}${programIdArg ? ` / id=${programIdArg}` : ''}`
    );
    process.exit(1);
  }
  if (programRows.length > 1 && !programIdArg) {
    console.log(`Multiple programs found for ${countryArg}:`);
    programRows.forEach((p, i) => console.log(`  [${i}] ${p.id} — ${p.name}`));
    console.log('Re-run with --programId to pick one.');
    process.exit(1);
  }

  const program = programRows[0]!;
  console.log(`\nProgram: ${program.name} (${program.id})\n`);

  // --- 2. Load Wave 1 field definitions ---
  const allDefs = await db.select().from(fieldDefinitions);
  const wave1Defs = allDefs.filter((d) => ACTIVE_FIELD_CODES.includes(d.key));
  console.log(`Active fields: ${wave1Defs.length}`);

  // --- 3. Find which are empty (no row, or value_raw is null/empty) ---
  const existingFVs = await db
    .select()
    .from(fieldValues)
    .where(
      and(
        eq(fieldValues.programId, program.id),
        inArray(
          fieldValues.fieldDefinitionId,
          wave1Defs.map((d) => d.id)
        )
      )
    );

  const fvByDefId = new Map(existingFVs.map((fv) => [fv.fieldDefinitionId, fv]));

  const emptyDefs = wave1Defs.filter((d) => {
    const fv = fvByDefId.get(d.id);
    if (!fv) return true; // no row at all
    return !fv.valueRaw || fv.valueRaw.trim() === '';
  });

  const filledCount = wave1Defs.length - emptyDefs.length;
  console.log(`Filled: ${filledCount}  |  Empty: ${emptyDefs.length}\n`);

  if (emptyDefs.length === 0) {
    console.log('No empty fields — nothing to diagnose.');
    return;
  }

  // --- 4. Get all source URLs for this program ---
  const sourceRows = await db.select().from(sources).where(eq(sources.programId, program.id));

  const sourceUrls = sourceRows.map((s) => s.url);
  console.log(`Sources for this program: ${sourceUrls.length}`);
  sourceUrls.forEach((u) => console.log(`  ${u}`));
  console.log();

  if (sourceUrls.length === 0) {
    console.log('No sources found for this program — cannot check content.');
    return;
  }

  // --- 5. Fetch scrape_cache for each URL ---
  const cacheRows = await db.select().from(scrapeCache).where(inArray(scrapeCache.url, sourceUrls));

  const cacheByUrl = new Map(cacheRows.map((r) => [r.url, r]));
  console.log(`Scrape cache hits: ${cacheRows.length} / ${sourceUrls.length} URLs\n`);

  const urlsWithContent = cacheRows.map((r) => ({
    url: r.url,
    totalLength: r.contentMarkdown.length,
    isTruncated: r.contentMarkdown.length > MAX_CONTENT_CHARS,
    first30k: r.contentMarkdown.slice(0, MAX_CONTENT_CHARS).toLowerCase(),
    after30k: r.contentMarkdown.slice(MAX_CONTENT_CHARS).toLowerCase(),
  }));

  // --- 6. Diagnose each empty field ---
  const summary: Record<RootCause, string[]> = { TRUNCATION: [], LLM_MISS: [], ABSENT: [] };

  console.log('='.repeat(80));
  console.log('EMPTY FIELD DIAGNOSIS');
  console.log('='.repeat(80));

  for (const def of emptyDefs) {
    const keywords = extractKeywords(def.label);
    const kwPattern = keywords.map((k) => new RegExp(`\\b${k}\\b`, 'i'));

    let bestCause: RootCause = 'ABSENT';
    const urlReports: string[] = [];

    for (const u of urlsWithContent) {
      const foundIn0to30k = kwPattern.some((re) => re.test(u.first30k));
      const foundAfter30k = u.isTruncated && kwPattern.some((re) => re.test(u.after30k));
      const cause = classify(foundIn0to30k, foundAfter30k, u.isTruncated);

      // Upgrade overall cause (TRUNCATION > LLM_MISS > ABSENT)
      if (cause === 'TRUNCATION') bestCause = 'TRUNCATION';
      else if (cause === 'LLM_MISS' && bestCause === 'ABSENT') bestCause = 'LLM_MISS';

      const truncTag = u.isTruncated
        ? `TRUNCATED(${u.totalLength.toLocaleString()})`
        : `ok(${u.totalLength.toLocaleString()})`;
      urlReports.push(
        `    ${u.url.slice(0, 70).padEnd(70)} | len=${truncTag.padEnd(22)} | 0-30k=${foundIn0to30k ? 'YES' : ' no'} | after30k=${foundAfter30k ? 'YES' : ' no'} | → ${cause}`
      );
    }

    // Check cached URLs that weren't in sources (global/country sources)
    for (const [url, cacheRow] of cacheByUrl) {
      if (sourceUrls.includes(url)) continue; // already handled above
      const first30k = cacheRow.contentMarkdown.slice(0, MAX_CONTENT_CHARS).toLowerCase();
      const after30k = cacheRow.contentMarkdown.slice(MAX_CONTENT_CHARS).toLowerCase();
      const isTruncated = cacheRow.contentMarkdown.length > MAX_CONTENT_CHARS;
      const foundIn0to30k = kwPattern.some((re) => re.test(first30k));
      const foundAfter30k = isTruncated && kwPattern.some((re) => re.test(after30k));
      const cause = classify(foundIn0to30k, foundAfter30k, isTruncated);
      if (cause === 'TRUNCATION') bestCause = 'TRUNCATION';
      else if (cause === 'LLM_MISS' && bestCause === 'ABSENT') bestCause = 'LLM_MISS';
      urlReports.push(
        `    [global] ${url.slice(0, 66).padEnd(66)} | len=${isTruncated ? `TRUNCATED(${cacheRow.contentMarkdown.length.toLocaleString()})` : `ok(${cacheRow.contentMarkdown.length.toLocaleString()})`} | 0-30k=${foundIn0to30k ? 'YES' : ' no'} | after30k=${foundAfter30k ? 'YES' : ' no'} | → ${cause}`
      );
    }

    summary[bestCause].push(def.key);

    console.log(`\n[${bestCause}] ${def.key} — ${def.label}`);
    console.log(`  Keywords searched: ${keywords.join(', ')}`);
    urlReports.forEach((r) => console.log(r));
  }

  // --- 7. Summary ---
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(
    `TRUNCATION (${summary.TRUNCATION.length}): ${summary.TRUNCATION.join(', ') || 'none'}`
  );
  console.log(`LLM_MISS   (${summary.LLM_MISS.length}): ${summary.LLM_MISS.join(', ') || 'none'}`);
  console.log(`ABSENT     (${summary.ABSENT.length}): ${summary.ABSENT.join(', ') || 'none'}`);
  console.log();
  if (summary.TRUNCATION.length > 0) {
    console.log('RECOMMENDATION: Implement field-anchored 15K sliding window (Phase 2 Step 2)');
  }
  if (summary.LLM_MISS.length > 0) {
    console.log('RECOMMENDATION: Review extraction prompts for LLM_MISS fields');
  }
  if (summary.ABSENT.length > 0) {
    console.log(
      'RECOMMENDATION: ABSENT fields may need additional source discovery (WGI API, etc.)'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
