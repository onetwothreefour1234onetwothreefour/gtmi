import {
  CrossCheckStageImpl,
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
  ProvenanceRecord,
  ScrapeResult,
} from '@gtmi/extraction';
import { db, fieldDefinitions, programs } from '@gtmi/db';
import { WAVE_1_ENABLED, WAVE_1_FIELD_CODES } from './wave-config';
import { COUNTRY_LEVEL_SOURCES, getCountryLevelSources } from './country-sources';
import { and, eq, ilike } from 'drizzle-orm';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

function selectTier2ForField(
  fieldLabel: string,
  tier2Urls: DiscoveredUrl[],
  scrapeByUrl: Map<string, ScrapeResult>
): ScrapeResult | null {
  const valid: Array<{ discovered: DiscoveredUrl; scrape: ScrapeResult }> = [];
  for (const u of tier2Urls) {
    const scrape = scrapeByUrl.get(u.url);
    if (scrape && scrape.httpStatus !== 0 && scrape.contentMarkdown !== '') {
      valid.push({ discovered: u, scrape });
    }
  }
  if (valid.length === 0) return null;

  const keywords = fieldLabel
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let bestScore = 0;
  let bestIdx = 0;
  for (let i = 0; i < valid.length; i++) {
    const reason = valid[i].discovered.reason.toLowerCase();
    const score = keywords.filter((kw) => reason.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore === 0) {
    console.warn(
      `  ↳ Cross-check Tier 2: no relevant source for "${fieldLabel}" — falling back to ${valid[0].discovered.url}`
    );
    return valid[0].scrape;
  }

  const selected = valid[bestIdx];
  const matched = keywords.filter((kw) => selected.discovered.reason.toLowerCase().includes(kw));
  console.log(
    `  ↳ Cross-check Tier 2 selected: ${selected.discovered.url} (matched: ${matched.join(', ')})`
  );
  return selected.scrape;
}

async function main() {
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
    const [result] = await scrape.execute([u]);
    if (result) {
      globalScrapeResults.push(result);
      console.log(`  [Phase 1] Done: ${u.url} (${result.contentMarkdown.length} chars)`);
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

  // --- Find target programs ---
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
  const ausProgram = ausRows[0]!;

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
  const sgpProgram = sgpRows[0]!;

  const CANARY_TARGETS = [ausProgram, sgpProgram];

  // --- Shared stages (initialized once) ---
  const extract = new ExtractStageImpl(fieldPrompts);
  const validate = new ValidateStageImpl();
  const crossCheckStage = new CrossCheckStageImpl();
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

    const tier1Scrapes = scrapeResults
      .filter((sr) => discoveredByUrl.get(sr.url)?.tier === 1)
      .slice(0, 5);

    const tier2DiscoveredUrls = discoveryResult.discoveredUrls.filter((u) => u.tier === 2);

    let fieldsExtracted = 0;
    let fieldsAutoApproved = 0;
    let fieldsQueued = 0;

    // Per-field pipeline loop
    for (const def of allFieldDefs) {
      console.log(
        `[${allFieldDefs.indexOf(def) + 1}/${allFieldDefs.length}] Processing field: ${def.key} — ${def.label}`
      );

      // Global sources for this field
      const globalFieldScrapes = globalSourcesByField.get(def.key) ?? [];
      if (globalFieldScrapes.length > 0) {
        for (const gs of globalFieldScrapes) {
          console.log(`  ↳ [${def.key}] Using global source: ${gs.url}`);
        }
      }

      // Program-specific tier 1 first (primary), global sources appended (supplementary)
      const scrapeInputs = [...tier1Scrapes, ...globalFieldScrapes];

      let extractionResult: { output: ExtractionOutput; sourceUrl: string };
      try {
        console.log(`  ↳ [${def.key}] Calling extraction model...`);
        extractionResult = await extract.executeMulti(scrapeInputs, def.key, programId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ↳ [${def.key}] Extraction failed — skipping: ${msg}`);
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

      // Tier 1 rate limit: 30K input tokens/min for Sonnet.
      // With 30K char content (~7.5K tokens) × up to 5 scrapes per field,
      // plus validation and cross-check calls, we need ~25s between fields
      // to stay under the limit. This is slow but correct for canary.
      console.log(`  ↳ Rate limit delay: waiting 25s before next field...`);
      await new Promise((resolve) => setTimeout(resolve, 25000));

      fieldsExtracted++;

      // winningScrape may come from program-specific or global scrapes
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

      let crossCheck: CrossCheckResult;
      let crossCheckOutcome: CrossCheckOutcome;

      // Cross-check: program-specific Tier 2 first; fall back to global if none
      const fieldTier2Scrape = selectTier2ForField(def.label, tier2DiscoveredUrls, scrapeByUrl);
      const effectiveCrossCheckScrape = fieldTier2Scrape ?? globalFieldScrapes[0] ?? null;
      if (effectiveCrossCheckScrape !== null) {
        if (!fieldTier2Scrape && globalFieldScrapes.length > 0) {
          console.log(`  ↳ Cross-check using global fallback: ${effectiveCrossCheckScrape.url}`);
        }
        console.log(`  ↳ [${def.key}] Calling cross-check model...`);
        crossCheck = await crossCheckStage.execute(extraction, effectiveCrossCheckScrape);
        crossCheckOutcome = crossCheck.agrees ? 'agree' : 'disagree';
      } else {
        crossCheck = { agrees: true, tier2Url: '', notes: 'No Tier 2 source discovered' };
        crossCheckOutcome = 'not_checked';
      }
      console.log(`  ↳ Cross-check: ${crossCheckOutcome}`);

      const isAutoApproved =
        extraction.extractionConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        validation.isValid &&
        validation.validationConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        (crossCheck.agrees || crossCheckOutcome === 'not_checked');

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
        crossCheckUrl: effectiveCrossCheckScrape?.url ?? null,
        reviewedBy: 'auto',
        reviewedAt: new Date(),
        methodologyVersion: METHODOLOGY_VERSION,
        reviewDecision: 'approve',
      };

      await publish.execute(extraction, validation, provenance);
      fieldsAutoApproved++;
      console.log(`  Published field "${def.key}"`);
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
