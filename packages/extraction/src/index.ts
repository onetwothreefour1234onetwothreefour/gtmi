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
  DiscoverStage,
  ExtractStage,
  ExtractionPipeline,
  HumanReviewStage,
  PublishStage,
  ScrapeStage,
  ValidateStage,
} from './types/pipeline';

export { CrossCheckStageImpl } from './stages/cross-check';
export { DiscoverStageImpl } from './stages/discover';
export { HumanReviewStageImpl } from './stages/human-review';
export { ExtractStageImpl } from './stages/extract';
export { PublishStageImpl } from './stages/publish';
export { ScrapeStageImpl } from './stages/scrape';
export { ValidateStageImpl } from './stages/validate';
