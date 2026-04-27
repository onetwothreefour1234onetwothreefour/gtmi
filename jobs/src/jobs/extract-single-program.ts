import { task } from '@trigger.dev/sdk/v3';
import { REQUIRED_ENV_VARS } from '../../trigger.config';
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
import { db, fieldDefinitions } from '@gtmi/db';
import { ACTIVE_FIELD_CODES } from '../../../scripts/wave-config';
import {
  COUNTRY_LEVEL_SOURCES,
  ISO3_TO_ISO2,
  fetchWgiScore,
} from '../../../scripts/country-sources';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

// Phase 3.4 / ADR-013 + Phase 3-recanary-prep — Tier 2 backfill fallback.
// Default OFF. Mirrors the canary-run.ts behaviour.
const PHASE3_TIER2_FALLBACK = process.env['PHASE3_TIER2_FALLBACK'] === 'true';
const TIER2_FALLBACK_CONFIDENCE_CAP = 0.85;

interface PipelineResult {
  programId: string;
  urlsDiscovered: number;
  urlsScraped: number;
  fieldsExtracted: number;
  fieldsAutoApproved: number;
  fieldsQueued: number;
}

export const extractSingleProgram = task({
  id: 'extract-single-program',
  run: async (payload: {
    programId: string;
    programName: string;
    country: string;
  }): Promise<PipelineResult> => {
    const { programId, programName, country } = payload;

    // Fail fast if any required env var is missing — surfaces config issues early.
    const missingVars = REQUIRED_ENV_VARS.filter((v: string) => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
          `Set them in the Trigger.dev dashboard under Project → Environment Variables.`
      );
    }

    let allFieldDefs = await db.select().from(fieldDefinitions);
    const fieldPrompts = new Map<string, string>();
    for (const def of allFieldDefs) fieldPrompts.set(def.key, def.extractionPromptMd);
    allFieldDefs = allFieldDefs.filter((def) => ACTIVE_FIELD_CODES.includes(def.key));
    console.log(
      `Active wave config — running ${allFieldDefs.length} of 48 fields for ${programId}`
    );

    // --- Stage 0: Discover ---
    const discover = new DiscoverStageImpl();
    const discoveryResult = await discover.execute(programId, programName, country);
    console.log(
      `Stage 0 complete for ${programId}: ${discoveryResult.discoveredUrls.length} URLs discovered`
    );

    // --- Stage 1: Scrape discovered URLs + global country-level sources ---
    const scrape = new ScrapeStageImpl();
    const scrapeResults = await scrape.execute(discoveryResult.discoveredUrls);
    console.log(`Stage 1 complete for ${programId}: ${scrapeResults.length} URLs scraped`);

    const applicableGlobalSources = COUNTRY_LEVEL_SOURCES.filter(
      (s) => !s.country || s.country === country
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
      try {
        const [result] = await scrape.execute([u]);
        if (result && result.contentMarkdown.length > 0) {
          globalScrapeResults.push(result);
          console.log(`  [Global] Scraped: ${u.url} (${result.contentMarkdown.length} chars)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [Global] Skipped ${u.url}: ${msg}`);
      }
    }
    const globalScrapeByUrl = new Map<string, ScrapeResult>();
    for (const sr of globalScrapeResults) globalScrapeByUrl.set(sr.url, sr);

    const scrapeByUrl = new Map<string, ScrapeResult>();
    for (const sr of scrapeResults) scrapeByUrl.set(sr.url, sr);
    const discoveredByUrl = new Map<string, DiscoveredUrl>();
    for (const du of discoveryResult.discoveredUrls) discoveredByUrl.set(du.url, du);

    const hasUsableContent = (sr: ScrapeResult) =>
      sr.httpStatus >= 200 && sr.httpStatus < 400 && sr.contentMarkdown.trim().length > 0;

    const tier1Scrapes = scrapeResults
      .filter((sr) => hasUsableContent(sr) && discoveredByUrl.get(sr.url)?.tier === 1)
      .slice(0, 5);
    const tier2Scrapes = scrapeResults.filter(
      (sr) => hasUsableContent(sr) && discoveredByUrl.get(sr.url)?.tier === 2
    );
    const extractionScrapes =
      tier1Scrapes.length > 0 ? tier1Scrapes : scrapeResults.filter(hasUsableContent).slice(0, 5);

    const allUniqueScrapeUrls = new Set(extractionScrapes.map((s) => s.url));
    const allUniqueScrapes: ScrapeResult[] = [...extractionScrapes];
    for (const sr of globalScrapeResults) {
      if (!hasUsableContent(sr)) continue;
      if (!allUniqueScrapeUrls.has(sr.url)) {
        allUniqueScrapeUrls.add(sr.url);
        allUniqueScrapes.push(sr);
      }
    }

    if (allUniqueScrapes.length === 0) {
      throw new Error(
        `No usable scrape results for program ${programId} — all ${scrapeResults.length} program scrapes and ${globalScrapeResults.length} global scrapes returned empty content`
      );
    }
    console.log(
      `  [Pipeline] Using ${allUniqueScrapes.length} scrapes (${extractionScrapes.length} program, ${globalScrapeResults.length} global)`
    );

    const extract = new ExtractStageImpl(fieldPrompts);
    const validate = new ValidateStageImpl();
    const humanReview = new HumanReviewStageImpl();
    const publish = new PublishStageImpl();

    let fieldsExtracted = 0;
    let fieldsAutoApproved = 0;
    let fieldsQueued = 0;

    // --- E.3.2: direct World Bank WGI API (bypasses LLM) ---
    const e32def = allFieldDefs.find((d) => d.key === 'E.3.2');
    if (e32def) {
      const wgiResult = await fetchWgiScore(country);
      if (wgiResult) {
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
        const iso2 = ISO3_TO_ISO2[country];
        const wgiProvenance: ProvenanceRecord = {
          sourceUrl: iso2
            ? `https://api.worldbank.org/v2/country/${iso2}/indicator/GE.EST?format=json&mrv=1&source=3`
            : 'https://api.worldbank.org/v2/wgi',
          geographicLevel: 'global',
          sourceTier: 1,
          scrapeTimestamp: new Date().toISOString(),
          contentHash: '',
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
        console.log(`  [E.3.2] Published from World Bank API — AUTO-APPROVED`);
      } else {
        console.warn(`  [E.3.2] No WGI score available for ${country} — skipping`);
      }
    }

    // --- Stage 2: Batch extract LLM fields (E.3.2 excluded — sourced via API above) ---
    const llmFields: FieldSpec[] = allFieldDefs
      .filter((d) => d.key !== 'E.3.2')
      .map((d) => ({ key: d.key, promptMd: d.extractionPromptMd, label: d.label }));

    const allExtractionResults = await extract.executeAllFields(
      allUniqueScrapes,
      llmFields,
      programId,
      programName,
      country
    );

    // Tier-2 fallback: retry fields that yielded no value from tier-1 + global sources.
    const missingLlmFields = llmFields.filter((f) => {
      const r = allExtractionResults.get(f.key);
      return !r || r.output.valueRaw === '';
    });

    // Phase 3.4 / ADR-013 + Phase 3-recanary-prep: when the flag is ON,
    // restrict tier-2 fallback to indicators with `tier2_allowed = true`
    // and cap output confidence at 0.85.
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
        `[Tier-2 fallback] ${tier2EligibleFields.length} fields missing — retrying with ${tier2Scrapes.length} tier-2 URLs`
      );
      for (const sr of tier2Scrapes) scrapeByUrl.set(sr.url, sr);
      try {
        const tier2Results = await extract.executeAllFields(
          tier2Scrapes,
          tier2EligibleFields,
          programId,
          programName,
          country,
          tier2ConfidenceCap !== undefined ? { confidenceCap: tier2ConfidenceCap } : undefined
        );
        for (const [key, result] of tier2Results) {
          if (result.output.valueRaw !== '') allExtractionResults.set(key, result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Tier-2 fallback] batch failed: ${msg}`);
      }
    }

    // Phase 3.5 / ADR-014: country-substitute fallback for empty
    // `country_substitute_regional` fields. Auto-approved (no review queue).
    for (const def of allFieldDefs) {
      if (def.normalizationFn !== 'country_substitute_regional') continue;
      const r = allExtractionResults.get(def.key);
      if (r && r.output.valueRaw !== '') continue;
      try {
        const written = await publish.executeCountrySubstitute(
          programId,
          def.key,
          METHODOLOGY_VERSION
        );
        if (written) {
          fieldsExtracted++;
          fieldsAutoApproved++;
          console.log(`  [${def.key}] Country-substitute applied — AUTO-APPROVED`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [${def.key}] Country-substitute failed: ${msg}`);
      }
    }

    // --- Per-field validate + publish (skip country-substitute fields, already published above) ---
    for (const def of allFieldDefs.filter(
      (d) => d.key !== 'E.3.2' && d.normalizationFn !== 'country_substitute_regional'
    )) {
      const extractionResult = allExtractionResults.get(def.key);
      if (!extractionResult) continue;

      const { output: extraction, sourceUrl } = extractionResult;
      if (extraction.valueRaw === '') continue;

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

      const validation = await validate.execute(extraction, winningScrape);

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

      await publish.execute(extraction, validation, provenance);
      fieldsAutoApproved++;
      console.log(`Published field "${def.key}" for program ${programId}`);
    }

    console.log(
      `Pipeline complete for ${programId}: ` +
        `${fieldsExtracted} extracted, ` +
        `${fieldsAutoApproved} auto-approved, ` +
        `${fieldsQueued} queued for review`
    );

    return {
      programId,
      urlsDiscovered: discoveryResult.discoveredUrls.length,
      urlsScraped: scrapeResults.length + globalScrapeResults.length,
      fieldsExtracted,
      fieldsAutoApproved,
      fieldsQueued,
    };
  },
});
