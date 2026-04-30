import {
  DiscoverStageImpl,
  ExtractStageImpl,
  HumanReviewStageImpl,
  PublishStageImpl,
  ScrapeStageImpl,
  ValidateStageImpl,
  deriveA12,
  deriveB24,
  deriveD12,
  deriveD13,
  deriveD14,
  deriveD22,
  deriveD23,
  deriveD24,
  deriveD31,
  deriveD33,
  dynamicTierQuotas,
  dynamicUrlCap,
  loadArchivedScrape,
  loadFieldUrlYield,
  loadProgramSourcesAsDiscovered,
  loadProvenUrlsForMissingFields,
  mergeDiscoveredUrls,
  planCanaryCost,
  scoreProgramFromDb,
  COUNTRY_CIVIC_TEST_POLICY,
  COUNTRY_DUAL_CITIZENSHIP_POLICY,
  COUNTRY_NON_GOV_COSTS_POLICY,
  COUNTRY_PR_PRESENCE_POLICY,
  COUNTRY_PR_TIMELINE,
  COUNTRY_TAX_BASIS,
  COUNTRY_TAX_RESIDENCY,
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
import { db, fieldDefinitions, fieldValues, programs } from '@gtmi/db';
import { sql } from 'drizzle-orm';
import { ACTIVE_FIELD_CODES } from './wave-config';
import {
  COUNTRY_LEVEL_SOURCES,
  getCountryLevelSources,
  fetchVdemRuleOfLawScore,
  fetchWgiScore,
  ISO3_TO_ISO2,
} from './country-sources';
import {
  COUNTRY_MEDIAN_WAGE,
  COUNTRY_CITIZENSHIP_RESIDENCE_YEARS,
  FX_RATES,
} from '@gtmi/extraction';
import { and } from 'drizzle-orm';
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

// Phase 3.6.2 / ITEM 3 — legacy targeted precision re-run env flag.
// Phase 3.9 / W12 — superseded by `--mode narrow`. Both still honoured;
// the env var is treated as an alias for narrow mode.
const PHASE3_TARGETED_RERUN_ENV = process.env['PHASE3_TARGETED_RERUN'] === 'true';

// Phase 3.9 / W12 + W6 — surgical re-run modes.
//
//   full           = default. live Stage 0 + scrape every merged URL +
//                    extract every active field.
//   discover-only  = live Stage 0 only. No scrape, no extract. Refreshes
//                    the registry + telemetry.
//   narrow         = no Stage 0 (registry + field-proven URLs only).
//                    Extract only the field set still missing from
//                    field_values. Equivalent to legacy
//                    PHASE3_TARGETED_RERUN=true.
//   gate-failed    = no Stage 0. Extract only fields whose existing
//                    field_values row carries a normalizationError or
//                    is otherwise gate-flagged in pending_review state.
//   rubric-changed = no Stage 0. Extract only fields whose
//                    field_definitions row was modified after the row's
//                    last extracted_at — the prompt vocabulary moved.
//   field          = explicit --field A.1.1,B.2.1. Extract only those.
//   archive-first  = (W6) live Stage 0; for each merged URL, prefer
//                    the GCS archive snapshot over a fresh scrape.
//                    Falls back to live scrape when no archive entry
//                    exists. Marks each archive-loaded scrape as
//                    `unchanged: true` so the W11 short-circuit fires
//                    and the LLM batch is skipped.
//   archive-only   = (W6) live Stage 0; STRICT archive — URLs without
//                    an archive entry are skipped (no live fetch,
//                    no LLM cost). For re-extraction after a prompt /
//                    derive change against a known-stable URL set.
type CanaryMode =
  | 'full'
  | 'discover-only'
  | 'narrow'
  | 'gate-failed'
  | 'rubric-changed'
  | 'field'
  | 'archive-first'
  | 'archive-only';

const VALID_MODES: ReadonlySet<CanaryMode> = new Set([
  'full',
  'discover-only',
  'narrow',
  'gate-failed',
  'rubric-changed',
  'field',
  'archive-first',
  'archive-only',
]);

async function main() {
  const countryArgIdx = process.argv.indexOf('--country');
  const countryArg = countryArgIdx !== -1 ? process.argv[countryArgIdx + 1] : undefined;
  if (!countryArg || countryArg.length !== 3) {
    throw new Error('Usage: canary-run.ts --country <ISO3> [--programId <uuid>] [--mode <mode>]');
  }

  const programIdArgIdx = process.argv.indexOf('--programId');
  const programIdArg = programIdArgIdx !== -1 ? process.argv[programIdArgIdx + 1] : undefined;

  // Phase 3.9 / W12 — mode + field-list parsing.
  const modeArgIdx = process.argv.indexOf('--mode');
  const modeArgRaw = modeArgIdx !== -1 ? process.argv[modeArgIdx + 1] : undefined;
  let mode: CanaryMode = 'full';
  if (modeArgRaw) {
    if (!VALID_MODES.has(modeArgRaw as CanaryMode)) {
      throw new Error(
        `--mode "${modeArgRaw}" not recognised. Valid: ${[...VALID_MODES].join(', ')}`
      );
    }
    mode = modeArgRaw as CanaryMode;
  } else if (PHASE3_TARGETED_RERUN_ENV) {
    // Backwards-compat: env var maps to narrow mode.
    mode = 'narrow';
  }

  const fieldArgIdx = process.argv.indexOf('--field');
  const fieldArg = fieldArgIdx !== -1 ? process.argv[fieldArgIdx + 1] : undefined;
  const explicitFieldKeys =
    fieldArg && fieldArg.trim().length > 0
      ? fieldArg
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  if (mode === 'field' && explicitFieldKeys.length === 0) {
    throw new Error('--mode field requires --field <comma-separated keys>');
  }

  // Phase 3.9 / W6 — --estimate-only short-circuits before any LLM
  // call. Computes projected cost from the resolved URL + field set
  // and exits 0. --confirm-cost is the explicit override that
  // bypasses the MAX_RERUN_COST_USD guard.
  const estimateOnly = process.argv.includes('--estimate-only');
  const confirmCost = process.argv.includes('--confirm-cost');
  const maxRerunCostUsdRaw = process.env['MAX_RERUN_COST_USD'];
  const maxRerunCostUsd =
    maxRerunCostUsdRaw && Number.isFinite(Number(maxRerunCostUsdRaw))
      ? Number(maxRerunCostUsdRaw)
      : 5;

  console.log(
    `[Canary mode] ${mode}${mode === 'field' ? ` (${explicitFieldKeys.join(',')})` : ''}` +
      (estimateOnly ? ' [ESTIMATE-ONLY]' : '') +
      (confirmCost ? ' [COST-CONFIRMED]' : '')
  );

  // narrow + targeted_rerun share the same env-flag-based code path
  // already in place below; keep PHASE3_TARGETED_RERUN derived from
  // the resolved mode so all the existing branches still trigger.
  const PHASE3_TARGETED_RERUN = mode === 'narrow';

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

    // Phase 3.6.2 / ITEM 3 — when targeted-rerun is on, compute missing
    // field labels first so we can pass them as a precision brief and
    // exclude the full registry from re-discovery.
    const fieldDefByKeyForBrief = new Map(allFieldDefs.map((d) => [d.key, d]));
    let preDiscoveryMissingKeys: string[] = [];
    if (PHASE3_TARGETED_RERUN) {
      const presentRows = await db.execute<{ key: string }>(sql`
        SELECT fd.key
        FROM field_values fv
        JOIN field_definitions fd ON fd.id = fv.field_definition_id
        WHERE fv.program_id = ${programId}
          AND fv.status IN ('approved', 'pending_review')
          AND (
            fv.value_raw IS NOT NULL AND fv.value_raw <> ''
            OR fv.value_normalized IS NOT NULL
          )
      `);
      const iter = Array.isArray(presentRows)
        ? presentRows
        : ((presentRows as unknown as { rows?: { key: string }[] }).rows ?? []);
      const presentNow = new Set((iter as { key: string }[]).map((r) => r.key));
      preDiscoveryMissingKeys = allFieldDefs.map((d) => d.key).filter((k) => !presentNow.has(k));
    }
    const discoveryOptions = PHASE3_TARGETED_RERUN
      ? {
          excludeAllRegistry: true,
          missingFieldLabels: preDiscoveryMissingKeys
            .map((k) => fieldDefByKeyForBrief.get(k))
            .filter((d): d is NonNullable<typeof d> => d !== undefined)
            .map((d) => `${d.key} — ${d.label}`),
        }
      : undefined;
    if (PHASE3_TARGETED_RERUN) {
      console.log(
        `[Targeted re-run] PHASE3_TARGETED_RERUN=true — precision brief on ${preDiscoveryMissingKeys.length} missing field(s); excluding full registry from new discovery`
      );
    }

    const discoveryResult = await discover.execute(
      programId,
      programName,
      countryIso,
      discoveryOptions
    );
    console.log(`Stage 0 complete: ${discoveryResult.discoveredUrls.length} URLs discovered`);

    // Phase 3.9 / W12 — `discover-only` short-circuit. Stage 0 has
    // already persisted to sources (ADR-015) and written telemetry
    // (W8) inside discover.ts. Nothing more to do for this mode.
    if (mode === 'discover-only') {
      console.log(
        `[Mode discover-only] skipping Stage 1 + Stage 2 for ${programName} (registry + telemetry refreshed)`
      );
      continue;
    }

    // Phase 3.6 / ADR-015 — merge fresh Stage 0 results with the
    // sources-table registry from prior runs. Self-improving discovery:
    // every successful run grows the registry monotonically; subsequent
    // runs benefit from the union.
    //
    // Phase 3.6.2 / ITEMs 4+5 — dynamic cap based on current coverage and
    // proven-URL pre-loading from same-country other-program approved rows.
    const populatedCountRows = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n
      FROM field_values
      WHERE program_id = ${programId}
        AND status IN ('approved', 'pending_review')
        AND (
          value_raw IS NOT NULL AND value_raw <> ''
          OR value_normalized IS NOT NULL
        )
    `);
    const populatedCountIter = Array.isArray(populatedCountRows)
      ? populatedCountRows
      : ((populatedCountRows as unknown as { rows?: { n: number }[] }).rows ?? []);
    const populatedFieldCount = (populatedCountIter[0]?.n ?? 0) as number;
    const cap = dynamicUrlCap(populatedFieldCount);
    const quotas = dynamicTierQuotas(cap);

    // Compute missing field keys for proven-URL pre-loading.
    const presentKeysRows = await db.execute<{ key: string }>(sql`
      SELECT fd.key
      FROM field_values fv
      JOIN field_definitions fd ON fd.id = fv.field_definition_id
      WHERE fv.program_id = ${programId}
        AND fv.status IN ('approved', 'pending_review')
        AND (
          fv.value_raw IS NOT NULL AND fv.value_raw <> ''
          OR fv.value_normalized IS NOT NULL
        )
    `);
    const presentKeysIter = Array.isArray(presentKeysRows)
      ? presentKeysRows
      : ((presentKeysRows as unknown as { rows?: { key: string }[] }).rows ?? []);
    const presentKeys = new Set((presentKeysIter as { key: string }[]).map((r) => r.key));
    const missingFieldKeys = allFieldDefs.map((d) => d.key).filter((k) => !presentKeys.has(k));

    // Phase 3.9 / W12 — surgical re-run filtering. Compute the
    // mode-specific field set that drives both the precision brief
    // (Stage 0 hint) and the LLM extraction filter. Only `narrow` and
    // the gate-failed / rubric-changed / field modes restrict the
    // field set; full re-runs use ACTIVE_FIELD_CODES unchanged.
    let modeFieldSet: Set<string> | null = null;
    if (mode === 'narrow') {
      modeFieldSet = new Set(missingFieldKeys);
    } else if (mode === 'gate-failed') {
      const rows = await db.execute<{ key: string }>(sql`
        SELECT fd.key
        FROM field_values fv
        JOIN field_definitions fd ON fd.id = fv.field_definition_id
        WHERE fv.program_id = ${programId}
          AND fv.status = 'pending_review'
          AND fv.provenance ? 'normalizationError'
          AND (fv.provenance->>'normalizationError') IS NOT NULL
      `);
      const iter = Array.isArray(rows)
        ? rows
        : ((rows as unknown as { rows?: { key: string }[] }).rows ?? []);
      modeFieldSet = new Set((iter as { key: string }[]).map((r) => r.key));
      console.log(`[Mode gate-failed] re-extracting ${modeFieldSet.size} fields with gate flags`);
    } else if (mode === 'rubric-changed') {
      // Re-extract fields where the published attempt's prompt id no
      // longer equals the field_definitions current_prompt_id (the
      // analyst rotated the prompt; existing values are stale).
      const rows = await db.execute<{ key: string }>(sql`
        SELECT DISTINCT fd.key
        FROM extraction_attempts ea
        JOIN field_definitions fd ON fd.id = ea.field_definition_id
        WHERE ea.program_id = ${programId}
          AND ea.was_published = TRUE
          AND fd.current_prompt_id IS NOT NULL
          AND ea.extraction_prompt_id IS DISTINCT FROM fd.current_prompt_id
      `);
      const iter = Array.isArray(rows)
        ? rows
        : ((rows as unknown as { rows?: { key: string }[] }).rows ?? []);
      modeFieldSet = new Set((iter as { key: string }[]).map((r) => r.key));
      console.log(
        `[Mode rubric-changed] re-extracting ${modeFieldSet.size} fields whose prompt has rotated`
      );
    } else if (mode === 'field') {
      modeFieldSet = new Set(explicitFieldKeys);
      console.log(`[Mode field] re-extracting ${modeFieldSet.size} explicit fields`);
    }

    if (modeFieldSet && modeFieldSet.size === 0) {
      console.log(
        `[Canary mode ${mode}] no fields to re-extract for program ${programId} — exiting cleanly`
      );
      continue;
    }

    // Phase 3.7 / ADR-018 — same-programme field-level proven URLs are
    // the highest-priority pre-load. The URL has already produced a
    // value (approved OR pending) for this exact field × programme, so
    // re-running the same URL is the cheapest way to recover.
    const fieldProvenUrls = await loadProvenUrlsForMissingFields(
      programId,
      countryIso,
      missingFieldKeys,
      { sameProgram: true }
    );
    const provenUrls = await loadProvenUrlsForMissingFields(
      programId,
      countryIso,
      missingFieldKeys
    );
    const registryUrls = await loadProgramSourcesAsDiscovered(programId);
    // Phase 3.9 / W10 — yield-ranked merge. Loads per-URL yield scores
    // for the currently-missing fields from the field_url_yield
    // materialized view, then mergeDiscoveredUrls uses them as a
    // secondary sort key within each tier+origin band. URLs that have
    // historically produced more values for the gap fields surface to
    // the front of the scrape order so early-exit kicks in sooner.
    const yieldByUrl = await loadFieldUrlYield(missingFieldKeys);
    const mergedDiscoveredUrls = mergeDiscoveredUrls({
      freshFromStage0: discoveryResult.discoveredUrls,
      fromFieldProven: fieldProvenUrls,
      fromSourcesTable: registryUrls,
      fromProvenance: provenUrls,
      cap,
      quotas,
      yieldByUrl,
    });
    console.log(
      `[Discovery merge] populated=${populatedFieldCount} → cap=${cap} (quotas T1=${quotas[1]} T2=${quotas[2]} T3=${quotas[3]})`
    );
    console.log(
      `[Discovery merge] fresh=${discoveryResult.discoveredUrls.length} + fieldProven=${fieldProvenUrls.length} + registry=${registryUrls.length} + proven=${provenUrls.length} → merged=${mergedDiscoveredUrls.length} (yieldByUrl=${yieldByUrl.size} URLs ranked)`
    );

    console.log('Discovered URLs (post-merge):');
    for (const url of mergedDiscoveredUrls) {
      console.log(`  [Tier ${url.tier}][${url.geographicLevel}] ${url.url}`);
    }

    // Phase 3.9 / W6 — pre-flight cost estimate. Counts URLs that
    // would hit the LLM batch (excluding archive-loaded "unchanged"
    // URLs in archive-first/only mode), then multiplies by per-call
    // cost from cost-estimate.ts.
    //
    // For archive-first/only modes, we pre-load the archive results
    // once into archivedByUrl and reuse them in the scrape loop below
    // so the GCS download fires only once per URL.
    const isArchiveMode = mode === 'archive-first' || mode === 'archive-only';
    const archivedByUrl = new Map<string, ScrapeResult>();
    if (isArchiveMode) {
      for (const u of mergedDiscoveredUrls) {
        const a = await loadArchivedScrape({ programId, url: u.url });
        if (a) archivedByUrl.set(u.url, a);
      }
    }
    const archiveHitsForEstimate = archivedByUrl.size;
    const llmFieldCountForEstimate =
      modeFieldSet === null ? allFieldDefs.length : modeFieldSet.size;
    const estimate = planCanaryCost({
      mode,
      mergedUrls: mergedDiscoveredUrls,
      archiveHitUrls: archiveHitsForEstimate,
      llmFieldCount: llmFieldCountForEstimate,
      tier2EligibleFields: PHASE3_TIER2_FALLBACK ? llmFieldCountForEstimate : 0,
      translationCandidateUrls: 0, // unknown until scrape runs; defer
    });
    console.log(
      `[Cost estimate] $${estimate.total.toFixed(2)} ` +
        `(discovery=${estimate.breakdown.discovery.toFixed(2)} ` +
        `extraction=${estimate.breakdown.batchExtraction.toFixed(2)} ` +
        `tier2=${estimate.breakdown.tier2Fallback.toFixed(2)} ` +
        `validation=${estimate.breakdown.validation.toFixed(2)})` +
        (isArchiveMode
          ? ` | archive hits ${archiveHitsForEstimate}/${mergedDiscoveredUrls.length}`
          : '')
    );
    if (estimate.warning) console.warn(`[Cost estimate] WARNING: ${estimate.warning}`);

    if (estimateOnly) {
      console.log(`[--estimate-only] dry-run complete; exiting before any LLM call.`);
      continue;
    }
    if (estimate.total > maxRerunCostUsd && !confirmCost) {
      throw new Error(
        `[Cost guard] estimated $${estimate.total.toFixed(2)} > MAX_RERUN_COST_USD=$${maxRerunCostUsd}. ` +
          `Re-run with --confirm-cost to proceed, or raise the env var.`
      );
    }

    // Phase 2: Stage 1 — scrape program-specific URLs
    // Phase 3.9 / W0 — pass programId/countryIso so scrape.ts archives
    // each successful scrape to GCS + scrape_history. Failures are
    // non-fatal; result.scrapeHistoryId / result.archivePath are set
    // when the archive write succeeds.
    // Phase 3.9 / W6 — archive-first / archive-only modes prefer the
    // GCS snapshot over a live scrape. archive-only skips URLs not in
    // the archive (no live fetch); archive-first falls back to live
    // when archive misses.
    const scrapeResults: ScrapeResult[] = [];
    let archiveMissesSkipped = 0;
    for (const u of mergedDiscoveredUrls) {
      if (isArchiveMode) {
        const archived = archivedByUrl.get(u.url);
        if (archived) {
          scrapeResults.push(archived);
          console.log(
            `  [Stage 1] Archive hit: ${u.url} (${archived.contentMarkdown.length} chars, hash ${archived.contentHash.slice(0, 8)}…)`
          );
          continue;
        }
        if (mode === 'archive-only') {
          archiveMissesSkipped++;
          console.log(`  [Stage 1] Archive miss (skipped per --mode archive-only): ${u.url}`);
          continue;
        }
        console.log(`  [Stage 1] Archive miss; falling back to live scrape: ${u.url}`);
      }
      console.log(`  [Stage 1] Scraping: ${u.url}`);
      const [result] = await scrape.execute([u], { programId, countryIso });
      if (result) {
        scrapeResults.push(result);
        console.log(
          `  [Stage 1] Done: ${u.url} (HTTP ${result.httpStatus}, ${result.contentMarkdown.length} chars)`
        );
      }
    }
    if (isArchiveMode) {
      console.log(
        `[Mode ${mode}] archive hits: ${archivedByUrl.size}/${mergedDiscoveredUrls.length}` +
          (mode === 'archive-only' ? ` | skipped ${archiveMissesSkipped} archive misses` : '')
      );
    }
    console.log(`Stage 1 complete: ${scrapeResults.length} URLs scraped`);

    const scrapeByUrl = new Map<string, ScrapeResult>();
    for (const sr of scrapeResults) scrapeByUrl.set(sr.url, sr);

    const discoveredByUrl = new Map<string, DiscoveredUrl>();
    for (const du of mergedDiscoveredUrls) discoveredByUrl.set(du.url, du);

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
    // A.1.2 and D.2.2 are computed by the derive stage (Phase 3.6 / ADR-016)
    // — exclude them too so the LLM doesn't produce a competing low-
    // confidence row that would overwrite the derived row.
    const e31HandledByVdemPath = PHASE3_VDEM_ENABLED && vdemResult !== null;
    // Phase 3.6.1 / FIX 6 — D.2.3 added to derived field keys (handled by
    // deriveD23 against the country dual-citizenship policy lookup).
    const DERIVED_FIELD_KEYS = new Set([
      'A.1.2',
      'D.1.2',
      'D.2.2',
      'D.2.3',
      'B.2.4',
      'D.1.3',
      'D.1.4',
    ]);
    // Phase 3.9 / W12 — modeFieldSet supersedes the legacy
    // targetedMissingSet. Both `narrow` and the gate-failed /
    // rubric-changed / field modes restrict the LLM batch.
    const targetedMissingSet = modeFieldSet;
    const llmFields: FieldSpec[] = allFieldDefs
      .filter(
        (d) =>
          d.key !== 'E.3.2' &&
          !(d.key === 'E.3.1' && e31HandledByVdemPath) &&
          !DERIVED_FIELD_KEYS.has(d.key) &&
          (targetedMissingSet === null || targetedMissingSet.has(d.key))
      )
      .map((d) => ({ key: d.key, promptMd: d.extractionPromptMd, label: d.label }));
    if (targetedMissingSet) {
      console.log(`[Mode ${mode}] LLM extraction filtered to ${llmFields.length} field(s)`);
    }

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

    // ── Stage 6.5 — Derive (Phase 3.6 / ADR-016). Pure arithmetic; no LLM.
    // Computes A.1.2 and D.2.2 from already-extracted inputs + static
    // lookup tables. Skip conditions return null and emit a one-line log.
    // Successful derived rows are written to field_values with
    // status='pending_review' (confidence 0.6, never auto-approves).
    {
      // Resolve A.1.1 / D.1.1 / D.1.2 from the extraction map first; fall
      // back to existing approved field_values rows if the current run
      // didn't re-extract them.
      const lookupExtraction = (key: string) => {
        const r = allExtractionResults.get(key);
        return r && r.output.valueRaw !== '' ? r : null;
      };

      const fieldDefByKey = new Map(allFieldDefs.map((d) => [d.key, d]));
      async function readApprovedFieldValue(key: string): Promise<{
        valueRaw: string | null;
        valueCurrency: string | null;
        sourceUrl: string | null;
        sourceSentence: string | null;
        valueNormalized: unknown;
      } | null> {
        const fd = fieldDefByKey.get(key);
        if (!fd) return null;
        const rows = await db
          .select({
            valueRaw: fieldValues.valueRaw,
            provenance: fieldValues.provenance,
            valueNormalized: fieldValues.valueNormalized,
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
          sourceSentence:
            typeof prov['sourceSentence'] === 'string' ? (prov['sourceSentence'] as string) : null,
          valueNormalized: row.valueNormalized,
        };
      }

      // A.1.1 — prefer this run's extraction; fall back to DB.
      const a11Live = lookupExtraction('A.1.1');
      const a11Db = a11Live ? null : await readApprovedFieldValue('A.1.1');
      const a11ValueRaw = a11Live?.output.valueRaw ?? a11Db?.valueRaw ?? null;
      // The live extraction map doesn't carry valueCurrency directly; the
      // currency is detected at publish-time. For derive's purposes we read
      // it from the DB row when available; if A.1.1 was just freshly
      // extracted this run and has not yet been published, fall back to
      // string-prefix detection on the raw value.
      let a11ValueCurrency: string | null = a11Db?.valueCurrency ?? null;
      if (a11ValueCurrency === null && a11ValueRaw) {
        const m = a11ValueRaw.match(/^([A-Z]{3})\b/);
        if (m && m[1]) a11ValueCurrency = m[1];
      }
      const a11SourceUrl = a11Live?.sourceUrl ?? a11Db?.sourceUrl ?? null;
      // Phase 3.6.5 — A.1.1 source sentence drives monthly/annual unit
      // detection in deriveA12.
      const a11SourceSentence: string | null =
        a11Live?.output.sourceSentence ?? a11Db?.sourceSentence ?? null;

      // Phase 3.6.6 / FIX 1 — A.1.3 raw value, country-agnostic gate
      // for the points-based not_applicable branch in deriveA12.
      const a13Live = lookupExtraction('A.1.3');
      const a13Db = a13Live ? null : await readApprovedFieldValue('A.1.3');
      const a13ValueRaw: string | null = a13Live?.output.valueRaw ?? a13Db?.valueRaw ?? null;

      // D.1.1 — boolean.
      const d11Live = lookupExtraction('D.1.1');
      const d11Db = d11Live ? null : await readApprovedFieldValue('D.1.1');
      const d11Raw = d11Live?.output.valueRaw ?? d11Db?.valueRaw ?? null;
      const d11Boolean: boolean | null =
        d11Raw === null ? null : ['true', 'yes', '1'].includes(d11Raw.toLowerCase().trim());

      // D.1.2 — years to PR. Phase 3.6.4 / FIX 2: D.1.2 is now derived
      // from COUNTRY_PR_TIMELINE rather than LLM-extracted (unreliable
      // because the rule lives on PR-authority pages, not the visa page).
      // The derived D.1.2 result feeds deriveD22 below.
      const d12PolicyEntry = COUNTRY_PR_TIMELINE[countryIso] ?? null;
      const d12DerivedResult = deriveD12({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: d12PolicyEntry,
      });
      const d12Years: number | null = d12DerivedResult?.numericValue ?? null;
      const d12SourceUrl: string | null = d12PolicyEntry?.sourceUrl ?? null;

      const a12Result = deriveA12({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        a11ValueRaw,
        a11ValueCurrency,
        a11SourceUrl,
        a11SourceSentence,
        a13ValueRaw,
        medianWage: COUNTRY_MEDIAN_WAGE[countryIso] ?? null,
        fxRate: a11ValueCurrency ? (FX_RATES[a11ValueCurrency.toUpperCase()] ?? null) : null,
      });
      const d22Result = deriveD22({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        d11Boolean,
        d12Years,
        d12SourceUrl,
        citizenshipResidence: COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[countryIso] ?? null,
      });
      // Phase 3.6.1 / FIX 6 — D.2.3 derived-knowledge from country
      // citizenship-policy lookup. Skips when permitted is null.
      const d23Result = deriveD23({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: COUNTRY_DUAL_CITIZENSHIP_POLICY[countryIso] ?? null,
      });

      // Phase 3.6.2 / ITEM 2 — B.2.4 / D.1.3 / D.1.4 country-level derives.
      const b24Result = deriveB24({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: COUNTRY_NON_GOV_COSTS_POLICY[countryIso] ?? null,
      });
      const prPresence = COUNTRY_PR_PRESENCE_POLICY[countryIso] ?? null;
      const d13Result = deriveD13({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: prPresence,
      });
      const d14Result = deriveD14({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: prPresence,
      });

      // Phase 3.9 / W21 — country-level D.2.4 / D.3.1 / D.3.3 derives.
      const d24Result = deriveD24({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: COUNTRY_CIVIC_TEST_POLICY[countryIso] ?? null,
      });
      const d31Result = deriveD31({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: COUNTRY_TAX_RESIDENCY[countryIso] ?? null,
      });
      const d33Result = deriveD33({
        programId,
        countryIso,
        methodologyVersion: METHODOLOGY_VERSION,
        policy: COUNTRY_TAX_BASIS[countryIso] ?? null,
      });

      for (const derived of [
        a12Result,
        d12DerivedResult,
        d22Result,
        d23Result,
        b24Result,
        d13Result,
        d14Result,
        d24Result,
        d31Result,
        d33Result,
      ]) {
        if (!derived) continue;
        try {
          await publish.executeDerived(derived.extraction, derived.provenance);
          fieldsExtracted++;
          fieldsQueued++;
          console.log(
            `  ↳ [${derived.extraction.fieldDefinitionKey}] Derived — pending_review (confidence ${derived.extraction.extractionConfidence})`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `  ↳ [${derived.extraction.fieldDefinitionKey}] Derived publish failed: ${msg}`
          );
        }
      }
    }

    // ── Country-substitute fallback: write synthetic rows for empty
    //    `country_substitute_regional` fields when a regional default exists.
    //    Phase 3.5 / ADR-014. Auto-approved (no review queue).
    //
    // Phase 3.6.6 / FIX 2 — substitute gate. Two reasons to skip:
    //   1. Empty / coverage-gap sentinel extraction (`''`,
    //      `not_addressed`, `not_found`, `not_stated`) — substitute always
    //      fires.
    //   2. Low-confidence LLM extraction (< auto-approve threshold) is
    //      noise (the answer isn't on visa pages, so the LLM tends to
    //      hallucinate at ~0.3) — substitute also fires. Only a
    //      high-confidence (≥ 0.85) extraction wins over the regional
    //      default. Without this, a stale cache hit like C.3.2 ↦
    //      "full_access" (conf 0.3) suppresses substitute, and the
    //      per-field publish loop excludes country_substitute_regional
    //      fields, so the row is silently dropped. Country-agnostic.
    const COVERAGE_GAP_SENTINELS = new Set(['not_addressed', 'not_found', 'not_stated', '']);
    const SUBSTITUTE_GATE_CONFIDENCE = 0.85;
    for (const def of allFieldDefs) {
      if (def.normalizationFn !== 'country_substitute_regional') continue;
      const r = allExtractionResults.get(def.key);
      const extractedRaw = r?.output.valueRaw.trim().toLowerCase() ?? '';
      const extractedConf = r?.output.extractionConfidence ?? 0;
      const isCoverageGap = COVERAGE_GAP_SENTINELS.has(extractedRaw);
      const isHighConfidence = extractedConf >= SUBSTITUTE_GATE_CONFIDENCE;
      if (r && !isCoverageGap && isHighConfidence) continue; // genuine, high-confidence extraction wins
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
        // Phase 3.9 / W7 — let humanReview.enqueue propagate the
        // archive path through to field_values for queued rows.
        ...(winningScrape.archivePath ? { archivePath: winningScrape.archivePath } : {}),
        // Phase 3.9 / W2 — translation provenance lets /review render
        // the "Translated from {lang}" banner so the analyst knows to
        // verify the source sentence against the original-language page.
        ...(winningScrape.translatedFrom
          ? {
              translatedFrom: winningScrape.translatedFrom,
              translationVersion: winningScrape.translationVersion,
            }
          : {}),
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
        // Phase 3.9 / W7 — propagate the GCS snapshot path so /review
        // and the public detail drawer can fall back to a signed URL
        // when the live sourceUrl returns 404.
        ...(winningScrape.archivePath ? { archivePath: winningScrape.archivePath } : {}),
        // Phase 3.9 / W2 — translation provenance.
        ...(winningScrape.translatedFrom
          ? {
              translatedFrom: winningScrape.translatedFrom,
              translationVersion: winningScrape.translationVersion,
            }
          : {}),
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
      'URLs merged (fresh + registry)': mergedDiscoveredUrls.length,
      'URLs scraped': scrapeResults.length,
      'Fields extracted': fieldsExtracted,
      'Fields auto-approved': fieldsAutoApproved,
      'Fields queued for review': fieldsQueued,
    });

    // Phase 3.8 / ADR-022 — auto-refresh the programme-level composite
    // so the public dashboard reflects this canary's scrape +
    // extraction without a manual /review click. Skipped silently if
    // the programme has no approved rows yet (low-coverage canary; the
    // next run will fix it once auto-approve produces approved rows).
    try {
      const r = await scoreProgramFromDb(programId);
      console.log(
        `\n[Auto-rescore] ${r.programName}: composite=${r.engine.compositeScore.toFixed(2)} ` +
          `paq=${r.engine.paqScore.toFixed(2)} cme=${r.engine.cmeScore.toFixed(2)} ` +
          `coverage=${r.engine.populatedFieldCount}/${r.engine.activeFieldCount} ` +
          `flagged=${r.engine.flaggedInsufficientDisclosure}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`\n[Auto-rescore] skipped for ${programName}: ${msg}`);
    }

    // Phase 3.9 / W10 — refresh the field_url_yield materialized view
    // so the next run's URL-merge ranker sees this canary's attempts.
    // CONCURRENTLY allows readers to query the view during the refresh
    // (requires the unique index from migration 00014). Best-effort;
    // failures log but do not crash the canary.
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY field_url_yield`);
      console.log('[field_url_yield] refresh complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[field_url_yield] refresh failed: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
