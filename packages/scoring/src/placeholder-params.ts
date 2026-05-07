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

  // B — Process Design (methodology v3.0.0 / ADR-029)
  'B.1.1': { min: 1, max: 365 }, // standard SLA days — min_max
  // B.1.2 is boolean — no params.
  'B.2.1': { min: 1, max: 50 }, // number of mandatory application steps — min_max
  'B.2.2': { min: 0, max: 20 }, // mandatory in-person touchpoints — min_max
  'B.3.1': { min: 0, max: 50_000 }, // total applicant cost USD (principal + 1 spouse + 2 children) — min_max
  // B.4.1 / B.4.2 are categorical — no params.

  // C — Benefits (methodology v4.0.0 / ADR-030; renamed from "Rights")
  'C.2.2': { min: 0, max: 30 }, // dependent child age cap — min_max (no_cap → 100 via NO_LIMIT_MARKER)

  // D — Pathway (methodology v5.0.0 / ADR-031; renamed framing to PR + Citizenship)
  'D.1.2': { min: 0, max: 50 }, // years to PR eligibility — min_max (widened to cover Switzerland-style 10y pathways)
  'D.2.2': { min: 0, max: 50 }, // total years to citizenship — min_max (widened to cover long-pathway countries)
  // D.3.1 (tax residency trigger), D.1.3/D.1.4 (PR presence/retention),
  // and D.2.4 (civic test burden) all retired in v5.0.0.
  // Conditional zero-scoring (SCORE_DEPENDENCIES) handles D.1.2/D.2.2
  // when the parent boolean (D.1.1/D.2.1) is false.

  // E — Stability (methodology v6.0.0 / ADR-032; restructured to 4
  // indicators across 2 sub-factors. E.3 institutional-quality
  // sub-factor retired alongside the WGI / V-Dem ingestion path.)
  'E.1.1': { min: 0, max: 20 }, // program age years — min_max (ceiling 20 enforced via params.max)
  // E.1.2 (cumulative approvals or active visa holders) uses the
  // numeric_or_categorical normFn; bucket thresholds + scores live in
  // packages/scoring/src/normalize.ts (NUMERIC_OR_CATEGORICAL_BUCKETS)
  // so no NormalizationParamSet is required here.
  'E.2.1': { min: 0, max: 25 }, // severity-weighted policy-change count — min_max (Phase 5 recalibrates)
  // E.2.2 is boolean — no params.
};
