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
  deriveD22,
  deriveD23,
} from './stages/derive';
export type {
  CitizenshipResidenceEntry,
  DerivedA12Input,
  DerivedD22Input,
  DerivedD23Input,
  DerivedRow,
  DualCitizenshipPolicyEntry,
  FxRateEntry,
  MedianWageEntry,
} from './stages/derive';
export { DiscoverStageImpl, writeToSourcesTable } from './stages/discover';
export {
  DEFAULT_URL_CAP,
  TIER_QUOTAS,
  loadProgramSourcesAsDiscovered,
  mergeDiscoveredUrls,
  normaliseUrl,
} from './utils/url-merge';
export type { DbClient } from './utils/url-merge';
export { HumanReviewStageImpl } from './stages/human-review';
export { ExtractStageImpl, computeExtractionCacheKey } from './stages/extract';
export { PublishStageImpl } from './stages/publish';
export { ScrapeStageImpl } from './stages/scrape';
export { ValidateStageImpl } from './stages/validate';

// Phase 3.6 / ADR-016 — static lookup tables for the derive stage.
// Re-exported from `packages/extraction/src/data/` (moved from `scripts/`
// in the typecheck-fix commit so cross-package tsc respects rootDir).
export * from './data/country-median-wage';
export * from './data/fx-rates';
export * from './data/country-citizenship-residence';
// Phase 3.6.1 / FIX 6 — dual-citizenship lookup for D.2.3 derive.
export * from './data/country-citizenship-policy';
