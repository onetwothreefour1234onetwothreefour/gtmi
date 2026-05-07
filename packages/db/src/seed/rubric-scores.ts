/**
 * Canonical 0-100 scores for every categorical rubric value in GTMI methodology v1.
 *
 * These scores are applied at scoring time by `normalizeCategorical` (packages/scoring).
 * Keep in parity with docs/METHODOLOGY.md category intent and the `direction` field.
 *
 * For `higher_is_better` rubrics: best category → 100, worst → 0.
 * For `lower_is_better` rubrics: best (least burdensome) category → 100, worst → 0.
 */
export const RUBRIC_SCORES: Record<string, Record<string, number>> = {
  'A.1.2': {
    none: 100,
    secondary: 80,
    vocational: 60,
    bachelor: 40,
    master: 20,
    doctorate: 0,
  },
  'A.1.4': {
    none: 100,
    basic: 75,
    intermediate: 50,
    upper_intermediate: 25,
    advanced: 0,
  },
  'A.2.2': {
    conjunctive: 0,
    hybrid: 60,
    compensatory: 100,
  },
  'A.3.1': {
    no_quota: 100,
    large_quota: 80,
    moderate_quota: 50,
    tight_quota: 20,
    quota_undisclosed: 30,
  },
  'B.4.1': {
    none: 0,
    partial: 50,
    full: 100,
  },
  'B.4.2': {
    none: 0,
    email_only: 50,
    online_portal: 100,
  },
  // Pillar C rubrics rewritten in methodology v4.0.0 (ADR-030):
  // collapsed vocabularies on the same axes (employer switching,
  // self-employment, spouse inclusion, healthcare, education) plus net-new
  // C.1.3 (visa duration). Old keys C.1.4 (LMT) and C.2.4 (same-sex partner)
  // retired and removed.
  'C.1.1': {
    open: 100,
    notification_only: 50,
    new_application_required: 0,
  },
  'C.1.2': {
    full: 100,
    restricted: 50,
    none: 0,
  },
  'C.1.3': {
    permanent: 100,
    long_term_renewable: 67,
    short_term_renewable: 33,
    non_renewable: 0,
  },
  'C.2.1': {
    automatic_full: 100,
    automatic_limited_or_permit: 50,
    not_permitted: 0,
  },
  'C.3.1': {
    full: 100,
    partial: 50,
    none: 0,
  },
  'C.3.2': {
    full: 100,
    partial: 50,
    none: 0,
  },
  // Pillar D categorical rubrics (D.2.4 / D.3.2 / D.3.3) removed in
  // methodology v5.0.0 (ADR-031) — those keys are retired. The new
  // Pillar D is all booleans + numerics with no rubric scores.
  // Pillar E rubric scores rewritten in methodology v6.0.0 (ADR-032):
  // sub-factor E.3 retired (no rubric); E.2.2 / E.2.3 retired; new
  // E.1.2 introduces a 5-bucket categorical fallback used by the
  // numeric_or_categorical normFn when only a coarse range is reported.
  'E.1.2': {
    large: 100,
    medium: 75,
    small: 50,
    marginal: 25,
    no_data: 0,
  },
};
