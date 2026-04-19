import type {
  CrossCheckResult,
  DiscoveredUrl,
  DiscoveryResult,
  ExtractionOutput,
  ReviewDecision,
  ScrapeResult,
  ValidationResult,
} from './extraction';
import type { ProvenanceRecord } from './provenance';

export interface DiscoverStage {
  execute(programId: string, programName: string, country: string): Promise<DiscoveryResult>;
}

export interface ScrapeStage {
  execute(discoveredUrls: DiscoveredUrl[]): Promise<ScrapeResult[]>;
}

export interface ExtractStage {
  execute(scrape: ScrapeResult, fieldKey: string, programId: string): Promise<ExtractionOutput>;
}

export interface ValidateStage {
  execute(extraction: ExtractionOutput, scrape: ScrapeResult): Promise<ValidationResult>;
}

export interface CrossCheckStage {
  execute(extraction: ExtractionOutput, tier2Scrape: ScrapeResult): Promise<CrossCheckResult>;
}

export interface HumanReviewStage {
  needsReview(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    crossCheck: CrossCheckResult
  ): boolean;
  enqueue(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    crossCheck: CrossCheckResult
  ): Promise<string>;
  awaitDecision(queueItemId: string): Promise<ReviewDecision>;
}

export interface PublishStage {
  execute(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    provenance: ProvenanceRecord
  ): Promise<void>;
}

export interface ExtractionPipeline {
  discover: DiscoverStage;
  scrape: ScrapeStage;
  extract: ExtractStage;
  validate: ValidateStage;
  crossCheck: CrossCheckStage;
  humanReview: HumanReviewStage;
  publish: PublishStage;
}
