// Phase 3.7 / ADR-019 — shared placeholder normalization params.
//
// These are the engineer-chosen ranges/cohort-stats used to score every
// row at publish time, in /review approve+edit, and in the canary
// run-paq-score helper. They are PLACEHOLDERS — the calibration pass
// (Phase 5) will replace them with cohort-percentile values computed
// from the live distribution. Until then, every score carries
// `phase2Placeholder: true` in metadata.
//
// Single source of truth — change here, every consumer updates on next
// build. Previously this constant lived inline in
// scripts/run-paq-score.ts and scripts/backfill-value-indicator-scores.ts;
// now it's exported from @gtmi/scoring so publish.ts and the /review
// actions can import it without script-package coupling.

import type { NormalizationParams } from './types';

export const PHASE2_PLACEHOLDER_PARAMS: NormalizationParams = {
  // A — Access & Eligibility (methodology v2.0.0)
  'A.1.1': { min: 50, max: 300 }, // salary threshold as % of local median wage — min_max
  'A.1.3': { min: 0, max: 10 }, // minimum work experience years — min_max
  'A.1.5': { min: 0, max: 100 }, // applicant age cap — min_max
  'A.2.1': { min: 1, max: 10 }, // number of mandatory qualifying criteria — min_max
  'A.2.3': { min: 1, max: 10 }, // number of distinct qualifying tracks — min_max

  // B — Process & Cost
  'B.1.1': { min: 1, max: 365 }, // SLA processing days — min_max
  'B.1.3': { min: 1, max: 10 }, // number of application steps — min_max
  'B.2.1': { mean: 2500, stddev: 2000 }, // principal applicant fees USD — z_score
  'B.2.2': { mean: 1200, stddev: 900 }, // per-dependant fees USD — z_score
  // B.2.3 / B.2.4 were z_score in v1; restructured to boolean_with_annotation
  // in Phase 3.5 / ADR-014, so numeric calibration no longer applies.
  'B.3.2': { min: 0, max: 5 }, // in-person / biometric visit count — min_max

  // C — Conditions
  'C.2.2': { min: 0, max: 25 }, // dependent child age cap — min_max

  // D — Pathways
  'D.1.2': { min: 0, max: 10 }, // years to PR eligibility — min_max
  // D.1.3 / D.1.4 were min_max in v1; restructured to boolean_with_annotation
  // in Phase 3.5 / ADR-014, so numeric calibration no longer applies.
  'D.2.2': { min: 5, max: 30 }, // years to citizenship — min_max
  'D.3.1': { min: 0, max: 365 }, // tax residency trigger days — min_max

  // E — Environment & Stability
  'E.1.1': { mean: 3, stddev: 2.5 }, // policy changes count (severity-weighted) — z_score
  'E.1.3': { min: 0, max: 20 }, // program age years — min_max
  'E.3.1': { min: -2.5, max: 2.5 }, // V-Dem / WGI Rule of Law score — min_max
  'E.3.2': { min: -2.5, max: 2.5 }, // WGI Government Effectiveness score — min_max
};
