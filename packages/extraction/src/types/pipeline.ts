import type {
  CrossCheckResult,
  DiscoveredUrl,
  DiscoveryResult,
  ExtractionOutput,
  FieldSpec,
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
  execute(
    scrape: ScrapeResult,
    fieldKey: string,
    programId: string,
    programName: string,
    countryIso: string
  ): Promise<ExtractionOutput>;
  executeAllFields(
    scrapes: ScrapeResult[],
    fields: ReadonlyArray<FieldSpec>,
    programId: string,
    programName: string,
    countryIso: string
  ): Promise<Map<string, { output: ExtractionOutput; sourceUrl: string }>>;
}

export interface ValidateStage {
  execute(extraction: ExtractionOutput, scrape: ScrapeResult): Promise<ValidationResult>;
}

export interface CrossCheckStage {
  execute(extraction: ExtractionOutput, tier2Scrape: ScrapeResult): Promise<CrossCheckResult>;
}

/**
 * Provenance context required by `HumanReviewStage.enqueue` so that the
 * `field_values.provenance` JSONB written for pending_review rows mirrors the
 * shape written by `PublishStage` for approved rows. Without this, downstream
 * consumers (review UI, verifier, scoring) see two different provenance shapes
 * depending on whether the row was auto-approved or queued — which is the
 * exact bug surfaced by the AUS Phase 2 close-out canary.
 */
export interface PendingProvenanceContext {
  sourceUrl: string;
  geographicLevel: import('./extraction').GeographicLevel;
  sourceTier: import('./extraction').SourceTier;
  scrapeTimestamp: string;
  contentHash: string;
  crossCheckResult: import('./provenance').CrossCheckOutcome;
  crossCheckUrl: string | null;
  methodologyVersion: string;
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
    crossCheck: CrossCheckResult,
    context: PendingProvenanceContext
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
