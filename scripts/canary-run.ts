import {
  DiscoverStageImpl,
  ExtractStageImpl,
  HumanReviewStageImpl,
  PublishStageImpl,
  ScrapeStageImpl,
  ValidateStageImpl,
} from '@gtmi/extraction';
import type {
  CrossCheckOutcome,
  CrossCheckResult,
  DiscoveredUrl,
  ExtractionOutput,
  FieldSpec,
  ProvenanceRecord,
  ScrapeResult,
} from '@gtmi/extraction';
import { db, fieldDefinitions, programs } from '@gtmi/db';
import { WAVE_1_ENABLED, WAVE_1_FIELD_CODES } from './wave-config';
import {
  COUNTRY_LEVEL_SOURCES,
  getCountryLevelSources,
  fetchWgiScore,
  ISO3_TO_ISO2,
} from './country-sources';
import { and, eq, ilike } from 'drizzle-orm';
import { createHash } from 'crypto';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

async function main() {
  const countryArgIdx = process.argv.indexOf('--country');
  const countryArg = countryArgIdx !== -1 ? process.argv[countryArgIdx + 1] : undefined;
  if (countryArg !== 'AUS' && countryArg !== 'SGP') {
    throw new Error('Usage: canary-run.ts --country <AUS|SGP> [--programId <uuid>]');
  }

  const programIdArgIdx = process.argv.indexOf('--programId');
  const programIdArg = programIdArgIdx !== -1 ? process.argv[programIdArgIdx + 1] : undefined;

  // --- Shared: load field definitions + wave filter ---
  let allFieldDefs = await db.select().from(fieldDefinitions);
  const fieldPrompts = new Map<string, string>();
  for (const def of allFieldDefs) fieldPrompts.set(def.key, def.extractionPromptMd);
  if (WAVE_1_ENABLED) {
    allFieldDefs = allFieldDefs.filter((def) => WAVE_1_FIELD_CODES.includes(def.key));
    console.log(`Wave 1 active — running ${allFieldDefs.length} of 48 fields`);
  } else {
    console.log(`Wave 1 disabled — running all 48 fields`);
  }
  console.log(`Pre-loop: ${allFieldDefs.length} field definitions loaded`);

  const scrape = new ScrapeStageImpl();

  // --- Phase 1: scrape global/country-level sources once (shared across targets) ---
  console.log('\nPhase 1: Loading global/country-level sources');

  const globalDiscoveredUrls: DiscoveredUrl[] = COUNTRY_LEVEL_SOURCES.map((s) => ({
    url: s.url,
    tier: s.tier,
    geographicLevel: s.geographicLevel,
    reason: s.reason,
    isOfficial: s.tier === 1,
  }));
  const globalScrapeResults: ScrapeResult[] = [];
  for (const u of globalDiscoveredUrls) {
    console.log(`  [Phase 1] Scraping global source: ${u.url}`);
    try {
      const [result] = await scrape.execute([u]);
      if (result) {
        globalScrapeResults.push(result);
        console.log(`  [Phase 1] Done: ${u.url} (${result.contentMarkdown.length} chars)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [Phase 1] Failed (skipping): ${u.url} — ${msg}`);
    }
  }
  const globalScrapeByUrl = new Map<string, ScrapeResult>();
  for (const sr of globalScrapeResults) globalScrapeByUrl.set(sr.url, sr);

  const globalSourcesByField = new Map<string, ScrapeResult[]>();
  for (const def of allFieldDefs) {
    const sources = getCountryLevelSources(def.key);
    if (sources.length === 0) continue;
    const scrapes = sources
      .map((s) => globalScrapeByUrl.get(s.url))
      .filter(
        (sr): sr is ScrapeResult =>
          sr !== undefined && sr.httpStatus !== 0 && sr.contentMarkdown !== ''
      );
    if (scrapes.length > 0) {
      globalSourcesByField.set(def.key, scrapes);
      for (const src of sources) {
        console.log(`  [${def.key}] Global source: ${src.url}`);
      }
    }
  }

  // --- Phase 1: pre-fetch WGI score for target country ---
  console.log('\nPhase 1: Fetching WGI score from World Bank API...');
  const wgiResult = await fetchWgiScore(countryArg);
  if (wgiResult) {
    console.log(`  [WGI] ${countryArg}: score=${wgiResult.score}, year=${wgiResult.year}`);
  } else {
    console.warn(`  [WGI] ${countryArg}: World Bank API returned no score`);
  }

  // --- Find target program for --country argument ---
  const canaryTarget = await (async () => {
    if (programIdArg !== undefined) {
      const rows = await db.select().from(programs).where(eq(programs.id, programIdArg));
      if (rows.length === 0) {
        throw new Error(`No program found with id=${programIdArg}`);
      }
      const row = rows[0]!;
      if (row.countryIso !== countryArg) {
        throw new Error(
          `Program ${programIdArg} has country_iso="${row.countryIso}" but --country="${countryArg}" — mismatch`
        );
      }
      return row;
    }
    if (countryArg === 'AUS') {
      const ausRows = await db
        .select()
        .from(programs)
        .where(and(eq(programs.countryIso, 'AUS'), ilike(programs.name, '%Skills in Demand%')));
      if (ausRows.length === 0) {
        const all = await db.select().from(programs).where(eq(programs.countryIso, 'AUS'));
        throw new Error(
          `No AUS program matching "%Skills in Demand%" found.\nExisting AUS programs:\n${all.map((r) => `  - ${r.name}`).join('\n')}`
        );
      }
      const selected = ausRows[0]!;
      console.warn(
        `[Canary] No --programId provided; selected ${selected.name} (${selected.id}) by ILIKE — consider passing --programId for deterministic runs.`
      );
      return selected;
    } else {
      const sgpRows = await db
        .select()
        .from(programs)
        .where(and(eq(programs.countryIso, 'SGP'), ilike(programs.name, '%S Pass%')));
      if (sgpRows.length === 0) {
        const all = await db.select().from(programs).where(eq(programs.countryIso, 'SGP'));
        throw new Error(
          `No SGP program matching "%S Pass%" found.\nExisting SGP programs:\n${all.map((r) => `  - ${r.name}`).join('\n')}`
        );
      }
      const selected = sgpRows[0]!;
      console.warn(
        `[Canary] No --programId provided; selected ${selected.name} (${selected.id}) by ILIKE — consider passing --programId for deterministic runs.`
      );
      return selected;
    }
  })();

  const CANARY_TARGETS = [canaryTarget];

  // --- Shared stages (initialized once) ---
  const extract = new ExtractStageImpl(fieldPrompts);
  const validate = new ValidateStageImpl();
  const humanReview = new HumanReviewStageImpl();
  const publish = new PublishStageImpl();

  // --- Per-target pipeline ---
  for (const target of CANARY_TARGETS) {
    const { id: programId, name: programName, countryIso } = target;
    console.log(`\n===== CANARY: ${programName} (${countryIso}) =====`);

    // Phase 2: Stage 0 — program-specific discovery
    console.log('\nPhase 2: Discovering program-specific URLs');
    const discover = new DiscoverStageImpl();
    console.log(
      `  [Phase 2] Searching for program-specific URLs for: ${programName} (${countryIso})...`
    );
    const discoveryResult = await discover.execute(programId, programName, countryIso);
    console.log(`Stage 0 complete: ${discoveryResult.discoveredUrls.length} URLs discovered`);
    console.log('Discovered URLs:');
    for (const url of discoveryResult.discoveredUrls) {
      console.log(`  [Tier ${url.tier}][${url.geographicLevel}] ${url.url}`);
    }

    // Phase 2: Stage 1 — scrape program-specific URLs
    const scrapeResults: ScrapeResult[] = [];
    for (const u of discoveryResult.discoveredUrls) {
      console.log(`  [Stage 1] Scraping: ${u.url}`);
      const [result] = await scrape.execute([u]);
      if (result) {
        scrapeResults.push(result);
        console.log(
          `  [Stage 1] Done: ${u.url} (HTTP ${result.httpStatus}, ${result.contentMarkdown.length} chars)`
        );
      }
    }
    console.log(`Stage 1 complete: ${scrapeResults.length} URLs scraped`);

    const scrapeByUrl = new Map<string, ScrapeResult>();
    for (const sr of scrapeResults) scrapeByUrl.set(sr.url, sr);

    const discoveredByUrl = new Map<string, DiscoveredUrl>();
    for (const du of discoveryResult.discoveredUrls) discoveredByUrl.set(du.url, du);

    const hasUsableContent = (sr: ScrapeResult): boolean =>
      sr.httpStatus >= 200 && sr.httpStatus < 400 && sr.contentMarkdown.trim().length > 0;

    const tier1Scrapes = scrapeResults
      .filter((sr) => discoveredByUrl.get(sr.url)?.tier === 1)
      .filter(hasUsableContent)
      .slice(0, 5);

    // Collect all unique scrapes: tier 1 program-specific + all global sources
    // (deduped by URL so the same page isn't sent twice). Drop any scrape that
    // failed or returned empty content so extraction never sees garbage.
    const allScrapeUrls = new Set(tier1Scrapes.map((s) => s.url));
    const allUniqueScrapes: ScrapeResult[] = [...tier1Scrapes];
    for (const sr of globalScrapeResults) {
      if (!hasUsableContent(sr)) {
        console.log(
          `  [Extract gate] Skipping empty/failed scrape: ${sr.url} (HTTP ${sr.httpStatus}, ${sr.contentMarkdown.length} chars)`
        );
        continue;
      }
      if (!allScrapeUrls.has(sr.url)) {
        allScrapeUrls.add(sr.url);
        allUniqueScrapes.push(sr);
      }
    }

    // E.3.2 is handled via direct World Bank API — exclude from LLM batch
    const llmFields: FieldSpec[] = allFieldDefs
      .filter((d) => d.key !== 'E.3.2')
      .map((d) => ({ key: d.key, promptMd: d.extractionPromptMd }));

    let fieldsExtracted = 0;
    let fieldsAutoApproved = 0;
    let fieldsQueued = 0;

    // ── E.3.2: direct World Bank API ────────────────────────────────────────
    const e32def = allFieldDefs.find((d) => d.key === 'E.3.2');
    if (e32def) {
      if (wgiResult) {
        console.log(
          `  ↳ [E.3.2] Using pre-fetched WGI score: ${wgiResult.score} (${wgiResult.year})`
        );
        const wgiExtraction: ExtractionOutput = {
          fieldDefinitionKey: 'E.3.2',
          programId,
          valueRaw: wgiResult.score,
          sourceSentence: `World Bank WGI Government Effectiveness estimate for ${wgiResult.countryName}: ${wgiResult.score} (${wgiResult.year})`,
          characterOffsets: { start: 0, end: 0 },
          extractionModel: 'world-bank-api-direct',
          extractionConfidence: 1.0,
          extractedAt: new Date(),
        };
        const wgiValidation = {
          isValid: true,
          validationConfidence: 1.0,
          validationModel: 'world-bank-api-direct',
          notes: 'Direct World Bank API source — no LLM extraction needed',
        };
        const wgiProvenance: ProvenanceRecord = {
          sourceUrl: `https://api.worldbank.org/v2/country/${ISO3_TO_ISO2[countryArg]}/indicator/GOV_WGI_GE.EST?format=json&mrv=1&source=3`,
          geographicLevel: 'global',
          sourceTier: 1,
          scrapeTimestamp: new Date().toISOString(),
          contentHash: createHash('sha256')
            .update(`wgi:${wgiResult.score}:${wgiResult.year}:${wgiResult.countryName}`)
            .digest('hex'),
          sourceSentence: wgiExtraction.sourceSentence,
          characterOffsets: { start: 0, end: 0 },
          extractionModel: 'world-bank-api-direct',
          extractionConfidence: 1.0,
          validationModel: 'world-bank-api-direct',
          validationConfidence: 1.0,
          crossCheckResult: 'not_checked',
          crossCheckUrl: null,
          reviewedBy: 'auto',
          reviewedAt: new Date(),
          methodologyVersion: METHODOLOGY_VERSION,
          reviewDecision: 'approve',
        };
        await publish.execute(wgiExtraction, wgiValidation, wgiProvenance);
        fieldsExtracted++;
        fieldsAutoApproved++;
        console.log(`  ↳ [E.3.2] Published — AUTO-APPROVED`);
      } else {
        console.warn(`  ↳ [E.3.2] No WGI score available for ${countryArg} — skipping`);
      }
    }

    // ── Batch extraction: all LLM fields across all scrapes ──────────────────
    console.log(
      `\nBatch extraction: ${llmFields.length} fields across ${allUniqueScrapes.length} URLs`
    );
    let allExtractionResults: Map<string, { output: ExtractionOutput; sourceUrl: string }>;
    try {
      allExtractionResults = await extract.executeAllFields(
        allUniqueScrapes,
        llmFields,
        programId,
        programName,
        countryIso
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Batch extraction failed: ${msg}`);
      allExtractionResults = new Map();
    }
    console.log(`Batch extraction complete: ${allExtractionResults.size} fields with values`);

    // ── Per-field validation + publish ───────────────────────────────────────
    for (const def of allFieldDefs.filter((d) => d.key !== 'E.3.2')) {
      console.log(
        `[${allFieldDefs.indexOf(def) + 1}/${allFieldDefs.length}] Processing field: ${def.key} — ${def.label}`
      );

      const extractionResult = allExtractionResults.get(def.key);
      if (!extractionResult) {
        console.log(`  ↳ No value found — skipping`);
        continue;
      }

      const { output: extraction, sourceUrl } = extractionResult;

      if (extraction.valueRaw === '') {
        console.log(`  ↳ No value found — skipping`);
        continue;
      }

      console.log(
        `  ↳ Extracted: "${extraction.valueRaw.substring(0, 60)}..." (confidence: ${extraction.extractionConfidence})`
      );

      fieldsExtracted++;

      const winningScrape = scrapeByUrl.get(sourceUrl) ?? globalScrapeByUrl.get(sourceUrl) ?? null;
      if (!winningScrape) {
        throw new Error(
          `No scrape result found for source URL "${sourceUrl}" on field "${def.key}" — this is a bug`
        );
      }
      const winningDiscovered =
        discoveredByUrl.get(sourceUrl) ??
        globalDiscoveredUrls.find((u) => u.url === sourceUrl) ??
        null;
      if (!winningDiscovered) {
        throw new Error(
          `No discovered URL entry found for source URL "${sourceUrl}" on field "${def.key}" — this is a bug`
        );
      }

      console.log(`  ↳ [${def.key}] Calling validation model...`);
      const validation = await validate.execute(extraction, winningScrape);
      console.log(
        `  ↳ Validation: ${validation.isValid ? 'valid' : 'invalid'} (confidence: ${validation.validationConfidence})`
      );

      const crossCheck: CrossCheckResult = {
        agrees: true,
        tier2Url: '',
        notes: 'Cross-check removed — extraction uses all sources',
      };
      const crossCheckOutcome: CrossCheckOutcome = 'not_checked';

      const isAutoApproved =
        extraction.extractionConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        validation.isValid &&
        validation.validationConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD;

      console.log(`  ↳ Decision: ${isAutoApproved ? 'AUTO-APPROVED' : 'QUEUED FOR REVIEW'}`);

      if (!isAutoApproved) {
        await humanReview.enqueue(extraction, validation, crossCheck);
        fieldsQueued++;
        continue;
      }

      const provenance: ProvenanceRecord = {
        sourceUrl,
        geographicLevel: winningDiscovered.geographicLevel,
        sourceTier: winningDiscovered.tier,
        scrapeTimestamp: winningScrape.scrapedAt.toISOString(),
        contentHash: winningScrape.contentHash,
        sourceSentence: extraction.sourceSentence,
        characterOffsets: extraction.characterOffsets,
        extractionModel: extraction.extractionModel,
        extractionConfidence: extraction.extractionConfidence,
        validationModel: validation.validationModel,
        validationConfidence: validation.validationConfidence,
        crossCheckResult: crossCheckOutcome,
        crossCheckUrl: null,
        reviewedBy: 'auto',
        reviewedAt: new Date(),
        methodologyVersion: METHODOLOGY_VERSION,
        reviewDecision: 'approve',
      };

      try {
        await publish.execute(extraction, validation, provenance);
        fieldsAutoApproved++;
        console.log(`  Published field "${def.key}"`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ↳ Publish failed for ${def.key}: ${msg} — queuing for review instead`);
        await humanReview.enqueue(extraction, validation, crossCheck);
        fieldsQueued++;
      }
    }

    console.log(`\n--- Canary Run Summary: ${programName} (${countryIso}) ---`);
    console.table({
      'URLs discovered': discoveryResult.discoveredUrls.length,
      'URLs scraped': scrapeResults.length,
      'Fields extracted': fieldsExtracted,
      'Fields auto-approved': fieldsAutoApproved,
      'Fields queued for review': fieldsQueued,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
