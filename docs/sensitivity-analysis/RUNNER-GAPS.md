# GTMI — Sensitivity runner gaps

> **Companion document to [`PLAN.md`](./PLAN.md).** Read [`TRIGGER.md`](./TRIGGER.md) first.

Technical checklist of what needs to be built in [`scripts/sensitivity.ts`](../../scripts/sensitivity.ts) before each analysis tier can run. Work through items sequentially within a tier — items in the same tier can ship in any order. Do not start a tier until the cohort threshold for that tier (`SELECT COUNT(*) FROM scores WHERE flagged_insufficient_disclosure = false`) is met.

The runner skeleton is 498 lines today and already implements the DB connection, ScoringInput loading, perturbation persistence, dry-run/`--execute` toggle, Spearman + top-10 helpers, and 6 of the 8 analyses (most in degraded form). All gaps below extend that skeleton — no new files, no schema changes.

---

## Tier 1 — Before n ≥ 5 runs (B2, B6, B8)

These three unlock at n ≥ 5. B2 is already complete. B6 and B8 each need a small addition to the runner.

- [ ] **B2 — CME / PAQ split robustness: already implemented.**
  - Existing implementation at [`scripts/sensitivity.ts:179`](../../scripts/sensitivity.ts#L179) (`cmePaqSplitPerturbations`).
  - Five splits (20/80, 25/75, 35/65, 40/60, 50/50). Add 30/70 baseline as the reference row in the report (one-line fix).
  - **No code change needed** beyond reporting. Just execute: `pnpm exec tsx scripts/sensitivity.ts cme-paq-split --execute`.

- [ ] **B6 — Add sub-factor-level geometric aggregation mode (~20 LOC).**
  - Current `aggregationPerturbations` at [`scripts/sensitivity.ts:329`](../../scripts/sensitivity.ts#L329) only swaps the pillar-level aggregator.
  - **Extend `runScoringEngine` to accept an optional `subFactorAggregator: 'arithmetic' | 'geometric'` parameter** (see [`packages/scoring/src/engine.ts`](../../packages/scoring/src/engine.ts) — it already passes a `pillarAggregator`; add a parallel `subFactorAggregator`).
  - In the runner, add a third perturbation: `{ aggregator: 'geometric_subfactor_AND_pillar' }` that sets both `subFactorAggregator: 'geometric'` and `aggregator: 'geometric'`.
  - Use the existing `aggregateWeightedGeometricMean` helper at [`packages/scoring/src/score.ts:46`](../../packages/scoring/src/score.ts#L46) — already implemented with zero-collapse semantics.
  - Output schema: `{aggregator: 'geometric_subfactor_AND_pillar', compensability_loss_per_program: {...}}`.

- [ ] **B8 — Add `rank_aggregation_alternatives` analysis type (~80 LOC).**
  - New analysis type. Add to `VALID_ANALYSES` set at [`scripts/sensitivity.ts:62`](../../scripts/sensitivity.ts#L62).
  - Add a new runner function `rankAggregationPerturbations(baseline)` that:
    1. For each programme, compute its rank within the cohort on each indicator independently.
    2. Compute Borda count = sum-of-ranks per programme; lower is better.
    3. Compute outranking score = pairwise wins (programme A outranks programme B if A is at least as good on a weighted majority of indicators).
    4. Compute Spearman ρ between baseline composite ranking and each of (Borda ranking, outranking ranking).
    5. Emit two perturbation rows: `{method: 'borda', rho_vs_composite: ..., max_rank_disagreement: ...}` and `{method: 'outranking', ...}`.
  - **No new schema** — uses the existing `sensitivity_runs` table. `analysis_type='rank_aggregation_alternatives'`.
  - Register in `ANALYSIS_RUNNERS` map at [`scripts/sensitivity.ts:423`](../../scripts/sensitivity.ts#L423).
  - Cohort gate: needs `n ≥ 5` (pairwise comparisons start being interpretable).

---

## Tier 2 — Before n ≥ 10 runs (B1, B3, B4, B5)

These four unlock at n ≥ 10. Estimated cumulative effort: ~220 LOC across four functions plus engine extensions.

- [ ] **B1 — Rewrite `weight_monte_carlo` to sample full Dirichlet hierarchy (~80 LOC).**
  - Current [`scripts/sensitivity.ts:365`](../../scripts/sensitivity.ts#L365) `weightMonteCarloPerturbations` only varies the CME/PAQ blend.
  - **Replace with a full-hierarchy sampler:**
    1. Add a deterministic seedable RNG (use `seedrandom` or hand-roll a Mulberry32 — needed for reproducibility per `PLAN.md` §8).
    2. Implement `sampleDirichlet(alpha: number[], rng): number[]` (Gamma-distribution-based; standard implementation).
    3. Per trial: sample pillar weights from `Dirichlet(α_pillar = baseline × concentration)`, sub-factor weights per pillar similarly, indicator weights per sub-factor similarly.
    4. **Tune concentration parameter** so ±20% perturbation is the typical magnitude. Calibrate by sampling 1,000 vectors and computing the empirical 5th–95th percentile bounds against baseline; aim for ≤ ±20%. Default concentration: 5×.
    5. Inject perturbed weights into the scoring input — modify `ScoringInput.fieldDefinitions[].weightWithinSubFactor` per indicator; pass an override map for pillar + sub-factor weights to `runScoringEngine`.
    6. Run 1,000 trials. The runner currently uses 50; bump to 1,000 (methodology spec).
  - **Engine change required:** `runScoringEngine` currently reads pillar / sub-factor weights from constants in [`packages/scoring/src/score.ts:3`](../../packages/scoring/src/score.ts#L3). Add an optional `weightsOverride: { pillarWeights, subFactorWeights }` parameter to the engine and the `ScoringInput` interface so the runner can inject perturbed weights without rebuilding the scoring engine.
  - Output schema: `{trial: int, pillar_weights, subfactor_weights, indicator_weights, rank_shifts}`.

- [ ] **B3 — Add `pillar_weight_alternatives` analysis type (~50 LOC).**
  - New analysis type. Add to `VALID_ANALYSES` and `ANALYSIS_RUNNERS`.
  - For each of 5 pillars × 6 perturbations (±10%, ±20%, ±30%) = 30 trials.
  - Per trial: scale the chosen pillar's weight by the perturbation factor; redistribute the delta proportionally across the other 4 pillars so weights sum to 1.0; re-normalise; rescore via `runScoringEngine` with `weightsOverride.pillarWeights = perturbed`.
  - Output schema: `{perturbed_pillar: 'A', perturbation_pct: 20, pillar_weights_after: {...}}`.
  - **Depends on:** the `weightsOverride` engine extension from B1. Implement B1's engine change first (it's the prerequisite for B1, B3, B4).

- [ ] **B4 — Add `subfactor_weight_alternatives` analysis type (~50 LOC).**
  - New analysis type.
  - For each of 5 pillars × 3 variants (equal-weighting, inverted-weighting, ±15% perturbation) = 15 trials.
  - Per trial: replace the chosen pillar's sub-factor weights with the variant; hold pillar and indicator weights at baseline; rescore via `runScoringEngine` with `weightsOverride.subFactorWeights = perturbed`.
  - Output schema: `{pillar: 'A', variant: 'equal_weighting', subfactor_weights_after: {...}}`.
  - Depends on the B1 engine extension.

- [ ] **B5 — Add per-indicator mode to `indicator_dropout` (~40 LOC).**
  - Current [`scripts/sensitivity.ts:345`](../../scripts/sensitivity.ts#L345) `indicatorDropoutPerturbations` drops one PILLAR at a time.
  - **Rename current implementation to `pillar_dropout`** and keep it as a separate analysis type (it's still useful — answers "what if Pillar X were unmeasurable").
  - Add new `indicator_dropout` runner that drops one INDICATOR at a time (33 trials):
    1. Filter `fieldDefinitions` to exclude the target indicator.
    2. Filter `fieldValues` correspondingly.
    3. Let the engine's missing-data penalty + `reNormalizeWeights` handle the gap (already implemented at [`packages/scoring/src/score.ts:67`](../../packages/scoring/src/score.ts#L67)).
    4. Rescore. Capture per-programme composite delta and rank shift.
  - Output schema: `{dropped_indicator: 'A.3.1', max_rank_shift: 3, max_composite_delta: 4.21}`.
  - **Update the `VALID_ANALYSES` set** — `indicator_dropout` (per-indicator) and `pillar_dropout` (existing behaviour) become two separate entries.

---

## Tier 3 — Before n ≥ 30 runs (B7)

Single analysis. The runner skeleton's existing implementation is essentially a placeholder (computes only Pearson(PAQ, CME) — a single scalar).

- [ ] **B7 — Rewrite `correlation` runner from PAQ/CME scalar to full 33×33 matrix (~60 LOC).**
  - Current [`scripts/sensitivity.ts:384`](../../scripts/sensitivity.ts#L384) `correlationPerturbations` is a placeholder.
  - **Rewrite to compute the full 33×33 Pearson matrix:**
    1. Load every approved field_value row for every scored programme. Build a programme × indicator matrix of normalised scores (using the indicator-score values, not the raw values).
    2. For each pair of indicators, compute Pearson ρ across the cohort.
    3. Build the symmetric 33×33 matrix.
    4. Identify within-sub-factor pairs with `|ρ| > 0.85` (Tier 1 trigger from `PLAN.md` §4) and cross-sub-factor pairs with `|ρ| > 0.90` (Tier 2 trigger).
    5. Compute the eigenvalue spectrum / condition number of the matrix.
    6. Optional: hierarchical-cluster indicators on `1 − |ρ|` distance using single-linkage. Use a minimal JS clustering implementation or pull `density-clustering` / `clusterfck` if you must — but prefer ~30 LOC of hand-rolled code over a new dependency for one analysis.
  - Output schema: `{matrix_shape: [33, 33], matrix_jsonb: {...}, high_correlation_pairs: [...], condition_number: 12.4}`.
  - **Cohort gate:** needs `n ≥ 30`. With fewer programmes than indicators, the correlation matrix is rank-deficient and Pearson is unstable.

---

## Cross-cutting improvements (do these once, applies to all tiers)

These are not analysis-specific. Schedule them whenever convenient; B1 forces some of them.

- [ ] **Add `weightsOverride` to `ScoringInput` and `runScoringEngine`.**
  - Required for B1, B3, B4. Until this exists, those analyses cannot inject perturbed weights without rebuilding the entire engine.
  - Optional fields: `weightsOverride?: { pillarWeights?, subFactorWeights?, indicatorWeights? }`.
  - When provided, the engine uses the override; when absent, falls back to the constants in `score.ts` and the `weightWithinSubFactor` field on each `FieldDefinitionRecord`.

- [ ] **Add `subFactorAggregator` to the engine.**
  - Required for B6. Mirror the existing `aggregator` parameter (which controls pillar-level aggregation) at the sub-factor level.

- [ ] **Add seedable RNG.**
  - Required for B1 reproducibility per `PLAN.md` §8.
  - Use Mulberry32 (small, deterministic, ~10 LOC) seeded by `Date.parse(run.created_at)` or an explicit `--seed` CLI flag.

- [ ] **Persist runner git SHA.**
  - Required for `PLAN.md` §8 reproducibility.
  - Add a `runner_sha` field to `sensitivity_runs.notes` JSONB or stamp it into `perturbation_jsonb`. SHA available via `child_process.execSync('git rev-parse HEAD')`.

- [ ] **Add a `--cohort-min` CLI flag that aborts with an honest error if the current cohort is below the analysis's minimum.**
  - Per-analysis minima from `PLAN.md` §3:
    - B2, B6, B8 → 5
    - B1, B3, B4, B5 → 10
    - B7 → 30
  - Guard rail so a future Claude session running `sensitivity.ts all --execute` against a small cohort gets a clear error rather than a meaningless result.

- [ ] **Wire the public methodology page sensitivity section.**
  - Existing empty-state at [`apps/web/app/(public)/methodology/page.tsx:286-303`](<../../apps/web/app/(public)/methodology/page.tsx>) auto-renders when `sensitivity_runs` carries rows.
  - Add a `<SensitivitySection>` component (~200 LOC of React) that reads the most-recent `run_id` per `analysis_type` and renders one panel per analysis (per `PLAN.md` §7.2).
  - Add small content files at `apps/web/content/methodology/sensitivity-{type}.md` (one per analysis_type) for the per-panel explanations.
  - Add a printable route at `apps/web/app/(public)/methodology/sensitivity-report/page.tsx` mirroring the existing whitepaper pattern at [`whitepaper/page.tsx`](<../../apps/web/app/(public)/methodology/whitepaper/page.tsx>).

---

## Estimated cumulative implementation effort

| Tier                                                                                | LOC      | Days     |
| ----------------------------------------------------------------------------------- | -------- | -------- |
| Tier 1 (B6 + B8 + cross-cutting `subFactorAggregator`)                              | ~120     | 0.5      |
| Tier 2 (B1 + B3 + B4 + B5 + cross-cutting `weightsOverride` + RNG + `--cohort-min`) | ~280     | 1.0      |
| Tier 3 (B7)                                                                         | ~60      | 0.5      |
| Public page rendering (1× per cohort)                                               | ~250     | 1.0      |
| **Total**                                                                           | **~710** | **~3.0** |

Tier 1 is the smallest and unlocks first; it should be implemented as soon as the cohort hits n ≥ 5 even if the public-page rendering is deferred.

---

## Out-of-scope reminders

These belong elsewhere; do not implement them as part of the sensitivity runner:

- Cohort growth (extraction + human review). Operational task; not in this checklist.
- Calibration of normalisation parameters. Separate concern; uses `methodology_versions.calibrated_params` (column added by migration 00023).
- Schema changes. Everything in this plan operates against the existing `sensitivity_runs` schema. No migrations needed.
- New ADRs. ADRs are written in response to Tier 2 triggers (per `PLAN.md` §4) — they document weight revisions, not the runner that detected them.

---

_Authored 2026-05-07 against `scripts/sensitivity.ts` at git SHA `c03d469`. Re-validate gap line numbers against the current runner before implementing._
