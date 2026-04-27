/**
 * ADR-007 provenance schema. Stored as JSONB on `field_values.provenance`,
 * read defensively here. The 13 always-required keys are asserted on every
 * approved row by `scripts/verify-provenance.ts` in CI.
 *
 * The UI must never silently fall back when a required key is missing —
 * `<ProvenanceTrigger>` renders an explicit "Provenance incomplete" error
 * chip instead. That is the fail-loud signal the dispatch §5 mandates.
 */

export type GeographicLevel = 'global' | 'continental' | 'national' | 'regional';
export type SourceTier = 1 | 2 | 3;
export type CrossCheckResult = 'agrees' | 'disagrees' | 'not_checked';
export type FieldValueStatus = 'draft' | 'approved' | 'rejected' | 'superseded' | 'pending_review';

/** Always required on every published value (ADR-007). */
export interface ProvenanceCoreFields {
  sourceUrl: string;
  geographicLevel: GeographicLevel;
  /**
   * `null` is reserved for synthetic country-substitute rows
   * (Phase 3.5 / ADR-014). Real Tier-1/2/3 sources always set 1, 2, or 3.
   */
  sourceTier: SourceTier | null;
  scrapedAt: string;
  contentHash: string;
  sourceSentence: string;
  charOffsets: [number, number];
  extractionModel: string;
  extractionConfidence: number;
  validationModel: string;
  validationConfidence: number;
  crossCheckResult: CrossCheckResult;
  methodologyVersion: string;
}

/** Required only when status === 'approved'. */
export interface ProvenanceReviewFields {
  reviewer: string;
  reviewedAt: string;
  reviewerNotes: string;
}

/** Optional — present only when applicable. */
export interface ProvenanceOptionalFields {
  /** ISO 4217 currency code preserved before numeric normalization. */
  valueCurrency?: string;
  /** True for E.1.1 mean-substitution per METHODOLOGY §7.5. */
  stabilityEdgeCase?: boolean;
}

export type Provenance = ProvenanceCoreFields &
  Partial<ProvenanceReviewFields> &
  ProvenanceOptionalFields;

export const PROVENANCE_CORE_KEYS: readonly (keyof ProvenanceCoreFields)[] = [
  'sourceUrl',
  'geographicLevel',
  'sourceTier',
  'scrapedAt',
  'contentHash',
  'sourceSentence',
  'charOffsets',
  'extractionModel',
  'extractionConfidence',
  'validationModel',
  'validationConfidence',
  'crossCheckResult',
  'methodologyVersion',
] as const;

export const PROVENANCE_REVIEW_KEYS: readonly (keyof ProvenanceReviewFields)[] = [
  'reviewer',
  'reviewedAt',
  'reviewerNotes',
] as const;

export interface ProvenanceReadResult {
  /** True when every required key for the row's status is present. */
  ok: boolean;
  /** Keys missing from the JSONB. */
  missing: readonly string[];
  /** The (possibly partial) provenance object. */
  provenance: Partial<Provenance> | null;
}

/**
 * Defensively read the JSONB blob from `field_values.provenance`.
 *
 * Always-required keys are asserted regardless of status. Review keys are
 * only required when status === 'approved'. The function never throws —
 * downstream UI inspects `ok` and `missing` to decide what to render.
 */
export function readProvenance(raw: unknown, status: FieldValueStatus): ProvenanceReadResult {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      ok: false,
      missing: [...PROVENANCE_CORE_KEYS],
      provenance: null,
    };
  }

  const blob = raw as Record<string, unknown>;
  const missing: string[] = [];

  // Phase 3.5 / ADR-014: sourceTier may be null on synthetic country-substitute
  // rows. Treat undefined as missing, null as present (presence-only check).
  const NULLABLE_REQUIRED_KEYS = new Set<string>(['sourceTier']);
  for (const key of PROVENANCE_CORE_KEYS) {
    const isNullable = NULLABLE_REQUIRED_KEYS.has(key);
    if (blob[key] === undefined) {
      missing.push(key);
    } else if (blob[key] === null && !isNullable) {
      missing.push(key);
    }
  }
  if (status === 'approved') {
    for (const key of PROVENANCE_REVIEW_KEYS) {
      if (blob[key] === undefined || blob[key] === null) {
        missing.push(key);
      }
    }
  }

  // charOffsets must be a 2-tuple of numbers
  const offsets = blob.charOffsets;
  if (
    offsets !== undefined &&
    offsets !== null &&
    !(
      Array.isArray(offsets) &&
      offsets.length === 2 &&
      typeof offsets[0] === 'number' &&
      typeof offsets[1] === 'number'
    )
  ) {
    if (!missing.includes('charOffsets')) missing.push('charOffsets');
  }

  return {
    ok: missing.length === 0,
    missing,
    provenance: blob as Partial<Provenance>,
  };
}
