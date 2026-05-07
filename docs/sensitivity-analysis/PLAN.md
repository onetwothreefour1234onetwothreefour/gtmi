# GTMI — Weight sensitivity & stress-test plan

> **Status:** Dormant executable specification. Activates when prod returns `SELECT COUNT(*) FROM scores WHERE flagged_insufficient_disclosure = false >= 5`. Authored 2026-05-07 against methodology v6.0.0.
> **Read first:** [`TRIGGER.md`](./TRIGGER.md). Companion docs: [`WEIGHT-RATIONALES.md`](./WEIGHT-RATIONALES.md), [`RUNNER-GAPS.md`](./RUNNER-GAPS.md).

This document is the canonical specification for stress-testing GTMI's weight structure. It is written to be self-contained — a future Claude Code session should be able to execute the plan without any prior conversation context, given only this file plus the codebase as it stood at commit `c03d469` on `main`.

---

## 0. Trigger and scope

**Activation condition:** the plan begins execution only when at least 5 programmes carry un-flagged composite scores in production. Check:

```sql
SELECT COUNT(*) FROM scores WHERE flagged_insufficient_disclosure = false;
```

If the count is below 5, do nothing — none of the 8 analyses below produces a defensible result on a sub-5 cohort. The threshold is empirical: rank-correlation statistics (Spearman ρ), top-10 stability, and indicator dropout impact all require enough programmes that pertubing one variable produces a signal distinguishable from noise.

**Scope:** the plan covers the weight structure only — pillar (5), sub-factor (14), indicator (33), and the CME/PAQ split (1). It does not cover normalisation parameter calibration (that is a separate operational task), source-tier validation, or the indicator definitions themselves.

**Out of scope:** any change to the indicator set or pillar structure. If the analysis surfaces evidence that an indicator should be dropped or restructured, that triggers a methodology version bump (see §4 — revision triggers) but the bump itself is a separate ADR, not part of this plan.

---

## 1. Why this plan exists

Methodology v6.0.0 weights were assigned through theoretical reasoning (METHODOLOGY.md §1.3) and have not been empirically tested against the cohort. Before GTMI is presented to a sovereign client or peer reviewer, the weights need to satisfy three questions:

1. **Do the weights produce rankings consistent with the methodology's stated intent?** ("PAQ should dominate; A is the highest pillar because eligibility is the biggest determinant; D is second because pathway is the future.")
2. **Are the rankings robust to plausible perturbations?** A small change in any one weight should not produce a different cohort leader.
3. **Are any indicators redundant?** Two indicators with `|ρ| > 0.85` within a sub-factor are double-counting the same signal — at least one of the weights is wrong.

This plan answers those three questions with eight specific analyses (B1–B8) and a clear rule for when their outcome triggers a weight revision (§4).

---

## 2. Current weight audit

### 2.1 Pillar weights (documented)

From [`packages/scoring/src/score.ts:3`](../../packages/scoring/src/score.ts#L3) and [`packages/db/src/seed/methodology-v1.ts:50`](../../packages/db/src/seed/methodology-v1.ts#L50):

| Pillar                   | Weight | Source rationale (METHODOLOGY.md §1.3)                                                          |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| A — Product Design       | 28%    | Highest because selection criteria are the single biggest determinant of real-world utility.    |
| B — Process Design       | 15%    | Lowest because process friction is recoverable (digital migration is faster than legal change). |
| C — Benefits             | 20%    | Mid-pillar; practical experience drives offer acceptance and retention.                         |
| D — Pathway              | 22%    | Second-highest because mobility is rarely a one-step transaction.                               |
| E — Performance Outcomes | 15%    | Most proprietary pillar; co-equal with B by elimination.                                        |

**Documentation strength:** directional ordering (A > D > C > B = E) is defensible; precise decimal values are not derived from any explicit calculation. Methodology pin: A=0.28, B=0.15, C=0.20, D=0.22, E=0.15. Sums to 1.0.

### 2.2 Sub-factor weights (largely undocumented)

Fourteen weights in [`packages/scoring/src/score.ts:23`](../../packages/scoring/src/score.ts#L23). See [`WEIGHT-RATIONALES.md`](./WEIGHT-RATIONALES.md) for the per-weight rationale draft and `[NEEDS SZABI REVIEW]` markers.

| Pillar | Sub-factor                  | Weight | Documentation strength                                |
| ------ | --------------------------- | ------ | ----------------------------------------------------- |
| A      | A.1 Qualification Threshold | 50%    | Implied (primary gate); not stated                    |
| A      | A.2 System Design           | 30%    | Undocumented                                          |
| A      | A.3 Volume                  | 20%    | Undocumented                                          |
| B      | B.1 Speed                   | 30%    | Undocumented                                          |
| B      | B.2 Complexity              | 20%    | Undocumented                                          |
| B      | B.3 Cost                    | 30%    | Undocumented                                          |
| B      | B.4 Transparency            | 20%    | Undocumented                                          |
| C      | C.1 Work Flexibility        | 40%    | Undocumented                                          |
| C      | C.2 Family                  | 40%    | Undocumented                                          |
| C      | C.3 Social Access           | 20%    | Undocumented                                          |
| D      | D.1 Permanent Residency     | 40%    | Implied (PR is intermediate; citizenship is terminal) |
| D      | D.2 Citizenship             | 60%    | Implied (terminal outcome weighted higher)            |
| E      | E.1 Track Record            | 50%    | Implied (co-equal with rule stability)                |
| E      | E.2 Rule Stability          | 50%    | Implied (co-equal with track record)                  |

### 2.3 Indicator weights (all undocumented)

Thirty-three weights in [`packages/db/src/seed/methodology-v1.ts:67`](../../packages/db/src/seed/methodology-v1.ts#L67). The pattern is "even-ish" splits — most pairs are 50/50, most triples are roughly 40/30/30 or 50/30/20. Six sub-factors have only one or two indicators (forcing the weight). **Zero indicator weights have a documented rationale anywhere in the repo.** Indicator weight rationale is out of scope for v6.0.0; the plan does not require it before the sensitivity runs.

### 2.4 Leverage analysis — top 10 highest-leverage indicators

For an arithmetic-mean composite, an indicator's leverage on the composite equals `pillar_weight × sub_factor_weight × indicator_weight × PAQ_weight`. Sorted descending:

| Rank | Indicator                         | Pillar | Leverage on composite |
| ---- | --------------------------------- | ------ | --------------------- |
| 1    | A.3.1 Annual quota presence       | A      | **3.92%**             |
| 2    | D.2.1 Citizenship pathway boolean | D      | **3.70%**             |
| 2    | D.2.2 Years to citizenship        | D      | **3.70%**             |
| 4    | B.3.1 Total applicant cost (USD)  | B      | **3.15%**             |
| 5    | C.2.1 Spouse inclusion            | C      | **2.80%**             |
| 6    | A.1.1 Salary % of median          | A      | **2.45%**             |
| 7    | A.2.2 Compensatory vs conjunctive | A      | **2.35%**             |
| 8    | C.1.1 Employer switching          | C      | **2.24%**             |
| 9    | C.2.1 — see above                 |        |                       |
| 10   | B.1.1 SLA days                    | B      | **2.21%**             |

**Single most concentrated leverage:** the D.2 sub-factor (`D.2.1 + D.2.2 + D.2.3`) accounts for **9.24% of the composite** in total. A combined error in citizenship-pathway extraction has more rank impact than any other sub-factor.

**Single-indicator sub-factors:** A.3.1 (Volume) and B.3.1 (Cost) each carry 100% of their sub-factor's weight — any missing-data event on either zeroes out 4% / 3% of the composite via the `(present/total)^0.5` penalty. They are the most fragile points in the structure.

---

## 3. The eight analyses (B1–B8)

Every analysis has the same shape: perturb one part of the methodology, rescore the cohort, measure the change. Results land in `sensitivity_runs` (one row per perturbation) and roll up into the public methodology page sensitivity section.

For each analysis below: **Goal** (what question it answers), **Method** (precise specification for the runner), **Minimum cohort size** (below which the result is not interpretable), **Output schema** (what gets written to `sensitivity_runs.perturbation_jsonb`).

### B1 — Weight-vector Monte Carlo (full hierarchy)

**Goal.** Quantify how sensitive the composite ranking is to plausible perturbations across the full pillar / sub-factor / indicator weight hierarchy.

**Method.** 1,000 trials. Each trial:

1. Sample pillar weights from `Dirichlet(α_pillar)` where `α_pillar = baseline_pillar_weights × 5` (concentration tuned so ±20% is the typical perturbation; verify by Monte Carlo before running).
2. For each pillar, sample sub-factor weights from `Dirichlet(α_subfactor)` where `α_subfactor = baseline_subfactor_weights_within_pillar × 5`.
3. For each sub-factor, sample indicator weights from `Dirichlet(α_indicator)` similarly.
4. Inject the perturbed weights into the `ScoringInput.fieldDefinitions` (modify `weightWithinSubFactor`) and pass an override map for pillar/sub-factor weights.
5. Run `runScoringEngine(input)` for every programme.
6. Capture: per-programme `composite`, `paq`, `pillar_scores`, ranking. Spearman ρ vs baseline. Per-programme rank shift.

**Reports.** Median rank per programme (5th–95th percentile band). Spearman ρ histogram. Top-10 stability rate (% of trials where the same programmes occupy ranks 1–10, in any order). Max rank shift observed for any programme.

**Minimum cohort:** `n ≥ 10`. Below that, Spearman ρ has too few rank pairs to be interpretable.

**Output schema** (one row per trial):

```json
{
  "trial": 0,
  "pillar_weights": {"A": 0.27, "B": 0.16, "C": 0.21, "D": 0.21, "E": 0.15},
  "subfactor_weights": {"A.1": 0.48, "A.2": 0.31, ...},
  "indicator_weights": {"A.1.1": 0.24, "A.1.2": 0.21, ...},
  "rank_shifts": {"prog-uuid-1": 0, "prog-uuid-2": 1, ...}
}
```

### B2 — CME / PAQ split robustness

**Goal.** Test the methodology's published claim that "top-10 ordering changes by at most 2 positions at the 50/50 extreme" (METHODOLOGY.md §1.2).

**Method.** Re-blend each programme's existing PAQ + CME values under five alternative splits:

- 20/80, 25/75, 30/70 (baseline), 35/65, 40/60, 50/50

Pure arithmetic; no re-extraction or re-aggregation needed. Already implemented in [`scripts/sensitivity.ts:179`](../../scripts/sensitivity.ts#L179) as `cmePaqSplitPerturbations`.

**Minimum cohort:** `n ≥ 5` to produce a directional reading; `n ≥ 10` for the published top-10-stability claim to be testable.

**Output schema:**

```json
{
  "split": "50/50",
  "cme_weight": 0.5,
  "paq_weight": 0.5
}
```

**Pass criterion** (matches methodology claim): max top-10 rank shift ≤ 2 at the 50/50 extreme. If exceeded, the methodology claim must either be revised down or the split itself must change. See §4 — revision triggers.

### B3 — Pillar weight alternatives

**Goal.** Isolate the impact of each pillar weight on the composite, holding sub-factor and indicator weights fixed.

**Method.** For each of the 5 pillars:

- Vary its weight by ±10%, ±20%, ±30% of baseline (multiplicative).
- Redistribute the delta proportionally across the other 4 pillars so the vector still sums to 1.0.
- Rescore the cohort. Spearman ρ + max rank shift.

Total: 5 pillars × 6 perturbations = 30 trials.

**Reports.** Heatmap: `pillar × perturbation_size → max_rank_shift`. Identifies which pillar's weight most affects rank stability.

**Minimum cohort:** `n ≥ 10`.

**Output schema:**

```json
{
  "perturbed_pillar": "A",
  "perturbation_pct": 20,
  "pillar_weights_after": { "A": 0.336, "B": 0.139, "C": 0.185, "D": 0.204, "E": 0.139 }
}
```

### B4 — Sub-factor weight alternatives (within pillar)

**Goal.** Within each pillar, are the sub-factor weights actually doing different work? If two sub-factors are swap-equivalent at the rank level, the weight difference is meaningless.

**Method.** For each pillar (A/B/C/D/E — 5 pillars):

1. Equal-weighting variant (e.g. A.1=A.2=A.3=33.3%).
2. Inverted-weighting variant (largest becomes smallest, smallest becomes largest).
3. ±15% perturbation per sub-factor (re-normalised to sum to 1.0).

Hold pillar weights and indicator weights at baseline. Rescore cohort. Capture pillar-score change per programme + composite-score change.

Total: 5 pillars × 3 variants = 15 trials.

**Minimum cohort:** `n ≥ 10`.

**Output schema:**

```json
{
  "pillar": "A",
  "variant": "equal_weighting",
  "subfactor_weights_after": { "A.1": 0.333, "A.2": 0.333, "A.3": 0.333 }
}
```

### B5 — Indicator dropout (per indicator)

**Goal.** Identify load-bearing vs redundant indicators. An indicator whose removal causes substantial rank shift carries genuine information; one whose removal changes nothing is redundant or near-tautological with another indicator.

**Method.** For each of the 33 indicators:

1. Exclude it from the `ScoringInput` (filter `fieldDefinitions` and `fieldValues`).
2. Let the engine's missing-data penalty + weight re-normalisation handle the gap (`reNormalizeWeights` in [`packages/scoring/src/score.ts:67`](../../packages/scoring/src/score.ts#L67)).
3. Rescore. Capture composite-score delta per programme + rank shift.

**Reports.** Per-indicator: max rank shift across cohort, max composite-delta. Flag any indicator whose removal moves any programme >5 ranks — that indicator is over-leveraged and its weight is too high.

**Minimum cohort:** `n ≥ 10`.

**Output schema** (one row per indicator):

```json
{
  "dropped_indicator": "A.3.1",
  "max_rank_shift": 3,
  "max_composite_delta": 4.21
}
```

### B6 — Geometric vs arithmetic aggregation

**Goal.** Test whether compensability between pillars is doing too much work. Arithmetic mean lets a strong pillar hide a weak one; geometric mean punishes any low score in any pillar.

**Method.** Three aggregation regimes:

1. **Arithmetic everywhere** (baseline).
2. **Geometric at pillar level only** (current `aggregator: 'geometric'` mode in [`packages/scoring/src/score.ts:46`](../../packages/scoring/src/score.ts#L46)).
3. **Geometric at both sub-factor AND pillar level** (more aggressive non-compensability).

Rescore cohort under each regime. Capture: top-10 stability vs baseline, programme-by-programme composite delta, identification of programmes whose composite is propped up by one strong pillar (high arithmetic, low geometric).

**Minimum cohort:** `n ≥ 5` for directional reading, `n ≥ 10` for stability claims.

**Output schema:**

```json
{
  "aggregator": "geometric_subfactor_AND_pillar",
  "compensability_loss_per_program": {"prog-uuid-1": 0.5, ...}
}
```

### B7 — Correlation and redundancy

**Goal.** Identify indicator pairs that are double-counting the same signal. Within a sub-factor, `|ρ| > 0.85` means at least one of the weights is wrong. Cross-sub-factor `|ρ| > 0.90` is a deeper structural redundancy.

**Method.**

1. Build the cohort × indicator matrix from approved field_values (normalised scores per indicator per programme).
2. Compute the full **33 × 33 Pearson correlation matrix** across all programmes in the cohort.
3. Flag any within-sub-factor pair with `|ρ| > 0.85`.
4. Flag any cross-sub-factor pair with `|ρ| > 0.90`.
5. Compute the eigenvalue spectrum / condition number of the correlation matrix.
6. Hierarchical-cluster indicators on `1 − |ρ|` distance — visualise to spot redundancy clusters.

**Reports.** The full matrix as a CSV / JSONB. Top-10 highest-correlated pairs. Eigenvalue scree plot. Dendrogram of indicator clusters.

**Minimum cohort:** `n ≥ 30`. Pearson on 33 dimensions needs `n ≥ p` to be invertible and `n ≥ 30` for moderate stability of the off-diagonal entries.

**Output schema:**

```json
{
  "matrix_shape": [33, 33],
  "matrix_jsonb": {...},
  "high_correlation_pairs": [
    {"a": "A.1.1", "b": "A.1.3", "rho": 0.87, "scope": "within_subfactor"}
  ],
  "condition_number": 12.4
}
```

### B8 — Rank-aggregation alternatives (Borda / outranking)

**Goal.** Sanity-check the methodology's compensatory weighted-arithmetic ranking against non-compensatory rank-aggregation methods. If Borda or outranking produces a wildly different cohort leader, the weighted-arithmetic ranking is selecting on something other than indicator-level evidence.

**Method.**

1. Convert each programme to per-indicator rank within the cohort.
2. **Borda count** — sum of ranks per programme; lower is better.
3. **Outranking score** — pairwise wins per programme (Condorcet-style: programme A outranks programme B if A is at least as good on a majority of weighted indicators).
4. Compute Spearman ρ between the baseline composite ranking and each of (Borda, outranking).

**Reports.** Spearman ρ between composite ranking and each alternative. Programmes with the largest rank disagreement.

**Minimum cohort:** `n ≥ 5`. Pairwise comparisons start being interpretable at this size.

**Output schema:**

```json
{
  "method": "borda",
  "rho_vs_composite": 0.94,
  "max_rank_disagreement": { "program_id": "prog-uuid-1", "composite_rank": 3, "borda_rank": 7 }
}
```

---

## 4. Weight revision triggers

Two tiers of action that a sensitivity finding can trigger.

### Tier 1 — sensitivity-report note (lighter; no methodology change)

Include in the published sensitivity report under the methodology version, but do not change weights. Triggered by:

- **Spearman ρ < 0.95 vs baseline under any single perturbation, but no programme moves >3 ranks.** Pillar X's weight has measurable rank impact at the cohort scale; consider monitoring at the next cohort size.
- **A correlation pair `0.80 ≤ |ρ| ≤ 0.85` within the same sub-factor.** Flag for the v7 review.
- **A single programme moves >5 ranks under any perturbation, while top-10 stability rate is ≥ 90%.** That programme's rank is fragile to weight choice; add a "borderline" chip on its detail page; do not change methodology.
- **Geometric vs arithmetic aggregation produces a different cohort leader, but the top-3 set is unchanged.** Note that compensability is shifting the leader; surface in the About page; no methodology change.

### Tier 2 — methodology version bump (heavier; ADR + new weights)

The result is sufficient evidence to change the weights. Triggers:

- **Top-10 stability < 80% under the spec's 1,000-trial Monte Carlo.** The methodology promises rank stability under perturbation; if it doesn't hold, the weights are wrong, not the data. Mandates ADR + v7 weight redesign.
- **Any pillar's weight, when perturbed by ±20%, changes the cohort leader.** That pillar's weight is too dominant for the methodology's stated intent.
- **A correlation pair with `|ρ| > 0.90` within a sub-factor.** At least one of the two indicators is redundant; either drop one or consolidate. ADR required.
- **Indicator dropout: any single indicator's removal causes a programme to move >5 ranks.** That indicator is over-leveraged; its weight is too high. Either lower the weight or rebalance the sub-factor.
- **Geometric mean materially changes the top-3 (any of the top-3 programmes drops out).** Compensability is doing too much work; consider partial-geometric aggregation at the pillar level. ADR required.
- **B2 violates the methodology's published claim** ("top-10 ordering changes by at most 2 positions at the 50/50 extreme"). The claim must be retracted from METHODOLOGY.md §1.2 or the split must change. Either is a version bump.

### Non-triggers — what does NOT cause a revision

- Programme rank shifts on `n < 10`. Treat as runner-shape proof only.
- Any correlation finding on `n < 30`. Pearson is unstable below that threshold.
- Spearman ρ between Borda and weighted-arithmetic. The two methods are intentionally non-equivalent (Borda is non-compensatory by construction). Surface as background reading, not a trigger.
- A programme moving by 1–2 ranks under any perturbation. Always within noise at any cohort size.

### Documentation discipline

Each sensitivity run produces:

- A `docs/sensitivity-reports/v{version}-{YYYY-MM-DD}.md` summarising findings + triggered actions.
- An ADR for any methodology change ("ADR-XXX: weight revision following sensitivity run YYYY-MM-DD").
- A row in `sensitivity_runs` for every perturbation (already wired by migration 00018).
- An entry in `methodology_versions.calibrated_params` if normalisation parameters change as a downstream consequence (column added by migration 00023).

---

## 5. Recommended sequencing

Cohort grows progressively. The plan unlocks analyses in three tiers as the cohort hits each threshold.

### Tier 1 — n ≥ 5 (runner-shape proof + first signals)

Run **B2, B6, B8**. These are the analyses for which n=5 is enough to produce a directional signal. Treat results as runner-shape verification first; report findings with explicit caveats about cohort size.

Expected output: a first sensitivity report committed to `docs/sensitivity-reports/v6.0.0-{YYYY-MM-DD}.md`. No methodology change at this stage.

### Tier 2 — n ≥ 10 (publishable findings)

Run **B1, B3, B4, B5, B6** (B6 re-runs at higher confidence). These are the analyses whose outputs become publishable to the methodology page once n hits 10. Tier 2 is where the first revision triggers can fire — if any do, they cause an ADR + v7 bump (see §4).

Expected output: full sensitivity report + public methodology page sensitivity section live + decision on whether v7 is warranted.

### Tier 3 — n ≥ 30 (correlation matrix)

Run **B7**. This is the most data-hungry analysis and arguably the most consequential for weight design. n=30 is the floor for a stable 33×33 Pearson matrix.

Expected output: redundancy clusters identified; decision on whether any indicator pair should be consolidated; potentially v7 (or v8) methodology change.

### What this plan does NOT sequence

- **Re-extraction of the cohort.** Getting from n=0 (current state) to n=5 requires running the production extraction pipeline against programmes and working the human-review queue to approval. That is a separate operational task, not a sensitivity-analysis task.
- **Calibration.** Calibrated normalisation params are a separate concern from weight sensitivity. The two interact (normalisation parameters affect indicator scores → composite scores → sensitivity findings) but the order is: calibrate first, then run sensitivity against calibrated scores. If the cohort is already calibrated when the trigger fires, proceed directly; if not, calibrate first.

---

## 6. Infrastructure assessment

See [`RUNNER-GAPS.md`](./RUNNER-GAPS.md) for the precise per-analysis implementation checklist.

### What exists and is sufficient

| Component                                | State                                                                                                      | Notes                                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sensitivity_runs` table                 | Migration 00018, applied                                                                                   | Carries `analysis_type`, `run_id`, `perturbation_jsonb`, `baseline_ranking_jsonb`, `perturbed_ranking_jsonb`, `spearman_rho`, `top10_shift`, `methodology_version_id`, `ran_at`. |
| `scripts/sensitivity.ts` runner skeleton | 498 lines                                                                                                  | Implements 6 analyses; supports `--execute` toggle; persists rows. Production-shaped.                                                                                            |
| `runScoringEngine`                       | [`packages/scoring/src/engine.ts`](../../packages/scoring/src/engine.ts)                                   | Pure function, accepts overrideable weights, normalisation params, aggregator.                                                                                                   |
| `aggregateWeightedGeometricMean`         | [`packages/scoring/src/score.ts:46`](../../packages/scoring/src/score.ts#L46)                              | Honours zero-collapse semantics.                                                                                                                                                 |
| `methodology_versions.calibrated_params` | Migration 00023, applied                                                                                   | Lets each methodology version pin its calibration.                                                                                                                               |
| Public methodology page hook             | [`apps/web/app/(public)/methodology/page.tsx:286-303`](<../../apps/web/app/(public)/methodology/page.tsx>) | Empty-state already wired; auto-renders when `sensitivity_runs` carries rows.                                                                                                    |

### What needs to be built

See [`RUNNER-GAPS.md`](./RUNNER-GAPS.md). Summary:

| Analysis                               | Existing runner suffices?                             | Action                          |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| B1 Weight Monte Carlo (full hierarchy) | No (current implementation only varies CME/PAQ blend) | Rewrite (~80 LOC)               |
| B2 CME/PAQ split                       | Yes                                                   | None                            |
| B3 Pillar weight alternatives          | No                                                    | Add (~50 LOC)                   |
| B4 Sub-factor weight alternatives      | No                                                    | Add (~50 LOC)                   |
| B5 Indicator dropout (per-indicator)   | No (current does pillar dropout)                      | Add (~40 LOC)                   |
| B6 Geometric vs arithmetic             | Partially (pillar-level only)                         | Add sub-factor option (~20 LOC) |
| B7 Correlation 33×33                   | No (current is PAQ/CME scalar only)                   | Rewrite (~60 LOC)               |
| B8 Borda / outranking                  | No                                                    | Add (~80 LOC)                   |

Estimated implementation effort to bring the runner to spec: **1–2 days of focused work**. The DB connection, ScoringInput loading, perturbation JSONB persistence, Spearman + top-10 helpers, dry-run/execute toggle, and core scoring engine are all already in place.

---

## 7. Output format

### 7.1 Per-perturbation row → `sensitivity_runs`

Existing schema. Each analysis run gets a fresh `run_id` UUID; perturbations within that run share it. New runs of the same `analysis_type` get a new `run_id`. The methodology page reads the most-recent `run_id` per `analysis_type`.

Required JSONB fields (all already present in the schema):

- `perturbation_jsonb` — analysis-specific perturbation descriptor (see §3 per-analysis schemas)
- `baseline_ranking_jsonb` — `[{programId, rank}]` from the unperturbed scoring
- `perturbed_ranking_jsonb` — `[{programId, rank}]` from this perturbation
- `spearman_rho` — single float
- `top10_shift` — integer count of top-10 disagreements

### 7.2 Public methodology page (`/methodology`)

Replace the empty-state in [`apps/web/app/(public)/methodology/page.tsx:286-303`](<../../apps/web/app/(public)/methodology/page.tsx>) with a `<SensitivitySection>` component:

- One panel per analysis_type
- Panel content: brief explanation (read from `apps/web/content/methodology/sensitivity-{type}.md`), summary stats (median Spearman ρ, top-10 stability %, max rank shift), small chart (perturbation density), "pinned to methodology v{ver} on YYYY-MM-DD" footer
- Click-through to a dedicated subpage `/methodology/sensitivity/{type}` with the full perturbation table

Estimated LOC: ~200 of React + ~7 small content/methodology/sensitivity-\*.md files.

### 7.3 Sensitivity-report PDF (`/methodology/sensitivity-report`)

New printable route mirroring [`/methodology/whitepaper`](<../../apps/web/app/(public)/methodology/whitepaper/page.tsx>). Produces a print-ready document:

- Cover page: methodology version, run date, cohort size n, summary verdict (robust / acceptable / fragile)
- One section per analysis (B1–B8): method paragraph, summary stats, 1–2 charts, triggered actions
- Appendix: full perturbation table (CSV-style)
- Reproducibility footer: `run_id`, `methodology_version_id`, exact git SHA of the runner

Generated by browser-print on the printable route. No server-side PDF library needed.

### 7.4 Internal sensitivity report (`docs/sensitivity-reports/v{ver}-{date}.md`)

Permanent repo record. One file per sensitivity-run pass against a methodology version:

- Cohort scored against (size, programme list, methodology pin, calibration state)
- Summary table of all 8 analyses with verdict
- Triggered weight revisions, if any
- ADRs spawned

This is the artifact a peer reviewer reads end-to-end.

---

## 8. Reproducibility guarantee

Given:

- A `methodology_version_id` and the corresponding row in `methodology_versions`
- The `field_values` rows used as input (status='approved' as of run timestamp)
- The `calibrated_params` JSONB pinned to that methodology version
- The git SHA of `scripts/sensitivity.ts`

…re-running the analysis produces byte-identical `sensitivity_runs` rows. The Monte Carlo variants use a seeded RNG (must be added — see `RUNNER-GAPS.md` B1) so even probabilistic analyses are deterministic given a seed.

This is the same reproducibility guarantee the methodology already provides for scoring; the sensitivity layer extends it.

---

## 9. What this plan does not claim

- It does not claim the current weights are correct. It claims the framework to test them is in place.
- It does not claim a specific outcome. Any of the 8 analyses could surface a Tier 2 trigger and force a v7 bump; the plan does not pre-commit to a result.
- It does not replace a peer review. The sensitivity findings are inputs to a peer review, not a substitute for one.
- It does not cover normalisation calibration or indicator definition validation. Those are separate concerns with their own paths.

---

_Authored 2026-05-07 against methodology v6.0.0. Activates at trigger condition above. See [`TRIGGER.md`](./TRIGGER.md) for first-action steps._
