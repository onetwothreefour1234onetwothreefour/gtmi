import type { GeographicLevel, ReviewDecision, SourceTier } from './extraction';

export type CrossCheckOutcome = 'agree' | 'disagree' | 'not_checked';

export interface ProvenanceRecord {
  sourceUrl: string;
  geographicLevel: GeographicLevel;
  /**
   * Source tier. `null` is reserved for synthetic rows that did not come
   * from a real source — currently only `extractionModel === 'country-substitute-regional'`
   * (Phase 3.5 / ADR-014). Real Tier-1/2/3 sources always set 1, 2, or 3.
   */
  sourceTier: SourceTier | null;
  scrapeTimestamp: string;
  contentHash: string;
  sourceSentence: string;
  characterOffsets: { start: number; end: number };
  extractionModel: string;
  extractionConfidence: number;
  validationModel: string;
  validationConfidence: number;
  crossCheckResult: CrossCheckOutcome;
  crossCheckUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  methodologyVersion: string;
  reviewDecision: ReviewDecision;
  /** ISO 4217 currency code detected in valueRaw before normalization (e.g. "AUD", "SGD"). */
  valueCurrency?: string;
}
