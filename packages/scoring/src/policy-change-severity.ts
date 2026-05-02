// Phase 3.10c.2 — severity classifier for policy_changes rows.
//
// Phase 6 (living index) will write a `policy_changes` row whenever a
// re-scrape detects a content_hash change AND the resulting re-extraction
// produces a different normalized value than the prior approved row.
// The severity bucket controls downstream behaviour: Breaking events
// page on-call via Resend; Material events go into a daily digest;
// Minor events accumulate silently.
//
// Methodology (METHODOLOGY.md §7.4 / IMPLEMENTATION_PLAN.md Phase 6):
//
//   Breaking — PAQ change > 5 points
//   Material — 1 ≤ PAQ change ≤ 5
//   Minor    — PAQ change < 1 OR a non-scoring change (programme name,
//              description, etc., where no PAQ delta is computable)
//
// Pure function. No DB access; no LLM call. The Phase 6 diff-and-
// classify job (Phase 3.10c.3) consumes this helper.

export type PolicyChangeSeverity = 'breaking' | 'material' | 'minor';

export const SEVERITY_BREAKING_THRESHOLD = 5;
export const SEVERITY_MATERIAL_THRESHOLD = 1;

export interface PolicyChangeSeverityInput {
  /** PAQ score before the change. Null when the programme had no prior score. */
  paqBefore: number | null;
  /** PAQ score after the change. Null when re-scoring failed or the change is non-scoring. */
  paqAfter: number | null;
  /**
   * Whether the changed field affects scoring. False for narrative-only
   * fields (programme description, etc.) where no PAQ delta is meaningful.
   */
  scoringFieldChanged: boolean;
}

export interface PolicyChangeSeverityResult {
  severity: PolicyChangeSeverity;
  /** Absolute PAQ delta. Null when either side is null or the field is non-scoring. */
  paqDelta: number | null;
  /** Short reason that explains which branch fired — useful for the audit log. */
  reason: string;
}

/**
 * Classify a policy change. Country-agnostic, methodology-mandated.
 *
 * Edge cases:
 *   - Either paqBefore or paqAfter null → Minor (cannot quantify the
 *     impact; the row still gets written for analyst inspection).
 *   - scoringFieldChanged=false → Minor regardless of paq numbers (the
 *     change is non-scoring; PAQ is a coincidence).
 *   - paqDelta exactly at the threshold (5.0 or 1.0) → tied to the
 *     stricter bucket: 5.0 is Breaking, 1.0 is Material. This matches
 *     the methodology's "> 5" / ">= 1" convention.
 */
export function classifyPolicyChangeSeverity(
  input: PolicyChangeSeverityInput
): PolicyChangeSeverityResult {
  if (!input.scoringFieldChanged) {
    return {
      severity: 'minor',
      paqDelta: null,
      reason: 'non_scoring_field',
    };
  }
  if (input.paqBefore === null || input.paqAfter === null) {
    return {
      severity: 'minor',
      paqDelta: null,
      reason: 'paq_unavailable',
    };
  }
  const delta = Math.abs(input.paqAfter - input.paqBefore);
  if (delta > SEVERITY_BREAKING_THRESHOLD) {
    return {
      severity: 'breaking',
      paqDelta: delta,
      reason: `paq_delta_${delta.toFixed(2)}_above_${SEVERITY_BREAKING_THRESHOLD}`,
    };
  }
  if (delta >= SEVERITY_MATERIAL_THRESHOLD) {
    return {
      severity: 'material',
      paqDelta: delta,
      reason: `paq_delta_${delta.toFixed(2)}_in_material_band`,
    };
  }
  return {
    severity: 'minor',
    paqDelta: delta,
    reason: `paq_delta_${delta.toFixed(2)}_below_${SEVERITY_MATERIAL_THRESHOLD}`,
  };
}
