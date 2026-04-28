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
  DeriveStageImpl,
  deriveA12,
  deriveD22,
} from './stages/derive';
export type {
  CitizenshipResidenceEntry,
  DerivedA12Input,
  DerivedD22Input,
  DerivedRow,
  FxRateEntry,
  MedianWageEntry,
} from './stages/derive';
export { DiscoverStageImpl } from './stages/discover';
export { HumanReviewStageImpl } from './stages/human-review';
export { ExtractStageImpl, computeExtractionCacheKey } from './stages/extract';
export { PublishStageImpl } from './stages/publish';
export { ScrapeStageImpl } from './stages/scrape';
export { ValidateStageImpl } from './stages/validate';
