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
  execute(
    programId: string,
    programName: string,
    country: string,
    options?: { excludeAllRegistry?: boolean; missingFieldLabels?: string[] }
  ): Promise<DiscoveryResult>;
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
    countryIso: string,
    /**
     * Phase 3.5: optional cap on output `extractionConfidence`. When set,
     * every output's confidence is `min(actual, cap)`. The Tier 2 fallback
     * pass uses this with cap=0.85 to enforce ADR-013.
     */
    options?: { confidenceCap?: number }
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
  /**
   * Phase 3.9 / W7 — GCS snapshot path from the winning scrape.
   * Optional; when present, propagated into pending_review provenance
   * + field_values.archive_path so the row's source-page archive
   * survives independent of the live URL.
   */
  archivePath?: string;
  /**
   * Phase 3.9 / W2 — translation provenance. When the winning scrape
   * was translated from a non-English source, these carry through to
   * the pending_review row so /review surfaces the "Translated from
   * {lang}" verification banner.
   */
  translatedFrom?: string;
  translationVersion?: string;
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
  /**
   * Phase 3.5 / ADR-014: write a synthetic country-substitute row when
   * the LLM extraction returned empty for a `country_substitute_regional`
   * field. Returns true if a row was written, false if no regional default
   * exists for the country (caller lets missing-data penalty apply).
   */
  executeCountrySubstitute(
    programId: string,
    fieldDefinitionKey: string,
    methodologyVersion: string
  ): Promise<boolean>;
  /**
   * Phase 3.6 / ADR-016: write a derived row (A.1.2 / D.2.2) with
   * status='pending_review'. extractionModel must be
   * 'derived-computation' and extractionConfidence must be 0.6.
   */
  executeDerived(extraction: ExtractionOutput, provenance: ProvenanceRecord): Promise<string>;
}

// Phase 3.6 / ADR-016 (Pillar A → ADR-028, B → ADR-029, C → ADR-030,
// D → ADR-031, E → ADR-032) — Stage 6.5: Derive.
//
// Methodology v6.0.0 (ADR-032): the only remaining derive is program
// age (now keyed E.1.1, was E.1.3). The deriveE11 (severity-weighted
// policy changes) was deleted; new E.2.1 is LLM-extracted. No LLM
// calls in this stage. Inputs are resolved by the caller
// (canary-run.ts / extract-single-program.ts) from the programs table.
export interface DeriveStageInputs {
  /** ADR-032 — program age (years since launch, raw uncapped). Engine clamps to 20 at score time. */
  programAge?: import('../stages/derive').DerivedProgramAgeInput;
}

export interface DeriveStage {
  execute(inputs: DeriveStageInputs): import('../stages/derive').DerivedRow[];
}

export interface ExtractionPipeline {
  discover: DiscoverStage;
  scrape: ScrapeStage;
  extract: ExtractStage;
  derive: DeriveStage;
  validate: ValidateStage;
  crossCheck: CrossCheckStage;
  humanReview: HumanReviewStage;
  publish: PublishStage;
}
