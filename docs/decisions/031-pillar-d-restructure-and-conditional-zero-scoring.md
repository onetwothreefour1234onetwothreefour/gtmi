# ADR-031 — Pillar D restructure + conditional zero-scoring; supersedes ADR-016 / ADR-014 / ADR-025 D portions

**Status:** Approved
**Date:** 2026-05-06
**Authors:** Szabi (methodology review).

---

## Context

### Pillar D restructure

Methodology v4 Pillar D ("Pathway") had eleven indicators across three
sub-factors (D.1 Permanent Residence, D.2 Citizenship, D.3 Tax
Treatment). The methodology review collapsed Pillar D to **five
indicators across two sub-factors**, retiring the entire D.3 tax
sub-factor and three additional indicators:

- old **D.1.3** PR-accrual physical presence (boolean+annotation,
  derived from `COUNTRY_PR_PRESENCE_POLICY`)
- old **D.1.4** PR retention rules (boolean+annotation, derived)
- old **D.2.4** Civic / language / integration test burden
  (categorical, derived from `COUNTRY_CIVIC_TEST_POLICY`)
- old **D.3.1** Tax residency trigger days (numeric, derived from
  `COUNTRY_TAX_RESIDENCY`)
- old **D.3.2** Special tax regime available (categorical)
- old **D.3.3** Territorial vs. worldwide taxation (categorical,
  derived from `COUNTRY_TAX_BASIS`)

The five surviving Pillar D indicators (D.1.1, D.1.2, D.2.1, D.2.2,
D.2.3) keep the same data types and directions as v4, but acquire
substantively different semantics:

- All Pillar D fields move to LLM extraction (was country-derived
  via Stage 6.5 deriveDxx functions).
- D.1.2 / D.2.2 score conditionally on D.1.1 / D.2.1 — when the
  parent boolean is false, the child scores 0 (not null) regardless
  of the child's own value.

### Conditional zero-scoring (new pattern)

The codebase had three sentinel/marker patterns:

1. `NO_LIMIT_MARKER` → score 100 / 0 based on direction (no_cap).
2. `notApplicable: true` marker → score null, excluded from cohort.
3. `boolean_with_annotation` (ADR-014) → boolean + structured metadata.

The dispatch's "score = 0, not null" semantic for D.1.2 / D.2.2 is
**none of these**. It means: "the indicator IS measured, the answer
IS deterministic, and the answer is the WORST possible score because
the parent pathway doesn't exist." A pathway-unavailable programme
should NOT silently dodge the penalty by failing to extract the
child indicator.

## Decision

### Pillar D restructure

1. The new Pillar D is documented in `methodology-v1.ts` with the
   weight tree:
   - D.1 Permanent Residency = 0.40 (D.1.1=0.50, D.1.2=0.50)
   - D.2 Citizenship = 0.60 (D.2.1=0.40, D.2.2=0.40, D.2.3=0.20)
2. Pillar D weight within PAQ stays **0.22**. Total methodology
   indicator count drops from 43 to **37**.
3. The six retired keys (D.1.3, D.1.4, D.2.4, D.3.1, D.3.2, D.3.3)
   are deleted from `field_definitions`. All Pillar D `field_values`
   rows are hard-deleted by migration 00029 to force re-extraction
   under the new prompts.
4. All eight Pillar D `deriveDxx` functions are removed from
   `packages/extraction/src/stages/derive.ts`:
   `deriveD12`, `deriveD13`, `deriveD14`, `deriveD22`, `deriveD23`,
   `deriveD24`, `deriveD31`, `deriveD33`. The corresponding input
   interfaces and orchestrator branches are deleted.
5. The seven Pillar D country-policy data modules
   (`COUNTRY_PR_TIMELINE`, `COUNTRY_PR_PRESENCE_POLICY`,
   `COUNTRY_CITIZENSHIP_RESIDENCE_YEARS`,
   `COUNTRY_DUAL_CITIZENSHIP_POLICY`, `COUNTRY_CIVIC_TEST_POLICY`,
   `COUNTRY_TAX_RESIDENCY`, `COUNTRY_TAX_BASIS`) are retained as
   analyst reference but no longer plumbed into the extraction
   orchestrator.
6. `methodology_versions.version_tag` bumps from `4.0.0` to `5.0.0`.

### Conditional zero-scoring

7. A new module `packages/scoring/src/score-dependencies.ts`
   exports `SCORE_DEPENDENCIES` — a map of `{child: {parent,
whenParentIs, score}}` declarations. The v5 entries are:
   - `'D.1.2': { parent: 'D.1.1', whenParentIs: false, score: 0 }`
   - `'D.2.2': { parent: 'D.2.1', whenParentIs: false, score: 0 }`
8. `scoreSingleIndicator` accepts an optional `parentValue: unknown`
   argument. When the field has a `SCORE_DEPENDENCIES` entry AND
   `parentValue === dep.whenParentIs`, the function returns
   `dep.score` and skips the normal evaluation entirely (the child's
   own value is irrelevant when the parent gate fires).
9. `runScoringEngine` builds a `valueByKey: Map<string, unknown>`
   alongside the existing `valueByDefId` and passes the parent
   through `scoreIndicator` for every Pillar D scored row.
10. **Virtual zero synthesis**: after the main scoring loop,
    `runScoringEngine` iterates `SCORE_DEPENDENCIES` and synthesises
    a virtual indicator result for any child whose parent gate fires
    AND whose own `field_values` row is absent. This makes the
    cohort scoring independent of LLM coverage on the child — a
    pathway-unavailable programme always produces the dependency
    score for the child, even if no extraction was attempted.
11. `normalize-raw.ts` accepts the `'not_applicable'` token (any
    casing, any whitespace) for `min_max` and `z_score` fields and
    converts to the existing `notApplicable` marker with
    `reason: 'pathway unavailable'`. The marker shape is reused —
    same `isNotApplicableMarker` predicate, different reason string.
12. The `/review` server actions (`actions.ts` + `rescore-actions.ts`)
    fetch the parent's `value_normalized` from `field_values` before
    calling `scoreSingleIndicator`. Single-row, programme-level, and
    cohort-level rescore paths all pass `parentValue` through.
13. The dispatch's wire format `{value: null, no_cap: true,
source_sentence, confidence}` is **NOT** adopted as the
    extraction-time shape. The token-string approach is preserved
    (zero plumbing risk; semantically equivalent at the normalized
    layer).

### Tax-treatment widget removal

14. The `/countries/[iso]` "tax regime" widget (which bucketised
    D.3.2 + D.3.3 across the country's programmes) is removed
    entirely:
    - `country-detail-helpers.ts`, `tax-treatment-card.tsx`, and the
      `country-detail.test.ts` aggregator tests are deleted.
    - The `CountryTaxTreatment` type is removed from
      `country-detail-types.ts`.
    - The widget invocation site in
      `apps/web/app/(public)/countries/[iso]/page.tsx` is replaced
      with a placeholder noting "Tax data is no longer part of the
      GTMI methodology".

### boolean_with_annotation infrastructure

15. With D.1.3 / D.1.4 retired, ZERO active fields use
    `boolean_with_annotation`. The infrastructure
    (`BOOLEAN_WITH_ANNOTATION_KEYS` map — now empty,
    `normalizeBooleanWithAnnotation`, the engine branch,
    `validateBooleanWithAnnotationShape`) is **left in place
    dormant** alongside `country_substitute_regional` (also dormant
    after C.3.2 reverted in ADR-030). Cleanup of both dormant
    infrastructures is bundled into a follow-up **ADR-032 PR**.

## Consequences

### Positive

- Pillar D scoring becomes much more discriminating: 5 high-signal
  indicators vs 11 mixed-signal indicators. The conditional-zero
  rule prevents pathway-unavailable programmes from scoring well on
  D.1.2 / D.2.2 by sheer absence of data.
- The 8 Pillar D `deriveDxx` functions and their orchestrator
  plumbing are deleted (~700 lines of code + tests). Stage 6.5 now
  only handles E.1.1 (severity-weighted policy changes) and E.1.3
  (program age).
- The new `SCORE_DEPENDENCIES` config map is discoverable, testable,
  and extensible. Future indicators with parent-child relationships
  (e.g. tax-residency-conditional indicators) can be added with a
  single map entry.
- `boolean_with_annotation` and `country_substitute_regional` both
  reach zero production users, clearing the way for the ADR-032
  cleanup PR to delete ~400 lines of dormant scoring infrastructure.

### Negative / risks

- All Pillar D `field_values` rows hard-deleted: 11 keys × 30
  countries × N programmes = ~300+ rows lost. Re-extraction under
  the new prompts is required before the cohort is scoreable on
  Pillar D again.
- The conditional-zero rule changes the scoring semantics for
  programmes that previously had D.1.1=false but D.1.2=null
  (excluded from cohort). Under v5 those programmes now score 0 on
  D.1.2 — sub-factor coverage rises but the absolute score drops
  for affected programmes (most GCC monarchies).
- The `/review` parent-value lookup adds a small DB round-trip per
  rescored row when the field has a SCORE_DEPENDENCIES entry. With
  only D.1.2 / D.2.2 affected, the overhead is bounded; if the map
  grows, batching the parent lookups becomes a future optimisation
  target.
- The dormant `boolean_with_annotation` and
  `country_substitute_regional` infrastructure is dead code for one
  more PR cycle. The ADR-032 follow-up should land soon.
- Same `methodology_versions.calibrated_params` cleanup caveat as
  ADR-028 / ADR-029 / ADR-030: column not present on every
  environment; `apply-migration.ts` cannot run a `DO $$ ... END $$`
  block; the D.\* strip is documented as a manual one-liner in the
  migration.

## Migration

`supabase/migrations/00029_pillar_d_v5_purge.sql`:

1. Hard-delete every `field_values` row tied to a Pillar D
   `field_definitions` row. Cleans dependent rows in `review_queue`,
   `policy_changes`, `extraction_attempts`, and `extraction_prompts`
   first.
2. Delete the six retired keys (`D.1.3`, `D.1.4`, `D.2.4`, `D.3.1`,
   `D.3.2`, `D.3.3`) so they don't linger as orphaned
   `field_definitions` rows after re-seed.
3. Comment-only note for the `calibrated_params` D.\* cleanup
   one-liner (run separately on environments that have 00023
   applied).

The seed bumps `methodology_versions.version_tag` from `4.0.0` to
`5.0.0`; `methodology-v1.ts` upserts the new Pillar D indicators in
place via `onConflictDoUpdate` on `field_definitions.key` for the
five surviving keys (D.1.1, D.1.2, D.2.1, D.2.2, D.2.3).

## Related ADRs

- **Supersedes (D.1.2 / D.2.2 / D.2.3 derive paths only):**
  ADR-016 (Derived fields — Stage 6.5). ADR-016 remains in force for
  E.1.1 and E.1.3.
- **Supersedes (D.1.3 / D.1.4 boolean_with_annotation):** ADR-014
  (Methodology v2 indicator review). The C.3.2
  `country_substitute_regional` portion of ADR-014 was already
  superseded by ADR-030.
- **Supersedes (D.2.4 / D.3.1 / D.3.3 country-level derives):**
  ADR-025 (Country-level derives D.2.4, D.3.1, D.3.3, E.1.1, E.1.3).
  ADR-025 remains in force for E.1.1 and E.1.3.
- **Related:** ADR-013 (Tier-2 allowlist; D.2.3 stays on the
  allowlist), ADR-019 (Rubric validation gate), ADR-028 (Pillar A
  restructure), ADR-029 (Pillar B restructure), ADR-030 (Pillar C
  restructure + sentinel hardening).
- **Defers cleanup to:** **ADR-032** (forthcoming) — delete dormant
  `boolean_with_annotation` + `country_substitute_regional`
  infrastructure now that both have zero active fields.
