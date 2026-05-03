export {
  createAnthropicClient,
  MODEL_CROSSCHECK,
  MODEL_EXTRACTION,
  MODEL_VALIDATION,
} from './clients/anthropic';

// Phase 3.10d / C.1 — Exa news-signal client.
export {
  exaSearch,
  exaSearchPublicationWindow,
  isExaConfigured,
  ExaError,
} from './utils/exa-client';
export type { ExaSearchOptions, ExaSearchResponse, ExaResult } from './utils/exa-client';

// Phase 3.10d / C.3 — Wayback Save Page Now client.
export { captureUrl, archiveOnDrift, isWaybackEnabled, WaybackError } from './utils/wayback';
export type { WaybackArchiveResult } from './utils/wayback';

// Phase 3.10d / F.1 — per-LLM-call cost instrumentation.
export {
  LLM_PRICING,
  estimateCallCost,
  recordLlmCall,
  getRunCostAggregate,
  resetRunCostAggregate,
  formatRunCostSummary,
} from './utils/llm-cost';
export type { AnthropicUsage, LlmCallRecord } from './utils/llm-cost';

// Phase 3.10d / F.2 — Sentry-ready error reporter.
export {
  initErrorReporter,
  captureException,
  captureMessage,
  flushErrorReporter,
} from './utils/error-reporter';
export type { ErrorContext } from './utils/error-reporter';
export type { ExtractionModel } from './clients/anthropic';

export type {
  CrossCheckResult,
  DiscoveredUrl,
  DiscoveryResult,
  ExtractionInput,
  ExtractionOutput,
  FieldSpec,
  GeographicLevel,
  ReviewDecision,
  ScrapeResult,
  SourceTier,
  ValidationResult,
} from './types/extraction';

export type { CrossCheckOutcome, ProvenanceRecord } from './types/provenance';

export type {
  CrossCheckStage,
  DeriveStage,
  DeriveStageInputs,
  DiscoverStage,
  ExtractStage,
  ExtractionPipeline,
  HumanReviewStage,
  PublishStage,
  ScrapeStage,
  ValidateStage,
} from './types/pipeline';

export { CrossCheckStageImpl } from './stages/cross-check';
export {
  DERIVE_CONFIDENCE,
  DERIVE_EXTRACTION_MODEL,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  DeriveStageImpl,
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
  deriveE11,
  deriveE13,
} from './stages/derive';
export type {
  CitizenshipResidenceEntry,
  CivicTestPolicyEntry,
  DerivedA12Input,
  DerivedB24Input,
  DerivedD12Input,
  DerivedD13Input,
  DerivedD14Input,
  DerivedD22Input,
  DerivedD23Input,
  DerivedD24Input,
  DerivedD31Input,
  DerivedD33Input,
  DerivedE11Input,
  DerivedE13Input,
  DerivedRow,
  DualCitizenshipPolicyEntry,
  FxRateEntry,
  MedianWageEntry,
  NonGovCostsPolicyEntry,
  PolicyChangeEventEntry,
  PrPresenceFieldEntry,
  PrPresencePolicyEntry,
  PrTimelinePolicyEntry,
  ProgramPolicyHistoryEntry,
  TaxBasisPolicyEntry,
  TaxResidencyPolicyEntry,
} from './stages/derive';
export { DiscoverStageImpl, writeToSourcesTable } from './stages/discover';
export {
  DEFAULT_URL_CAP,
  TIER_QUOTAS,
  dynamicTierQuotas,
  dynamicUrlCap,
  loadFieldUrlYield,
  loadProgramSourcesAsDiscovered,
  loadProvenUrlsForMissingFields,
  mergeDiscoveredUrls,
  normaliseUrl,
} from './utils/url-merge';
export type { DbClient } from './utils/url-merge';
export { HumanReviewStageImpl } from './stages/human-review';
export {
  ExtractStageImpl,
  computeExtractionCacheKey,
  buildFocusedReextractionPrompt,
} from './stages/extract';
export { PublishStageImpl } from './stages/publish';
export { ScrapeStageImpl } from './stages/scrape';
export type { ScrapeContext } from './stages/scrape';
export { ValidateStageImpl } from './stages/validate';
// Phase 3.9 / W0 — archive helpers (used by scrape.ts; exported so
// future callers can archive ad-hoc scrapes outside the canary loop).
export { archiveScrapeResult, EXTRACTOR_VERSION } from './utils/archive';
export type { ArchiveScrapeArgs, ArchiveScrapeResult } from './utils/archive';
// Phase 3.9 / W6 — archive-load (read GCS snapshot back into a ScrapeResult).
export { loadArchivedScrape, loadArchivedScrapes } from './utils/archive-load';
export type { LoadArchivedScrapeArgs } from './utils/archive-load';
// Phase 3.9 / W6 — cost estimator for canary --estimate-only path.
export { COST_MODEL, estimateCanaryCost, planCanaryCost } from './utils/cost-estimate';
export type { CostEstimateInput, CostEstimate } from './utils/cost-estimate';
// Re-export the storage API so consumers (apps/web reextract action)
// can access it without taking a direct workspace dep on @gtmi/storage.
export { getStorage, archivePathFor, contentTypeForExt } from '@gtmi/storage';
export type { StorageImpl, ArchiveDownloadResult, SignedUrlOptions } from '@gtmi/storage';
// Phase 3.9 / W9 — extraction_attempts history. Used by extract.ts for
// per-batch recording and by publish.ts (commit 6) to flip wasPublished.
// W13 — getCurrentPromptId surfaces the cached extraction_prompts.id
// for callers that need to tag attempts explicitly.
export {
  recordAttempt,
  recordAttempts,
  markAttemptPublished,
  clearFieldDefIdCache,
  getCurrentPromptId,
} from './utils/attempts';
export type { RecordAttemptInput } from './utils/attempts';
// Phase 3.9 / W2 — translation pipeline.
export {
  TRANSLATION_VERSION,
  looksLikeNonEnglish,
  getCountryDefaultLanguage,
  translateIfNeeded,
} from './utils/translate';
export type { TranslateResult } from './utils/translate';
// Phase 3.9 / W8 — discovery telemetry writer.
export { writeDiscoveryTelemetry } from './utils/telemetry';
export type { WriteDiscoveryTelemetryArgs } from './utils/telemetry';
// Phase 3.9 / W15+W16 — blocker detector + Wayback-first routing.
export {
  BLOCKER_THIN_THRESHOLD,
  RunBlockerState,
  recordBlockerDomain,
  clearBlockerStateForTest,
} from './utils/blocker-detect';
export type { BlockerSignal } from './utils/blocker-detect';
export { scoreProgramFromDb } from './utils/score-program';
export type { ScoreProgramOptions, ScoreProgramResult } from './utils/score-program';
// Phase 3.10c.6 — Resend alerts (Phase 6 plumbing).
export { sendDailyDigest, loadDigestEvents, renderDigestBody } from './utils/resend-alerts';
export type { DigestEvent, DigestMode, DigestResult } from './utils/resend-alerts';
// Phase 3.10d / B.1 — calibration helper (Phase 5 prereq).
export {
  CALIBRATION_MIN_PROGRAMMES,
  computeCalibratedParams,
  persistCalibratedParams,
  loadCalibratedParams,
} from './utils/calibration';
export type { CalibrationParams } from './utils/calibration';

// Phase 3.6 / ADR-016 — static lookup tables for the derive stage.
// Re-exported from `packages/extraction/src/data/` (moved from `scripts/`
// in the typecheck-fix commit so cross-package tsc respects rootDir).
export * from './data/country-median-wage';
export * from './data/fx-rates';
export * from './data/country-citizenship-residence';
// Phase 3.6.1 / FIX 6 — dual-citizenship lookup for D.2.3 derive.
export * from './data/country-citizenship-policy';
// Phase 3.6.2 / ITEM 2 — country-level lookups for B.2.4 / D.1.3 / D.1.4.
export * from './data/country-non-gov-costs';
export * from './data/country-pr-presence';
// Phase 3.6.4 / FIX 2 — country-level D.1.2 PR timeline lookup.
export * from './data/country-pr-timeline';
// Phase 3.9 / W21 — country-level D.2.4 / D.3.1 / D.3.3 lookups.
export * from './data/country-civic-test-policy';
export * from './data/country-tax-residency';
export * from './data/country-tax-basis';
// Phase 3.9 / W20 — per-program policy-change history for E.1.1 derive.
export * from './data/program-policy-history';
// Phase 3.9 / W3 — per-country cross-departmental authority registry.
export * from './data/country-departments';
// Phase 3.9 / W5 — per-program curated discovery hints.
export * from './data/program-discovery-hints';
// Phase 3.10c.8 — OECD tax treaty supplementary lookup (Phase 7 prereq).
export * from './data/oecd-tax-treaties';
// Phase 3.6.4 / FIX 1 — currency detection (with bare-$ country fallback).
export { detectCurrency, BARE_DOLLAR_COUNTRY_FALLBACK } from './utils/currency';
