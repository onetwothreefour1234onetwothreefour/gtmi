export { createAnthropicClient, MODEL_EXTRACTION, MODEL_SUMMARY } from './clients/anthropic';
export type { ExtractionModel } from './clients/anthropic';

export { createFirecrawlClient } from './clients/firecrawl';

export type {
  CrossCheckResult,
  ExtractionInput,
  ExtractionOutput,
  ReviewDecision,
  ScrapeResult,
  SourceTier,
  ValidationResult,
} from './types/extraction';

export type { CrossCheckOutcome, ProvenanceRecord } from './types/provenance';

export type {
  CrossCheckStage,
  ExtractStage,
  ExtractionPipeline,
  HumanReviewStage,
  PublishStage,
  ValidateStage,
} from './types/pipeline';
