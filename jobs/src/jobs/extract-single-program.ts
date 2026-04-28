import { task } from '@trigger.dev/sdk/v3';
import { REQUIRED_ENV_VARS } from '../../trigger.config';
import {
  DEFAULT_URL_CAP,
  DiscoverStageImpl,
  ExtractStageImpl,
  HumanReviewStageImpl,
  PublishStageImpl,
  ScrapeStageImpl,
  ValidateStageImpl,
  deriveA12,
  deriveD22,
  loadProgramSourcesAsDiscovered,
  mergeDiscoveredUrls,
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
import { db, fieldDefinitions, fieldValues } from '@gtmi/db';
import { ACTIVE_FIELD_CODES } from '../../../scripts/wave-config';
import {
  COUNTRY_LEVEL_SOURCES,
  ISO3_TO_ISO2,
  fetchVdemRuleOfLawScore,
  fetchWgiScore,
} from '../../../scripts/country-sources';
import { COUNTRY_MEDIAN_WAGE } from '../../../scripts/country-median-wage';
import { COUNTRY_CITIZENSHIP_RESIDENCE_YEARS } from '../../../scripts/country-citizenship-residence';
import { FX_RATES } from '../../../scripts/fx-rates';
import { and, eq } from 'drizzle-orm';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

// Phase 3.4 / ADR-013 + Phase 3-recanary-prep — Tier 2 backfill fallback.
// Default OFF. Mirrors the canary-run.ts behaviour.
const PHASE3_TIER2_FALLBACK = process.env['PHASE3_TIER2_FALLBACK'] === 'true';
const TIER2_FALLBACK_CONFIDENCE_CAP = 0.85;

// Phase 3.6 / Fix A — E.3.1 V-Dem (WGI Rule of Law) direct fetch gate.
// Default true per analyst Q5 decision. Set PHASE3_VDEM_ENABLED=false to
// disable for staged rollouts.
const PHASE3_VDEM_ENABLED = process.env['PHASE3_VDEM_ENABLED'] !== 'false';

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

    // Phase 3.6 / ADR-015 — merge fresh Stage 0 results with the
    // sources-table registry from prior runs. Self-improving discovery.
    const registryUrls = await loadProgramSourcesAsDiscovered(programId);
    const mergedDiscoveredUrls = mergeDiscoveredUrls({
      freshFromStage0: discoveryResult.discoveredUrls,
      fromSourcesTable: registryUrls,
      cap: DEFAULT_URL_CAP,
    });
    console.log(
      `[Discovery merge] fresh=${discoveryResult.discoveredUrls.length} + registry=${registryUrls.length} → merged=${mergedDiscoveredUrls.length} (cap=${DEFAULT_URL_CAP})`
    );

    // --- Stage 1: Scrape discovered URLs + global country-level sources ---
    const scrape = new ScrapeStageImpl();
    const scrapeResults = await scrape.execute(mergedDiscoveredUrls);
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
    for (const du of mergedDiscoveredUrls) discoveredByUrl.set(du.url, du);

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

    // --- E.3.1: direct World Bank WGI Rule of Law API (Phase 3.6 / Fix A) ---
    // Gated on PHASE3_VDEM_ENABLED. When disabled or fetch returns null,
    // E.3.1 stays in llmFields and goes through normal extraction.
    let e31HandledByVdemPath = false;
    const e31def = allFieldDefs.find((d) => d.key === 'E.3.1');
    if (e31def && PHASE3_VDEM_ENABLED) {
      const vdemResult = await fetchVdemRuleOfLawScore(country);
      if (vdemResult) {
        e31HandledByVdemPath = true;
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
        const iso2 = ISO3_TO_ISO2[country];
        const vdemProvenance: ProvenanceRecord = {
          sourceUrl: iso2
            ? `https://api.worldbank.org/v2/country/${iso2}/indicator/RL.EST?format=json&mrv=1&source=3`
            : 'https://api.worldbank.org/v2/wgi-rl',
          geographicLevel: 'global',
          sourceTier: 1,
          scrapeTimestamp: new Date().toISOString(),
          contentHash: '',
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
        console.log(`  [E.3.1] Published from World Bank WGI Rule of Law API — AUTO-APPROVED`);
      } else {
        console.warn(
          `  [E.3.1] No Rule of Law score available for ${country} — falling through to LLM extraction`
        );
      }
    }

    // --- Stage 2: Batch extract LLM fields. Exclude E.3.2 (always API),
    // E.3.1 (when V-Dem-handled), and A.1.2 / D.2.2 (Phase 3.6 derive
    // stage owns these — see ADR-016). ---
    const DERIVED_FIELD_KEYS = new Set(['A.1.2', 'D.2.2']);
    const llmFields: FieldSpec[] = allFieldDefs
      .filter(
        (d) =>
          d.key !== 'E.3.2' &&
          !(d.key === 'E.3.1' && e31HandledByVdemPath) &&
          !DERIVED_FIELD_KEYS.has(d.key)
      )
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

    // ── Stage 6.5 — Derive (Phase 3.6 / ADR-016). Pure arithmetic; no LLM.
    {
      const fieldDefByKey = new Map(allFieldDefs.map((d) => [d.key, d]));
      async function readApprovedFieldValue(key: string): Promise<{
        valueRaw: string | null;
        valueCurrency: string | null;
        sourceUrl: string | null;
      } | null> {
        const fd = fieldDefByKey.get(key);
        if (!fd) return null;
        const rows = await db
          .select({
            valueRaw: fieldValues.valueRaw,
            provenance: fieldValues.provenance,
            status: fieldValues.status,
          })
          .from(fieldValues)
          .where(
            and(eq(fieldValues.programId, programId), eq(fieldValues.fieldDefinitionId, fd.id))
          )
          .limit(1);
        if (rows.length === 0) return null;
        const row = rows[0]!;
        if (row.status !== 'approved' && row.status !== 'pending_review') return null;
        const prov = (row.provenance ?? {}) as Record<string, unknown>;
        return {
          valueRaw: row.valueRaw,
          valueCurrency:
            typeof prov['valueCurrency'] === 'string' ? (prov['valueCurrency'] as string) : null,
          sourceUrl: typeof prov['sourceUrl'] === 'string' ? (prov['sourceUrl'] as string) : null,
        };
      }
      const lookupExtraction = (key: string) => {
        const r = allExtractionResults.get(key);
        return r && r.output.valueRaw !== '' ? r : null;
      };

      const a11Live = lookupExtraction('A.1.1');
      const a11Db = a11Live ? null : await readApprovedFieldValue('A.1.1');
      const a11ValueRaw = a11Live?.output.valueRaw ?? a11Db?.valueRaw ?? null;
      let a11ValueCurrency: string | null = a11Db?.valueCurrency ?? null;
      if (a11ValueCurrency === null && a11ValueRaw) {
        const m = a11ValueRaw.match(/^([A-Z]{3})\b/);
        if (m && m[1]) a11ValueCurrency = m[1];
      }
      const a11SourceUrl = a11Live?.sourceUrl ?? a11Db?.sourceUrl ?? null;

      const d11Live = lookupExtraction('D.1.1');
      const d11Db = d11Live ? null : await readApprovedFieldValue('D.1.1');
      const d11Raw = d11Live?.output.valueRaw ?? d11Db?.valueRaw ?? null;
      const d11Boolean: boolean | null =
        d11Raw === null ? null : ['true', 'yes', '1'].includes(d11Raw.toLowerCase().trim());

      const d12Live = lookupExtraction('D.1.2');
      const d12Db = d12Live ? null : await readApprovedFieldValue('D.1.2');
      const d12Raw = d12Live?.output.valueRaw ?? d12Db?.valueRaw ?? null;
      const d12Years: number | null = (() => {
        if (d12Raw === null) return null;
        const n = Number.parseFloat(d12Raw.replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? n : null;
      })();
      const d12SourceUrl = d12Live?.sourceUrl ?? d12Db?.sourceUrl ?? null;

      const a12Result = deriveA12({
        programId,
        countryIso: country,
        methodologyVersion: METHODOLOGY_VERSION,
        a11ValueRaw,
        a11ValueCurrency,
        a11SourceUrl,
        medianWage: COUNTRY_MEDIAN_WAGE[country] ?? null,
        fxRate: a11ValueCurrency ? (FX_RATES[a11ValueCurrency.toUpperCase()] ?? null) : null,
      });
      const d22Result = deriveD22({
        programId,
        countryIso: country,
        methodologyVersion: METHODOLOGY_VERSION,
        d11Boolean,
        d12Years,
        d12SourceUrl,
        citizenshipResidence: COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[country] ?? null,
      });

      for (const derived of [a12Result, d22Result]) {
        if (!derived) continue;
        try {
          await publish.executeDerived(derived.extraction, derived.provenance);
          fieldsExtracted++;
          fieldsQueued++;
          console.log(
            `  [${derived.extraction.fieldDefinitionKey}] Derived — pending_review (confidence ${derived.extraction.extractionConfidence})`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `  [${derived.extraction.fieldDefinitionKey}] Derived publish failed: ${msg}`
          );
        }
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
