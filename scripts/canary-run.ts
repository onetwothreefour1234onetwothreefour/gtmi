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
import { ACTIVE_FIELD_CODES } from './wave-config';
import {
  COUNTRY_LEVEL_SOURCES,
  getCountryLevelSources,
  fetchVdemRuleOfLawScore,
  fetchWgiScore,
  ISO3_TO_ISO2,
} from './country-sources';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

// Phase 3.4 / ADR-013 + Phase 3-recanary-prep — Tier 2 backfill fallback.
// Default OFF. When true, the tier-2 fallback pass is restricted to
// `field_definitions.tier2_allowed = true` fields, results are confidence-
// capped at 0.85 (so they always route to /review per ADR-013), and the
// provenance `sourceTier` is set to 2.
const PHASE3_TIER2_FALLBACK = process.env['PHASE3_TIER2_FALLBACK'] === 'true';
const TIER2_FALLBACK_CONFIDENCE_CAP = 0.85;

// Phase 3.6 / Fix A — E.3.1 V-Dem (WGI Rule of Law) direct fetch gate.
// Default true per analyst Q5 decision (methodology requires E.3.1).
// Set PHASE3_VDEM_ENABLED=false to disable for staged rollouts.
const PHASE3_VDEM_ENABLED = process.env['PHASE3_VDEM_ENABLED'] !== 'false';

async function main() {
  const countryArgIdx = process.argv.indexOf('--country');
  const countryArg = countryArgIdx !== -1 ? process.argv[countryArgIdx + 1] : undefined;
  if (!countryArg || countryArg.length !== 3) {
    throw new Error('Usage: canary-run.ts --country <ISO3> [--programId <uuid>]');
  }

  const programIdArgIdx = process.argv.indexOf('--programId');
  const programIdArg = programIdArgIdx !== -1 ? process.argv[programIdArgIdx + 1] : undefined;

  // --- Shared: load field definitions + wave filter ---
  let allFieldDefs = await db.select().from(fieldDefinitions);
  const fieldPrompts = new Map<string, string>();
  for (const def of allFieldDefs) fieldPrompts.set(def.key, def.extractionPromptMd);
  allFieldDefs = allFieldDefs.filter((def) => ACTIVE_FIELD_CODES.includes(def.key));
  console.log(
    `Active wave config — running ${allFieldDefs.length} of 48 fields (codes from ACTIVE_FIELD_CODES)`
  );
  console.log(`Pre-loop: ${allFieldDefs.length} field definitions loaded`);

  const scrape = new ScrapeStageImpl();

  // --- Phase 1: scrape global/country-level sources once (shared across targets) ---
  console.log('\nPhase 1: Loading global/country-level sources');

  // Include global sources + country-specific national sources for this run's country.
  const applicableGlobalSources = COUNTRY_LEVEL_SOURCES.filter(
    (s) => !s.country || s.country === countryArg
  );
  const globalDiscoveredUrls: DiscoveredUrl[] = applicableGlobalSources.map((s) => ({
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
    const sources = getCountryLevelSources(def.key, countryArg);
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

  // --- Phase 1: pre-fetch V-Dem (WGI Rule of Law) score for E.3.1.
  // Gated on PHASE3_VDEM_ENABLED. When disabled, E.3.1 falls through to
  // the LLM extraction batch (legacy behaviour).
  let vdemResult: Awaited<ReturnType<typeof fetchVdemRuleOfLawScore>> = null;
  if (PHASE3_VDEM_ENABLED) {
    console.log('\nPhase 1: Fetching V-Dem / WGI Rule of Law score for E.3.1...');
    vdemResult = await fetchVdemRuleOfLawScore(countryArg);
    if (vdemResult) {
      console.log(
        `  [VDEM/WGI-RL] ${countryArg}: score=${vdemResult.score}, year=${vdemResult.year}`
      );
    } else {
      console.warn(`  [VDEM/WGI-RL] ${countryArg}: World Bank API returned no Rule of Law score`);
    }
  } else {
    console.log(
      '\nPhase 1: PHASE3_VDEM_ENABLED=false — skipping V-Dem fetch; E.3.1 falls through to LLM extraction.'
    );
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
    // Per-country default — prefer a representative program by keyword; fall back to first.
    const defaultKeywords: Record<string, string> = {
      AUS: 'skills in demand',
      SGP: 's pass',
      CAN: 'express entry',
      GBR: 'skilled worker visa',
    };
    const keyword = defaultKeywords[countryArg];
    const allForCountry = await db
      .select()
      .from(programs)
      .where(eq(programs.countryIso, countryArg));
    if (allForCountry.length === 0) {
      throw new Error(`No programs found for country_iso="${countryArg}" in the database.`);
    }
    const matched = keyword
      ? allForCountry.filter((r) => r.name.toLowerCase().includes(keyword))
      : [];
    const selected = (matched.length > 0 ? matched : allForCountry)[0]!;
    console.warn(
      `[Canary] No --programId provided; selected "${selected.name}" (${selected.id}) — pass --programId for deterministic runs.`
    );
    return selected;
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

    const tier2Scrapes = scrapeResults
      .filter((sr) => discoveredByUrl.get(sr.url)?.tier === 2)
      .filter(hasUsableContent);

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

    // E.3.2 (WGI GE.EST) and E.3.1 (WGI RL.EST when PHASE3_VDEM_ENABLED) are
    // handled via direct World Bank API — exclude both from the LLM batch.
    const e31HandledByVdemPath = PHASE3_VDEM_ENABLED && vdemResult !== null;
    const llmFields: FieldSpec[] = allFieldDefs
      .filter((d) => d.key !== 'E.3.2' && !(d.key === 'E.3.1' && e31HandledByVdemPath))
      .map((d) => ({ key: d.key, promptMd: d.extractionPromptMd, label: d.label }));

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

    // ── E.3.1: direct World Bank WGI Rule of Law API (Phase 3.6 / Fix A) ─
    // Gated on PHASE3_VDEM_ENABLED. When disabled, E.3.1 stays in llmFields
    // and goes through normal extraction (which produces empty for ABSENT
    // countries — the legacy behaviour).
    const e31def = allFieldDefs.find((d) => d.key === 'E.3.1');
    if (e31def && PHASE3_VDEM_ENABLED) {
      if (vdemResult) {
        console.log(
          `  ↳ [E.3.1] Using pre-fetched V-Dem/WGI Rule of Law score: ${vdemResult.score} (${vdemResult.year})`
        );
        const vdemExtraction: ExtractionOutput = {
          fieldDefinitionKey: 'E.3.1',
          programId,
          valueRaw: vdemResult.score,
          sourceSentence: `World Bank WGI Rule of Law estimate for ${vdemResult.countryName}: ${vdemResult.score} (${vdemResult.year})`,
          characterOffsets: { start: 0, end: 0 },
          extractionModel: 'v-dem-api-direct',
          extractionConfidence: 1.0,
          extractedAt: new Date(),
        };
        const vdemValidation = {
          isValid: true,
          validationConfidence: 1.0,
          validationModel: 'v-dem-api-direct',
          notes: 'Direct World Bank API source (WGI Rule of Law) — no LLM extraction needed',
        };
        const vdemProvenance: ProvenanceRecord = {
          sourceUrl: `https://api.worldbank.org/v2/country/${ISO3_TO_ISO2[countryArg]}/indicator/RL.EST?format=json&mrv=1&source=3`,
          geographicLevel: 'global',
          sourceTier: 1,
          scrapeTimestamp: new Date().toISOString(),
          contentHash: createHash('sha256')
            .update(`vdem-rl:${vdemResult.score}:${vdemResult.year}:${vdemResult.countryName}`)
            .digest('hex'),
          sourceSentence: vdemExtraction.sourceSentence,
          characterOffsets: { start: 0, end: 0 },
          extractionModel: 'v-dem-api-direct',
          extractionConfidence: 1.0,
          validationModel: 'v-dem-api-direct',
          validationConfidence: 1.0,
          crossCheckResult: 'not_checked',
          crossCheckUrl: null,
          reviewedBy: 'auto',
          reviewedAt: new Date(),
          methodologyVersion: METHODOLOGY_VERSION,
          reviewDecision: 'approve',
        };
        await publish.execute(vdemExtraction, vdemValidation, vdemProvenance);
        fieldsExtracted++;
        fieldsAutoApproved++;
        console.log(`  ↳ [E.3.1] Published — AUTO-APPROVED`);
      } else {
        console.warn(
          `  ↳ [E.3.1] No Rule of Law score available for ${countryArg} — falling through to LLM extraction`
        );
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

    // ── Tier-2 fallback: retry fields that got no result from tier-1 + global ─
    const missingLlmFields = llmFields.filter((f) => {
      const r = allExtractionResults.get(f.key);
      return !r || r.output.valueRaw === '';
    });

    // Phase 3.4 / ADR-013 + Phase 3-recanary-prep: when the flag is ON,
    // restrict tier-2 fallback to indicators with `tier2_allowed = true`
    // and cap output confidence at 0.85 so every tier-2 row routes to
    // /review (never auto-approves). When OFF, preserve Phase 2 behaviour
    // (any missing field can fall through to tier-2 with no cap).
    let tier2EligibleFields = missingLlmFields;
    let tier2ConfidenceCap: number | undefined;
    if (PHASE3_TIER2_FALLBACK) {
      const tier2AllowedSet = new Set(allFieldDefs.filter((d) => d.tier2Allowed).map((d) => d.key));
      tier2EligibleFields = missingLlmFields.filter((f) => tier2AllowedSet.has(f.key));
      tier2ConfidenceCap = TIER2_FALLBACK_CONFIDENCE_CAP;
      console.log(
        `[Tier-2 fallback] PHASE3_TIER2_FALLBACK=true — restricted to ${tier2EligibleFields.length} of ${missingLlmFields.length} missing fields (tier2_allowed=true; cap=${TIER2_FALLBACK_CONFIDENCE_CAP})`
      );
    }

    if (tier2EligibleFields.length > 0 && tier2Scrapes.length > 0) {
      console.log(
        `\n[Tier-2 fallback] ${tier2EligibleFields.length} field(s) missing — retrying with ${tier2Scrapes.length} tier-2 URLs`
      );
      // Extend lookup maps so provenance resolution works for tier-2 sources.
      for (const sr of tier2Scrapes) scrapeByUrl.set(sr.url, sr);
      try {
        const tier2Results = await extract.executeAllFields(
          tier2Scrapes,
          tier2EligibleFields,
          programId,
          programName,
          countryIso,
          tier2ConfidenceCap !== undefined ? { confidenceCap: tier2ConfidenceCap } : undefined
        );
        let tier2Fills = 0;
        for (const [key, result] of tier2Results) {
          if (result.output.valueRaw !== '') {
            allExtractionResults.set(key, result);
            tier2Fills++;
            console.log(
              `  [Tier-2 fill] ${key} — value from ${result.sourceUrl} (confidence ${result.output.extractionConfidence})`
            );
          }
        }
        console.log(
          `[Tier-2 fallback] filled ${tier2Fills}/${tier2EligibleFields.length} missing fields`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Tier-2 fallback] batch failed: ${msg}`);
      }
    }

    // ── Country-substitute fallback: write synthetic rows for empty
    //    `country_substitute_regional` fields when a regional default exists.
    //    Phase 3.5 / ADR-014. Auto-approved (no review queue).
    for (const def of allFieldDefs) {
      if (def.normalizationFn !== 'country_substitute_regional') continue;
      const r = allExtractionResults.get(def.key);
      if (r && r.output.valueRaw !== '') continue; // extracted; no substitution needed
      try {
        const written = await publish.executeCountrySubstitute(
          programId,
          def.key,
          METHODOLOGY_VERSION
        );
        if (written) {
          fieldsExtracted++;
          fieldsAutoApproved++;
          console.log(`  ↳ [${def.key}] Country-substitute applied — AUTO-APPROVED`);
        } else {
          console.log(
            `  ↳ [${def.key}] Country-substitute skipped — no regional default (missing-data penalty applies)`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ↳ [${def.key}] Country-substitute failed: ${msg}`);
      }
    }

    // ── Per-field validation + publish ───────────────────────────────────────
    // Phase 3.5: country_substitute_regional fields are published by
    // executeCountrySubstitute above (or skipped if no regional default).
    // Exclude them from the standard validate-and-publish loop.
    for (const def of allFieldDefs.filter(
      (d) => d.key !== 'E.3.2' && d.normalizationFn !== 'country_substitute_regional'
    )) {
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

      const pendingContext = {
        sourceUrl,
        geographicLevel: winningDiscovered.geographicLevel,
        sourceTier: winningDiscovered.tier,
        scrapeTimestamp: winningScrape.scrapedAt.toISOString(),
        contentHash: winningScrape.contentHash,
        crossCheckResult: crossCheckOutcome,
        crossCheckUrl: null,
        methodologyVersion: METHODOLOGY_VERSION,
      };

      const isAutoApproved =
        extraction.extractionConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        validation.isValid &&
        validation.validationConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD;

      console.log(`  ↳ Decision: ${isAutoApproved ? 'AUTO-APPROVED' : 'QUEUED FOR REVIEW'}`);

      if (!isAutoApproved) {
        await humanReview.enqueue(extraction, validation, crossCheck, pendingContext);
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
        await humanReview.enqueue(extraction, validation, crossCheck, pendingContext);
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
