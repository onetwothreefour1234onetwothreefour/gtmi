export {
  createAnthropicClient,
  MODEL_CROSSCHECK,
  MODEL_EXTRACTION,
  MODEL_VALIDATION,
} from './clients/anthropic';
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
} from './stages/derive';
export type {
  CitizenshipResidenceEntry,
  DerivedA12Input,
  DerivedB24Input,
  DerivedD12Input,
  DerivedD13Input,
  DerivedD14Input,
  DerivedD22Input,
  DerivedD23Input,
  DerivedRow,
  DualCitizenshipPolicyEntry,
  FxRateEntry,
  MedianWageEntry,
  NonGovCostsPolicyEntry,
  PrPresenceFieldEntry,
  PrPresencePolicyEntry,
  PrTimelinePolicyEntry,
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
export { scoreProgramFromDb } from './utils/score-program';
export type { ScoreProgramOptions, ScoreProgramResult } from './utils/score-program';

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
// Phase 3.9 / W3 — per-country cross-departmental authority registry.
export * from './data/country-departments';
// Phase 3.6.4 / FIX 1 — currency detection (with bare-$ country fallback).
export { detectCurrency, BARE_DOLLAR_COUNTRY_FALLBACK } from './utils/currency';
