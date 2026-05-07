// Methodology v5.0.0 / ADR-031 — conditional zero-scoring for
// pathway-dependent numerics. When the parent boolean is false, the
// child indicator scores 0 (worst possible outcome) regardless of
// what value (if any) the LLM extracted for the child.
//
// This is distinct from the three other sentinel/marker patterns:
//
//   - notApplicable marker → score = null (excluded from cohort,
//     missing-data penalty applies). Used historically for the v1
//     A.1.2 derive on points-based programmes.
//   - NO_LIMIT_MARKER → score = 100 (higher_is_better) / 0
//     (lower_is_better). Used for "no upper limit" sentinels on
//     numeric fields like A.1.5 (applicant age cap) and C.2.2
//     (dependent child age cap).
//   - missing → score = null (excluded from cohort, missing-data
//     penalty applies). The default behaviour for any indicator the
//     LLM did not extract.
//
// SCORE_DEPENDENCIES is a fourth pattern: the indicator IS measured,
// the answer IS deterministic, and the answer is the WORST possible
// score because the parent pathway doesn't exist. The runtime engine
// checks the parent value BEFORE the child's normal evaluation; if
// the parent gate fires, the child's own value is ignored entirely.
//
// Virtual zero synthesis (per ADR-031): if the parent gate fires AND
// the child has no field_values row at all, runScoringEngine
// synthesises a virtual 0 for the child so the cohort scoring is
// independent of LLM coverage on the child. This prevents a
// pathway-unavailable programme from silently dodging the scoring
// penalty that the dependency exists to enforce.

export interface ScoreDependency {
  /** Field key that gates this indicator. */
  parent: string;
  /** Score the child indicator if the parent value matches this boolean. */
  whenParentIs: boolean;
  /** Score to assign when the gate fires. */
  score: number;
}

export const SCORE_DEPENDENCIES: Record<string, ScoreDependency> = {
  'D.1.2': { parent: 'D.1.1', whenParentIs: false, score: 0 },
  'D.2.2': { parent: 'D.2.1', whenParentIs: false, score: 0 },
};
