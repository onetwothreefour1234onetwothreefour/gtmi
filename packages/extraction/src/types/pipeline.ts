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

// Phase 3.6 / ADR-016 (superseded by methodology v2.0.0 ADR) — Stage 6.5: Derive.
//
// Pure deterministic computation of D.2.2 (and other downstream derived
// fields) from already-extracted inputs plus static lookup tables. No
// LLM calls. Inputs are resolved by the caller (canary-run.ts /
// extract-single-program.ts) from the extraction map and the static
// tables in `scripts/`. The Pillar A derive (A.1.2 % of median) was
// removed in methodology v2.0.0 — A.1.1 is now extracted directly.
export interface DeriveStageInputs {
  d22: import('../stages/derive').DerivedD22Input;
  /** Phase 3.6.1 / FIX 6 — D.2.3 dual citizenship derive. Optional for
   * backwards compatibility with callers that don't pass it. */
  d23?: import('../stages/derive').DerivedD23Input;
  /** Phase 3.6.2 / ITEM 2 — B.2.4 mandatory non-government costs. */
  b24?: import('../stages/derive').DerivedB24Input;
  /** Phase 3.6.2 / ITEM 2 — D.1.3 physical presence during PR accrual. */
  d13?: import('../stages/derive').DerivedD13Input;
  /** Phase 3.6.2 / ITEM 2 — D.1.4 PR retention rules. */
  d14?: import('../stages/derive').DerivedD14Input;
  /** Phase 3.6.4 / FIX 2 — D.1.2 minimum years of residence to PR eligibility. */
  d12?: import('../stages/derive').DerivedD12Input;
  /** Phase 3.9 / W21 — D.2.4 civic / language / integration test burden. */
  d24?: import('../stages/derive').DerivedD24Input;
  /** Phase 3.9 / W21 — D.3.1 tax-residency trigger (days/yr). */
  d31?: import('../stages/derive').DerivedD31Input;
  /** Phase 3.9 / W21 — D.3.3 territorial vs. worldwide taxation. */
  d33?: import('../stages/derive').DerivedD33Input;
  /** Phase 3.9 / W20 — E.1.3 program age (years since launch, capped at 20). */
  e13?: import('../stages/derive').DerivedE13Input;
  /** Phase 3.9 / W20 — E.1.1 severity-weighted policy-change count. */
  e11?: import('../stages/derive').DerivedE11Input;
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
