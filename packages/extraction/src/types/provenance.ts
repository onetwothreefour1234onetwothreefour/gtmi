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
  /**
   * Phase 3.9 / W7 — GCS storage path for the source-page snapshot
   * that produced this winning extraction. Read by publish.ts and
   * mirrored into field_values.archive_path so /review and the
   * public detail drawer can fall back to a signed URL when the live
   * sourceUrl returns 404. Absent for legacy rows (pre-W0) and for
   * synthetic rows (country-substitute, derived-knowledge,
   * derived-computation, world-bank-api-direct, v-dem-api-direct).
   */
  archivePath?: string;
  /**
   * Phase 3.9 / W2 — when the source page was translated before
   * extraction, the ISO 639-1 source-language code (e.g. 'ja', 'nl').
   * /review surfaces this so the analyst knows to verify the source
   * sentence against the original-language page.
   */
  translatedFrom?: string;
  translationVersion?: string;
}
