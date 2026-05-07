# Sensitivity analysis — activation document

**Read this first.** This is the single-page entry point for the GTMI weight sensitivity analysis. The full plan is in [`PLAN.md`](./PLAN.md). The runner gaps are in [`RUNNER-GAPS.md`](./RUNNER-GAPS.md). The weight rationales draft is in [`WEIGHT-RATIONALES.md`](./WEIGHT-RATIONALES.md).

## Status

**Currently dormant.** This plan was authored on 2026-05-07 against methodology v6.0.0. It does not execute until the cohort grows past the activation threshold below.

## Trigger condition

The plan activates when the production database returns at least 5 programmes with un-flagged composite scores. Check:

```sql
SELECT COUNT(*) FROM scores WHERE flagged_insufficient_disclosure = false;
```

- **n < 5** — do nothing. Sensitivity analysis is not yet meaningful. No analysis in the plan can run with sub-5 cohort.
- **n ≥ 5** — proceed to the first action below.

The threshold is a hard floor, not a target. n ≥ 5 unlocks B2, B6, and B8 only. Larger cohorts unlock progressively more analyses — see `PLAN.md` §c (cohort coverage constraint) for the per-analysis minimums.

## First action when the trigger fires

Before executing any analysis:

1. **Read [`WEIGHT-RATIONALES.md`](./WEIGHT-RATIONALES.md) and surface every entry marked `[NEEDS SZABI REVIEW]`.** Sub-factor weights without a documented rationale need to be reviewed and either justified, revised, or explicitly accepted as undocumented before the sensitivity-report writes any conclusions about them. Post the list to Szabi and wait for confirmation.
2. **Read [`RUNNER-GAPS.md`](./RUNNER-GAPS.md) and confirm which checklist items are still open.** Implement the gaps for the analysis tier that the current cohort size unlocks (n ≥ 5 → tier 1; n ≥ 10 → tier 1+2; n ≥ 30 → all three tiers).
3. **Read [`PLAN.md`](./PLAN.md) §b (analysis design) and §d (revision triggers).** Pick the specific analyses to run, in the order recommended by §sequencing. Run with `--execute` only after a dry-run inspection.

## Infrastructure already in place — no schema work needed

- `sensitivity_runs` table — migration `00018_sensitivity_runs.sql`, applied to prod 2026-05-07.
- `methodology_versions.calibrated_params` column — migration `00023_methodology_calibrated_params.sql`, applied 2026-05-07. Lets the runner pin a version.
- `score_history` table — migration `00019_score_history.sql`, applied 2026-05-07. Used for rank-shift tracking across re-scores.
- Runner skeleton — `scripts/sensitivity.ts`. 498 lines. Implements the 6 original analyses (`weight_monte_carlo`, `normalization`, `aggregation`, `cme_paq_split`, `indicator_dropout`, `correlation`) but most are degraded versions — see `RUNNER-GAPS.md` for the precise list of what each analysis needs.
- Public methodology page hook — `apps/web/app/(public)/methodology/page.tsx` lines 286–303 already render an empty-state for sensitivity analyses. The hook will auto-populate once `sensitivity_runs` carries rows.

## What this plan does NOT cover

- Cohort growth itself. The path to n ≥ 5 runs through extraction + human review. Not in scope here.
- Methodology v7. Any weight revision triggered by the analysis is a separate ADR + version bump — see `PLAN.md` §d for the trigger criteria.
- Normalisation calibration. The methodology already supports calibrated params via migration 00023; calibration is a separate operational concern (replacing engineer-chosen `x_min`/`x_max` with cohort percentiles), not a sensitivity finding.

## Reproducibility footer

This plan assumes:

- Methodology v6.0.0 (33 indicators, 5 pillars, 14 sub-factors, 30/70 CME/PAQ split, pillar weights A:28 B:15 C:20 D:22 E:15)
- Migrations 00001–00030 all applied
- Runner present at `scripts/sensitivity.ts`
- 14-sub-factor weight map present in `packages/scoring/src/score.ts:23` and `packages/db/src/seed/methodology-v1.ts:51`

If any of those assumptions is no longer true at activation time, **re-validate the plan against the new methodology version before executing**. Stale plans against revised methodologies produce misleading sensitivity findings.
