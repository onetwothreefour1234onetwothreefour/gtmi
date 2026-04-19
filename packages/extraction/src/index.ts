export {
  createAnthropicClient,
  MODEL_DISCOVERY,
  MODEL_EXTRACTION,
  MODEL_SUMMARY,
} from './clients/anthropic';
export type { ExtractionModel } from './clients/anthropic';

export { createFirecrawlClient } from './clients/firecrawl';

export type {
  CrossCheckResult,
  DiscoveredUrl,
  DiscoveryResult,
  ExtractionInput,
  ExtractionOutput,
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
  ValidateStage,
} from './types/pipeline';

export { CrossCheckStageImpl } from './stages/cross-check';
export { DiscoverStageImpl } from './stages/discover';
export { ExtractStageImpl } from './stages/extract';
export { ScrapeStageImpl } from './stages/scrape';
export { ValidateStageImpl } from './stages/validate';
