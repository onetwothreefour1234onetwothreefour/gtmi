# ADR-028 — Pillar A restructure (methodology v2.0.0); supersedes ADR-016 for Pillar A derivation

**Status:** Approved
**Date:** 2026-05-05
**Authors:** Szabi (methodology review).

---

## Context

Methodology v1 Pillar A had nine indicators across three sub-factors (A.1
Qualification thresholds, A.2 Education / experience / language, A.3
Volume & selectivity). Two of those indicators were dropped in this
review as low-signal under the index's measurement objective:

- old **A.3.1** — Occupation list constraint (open / restricted /
  shortage list)
- old **A.1.3** — Alternative qualification pathways (salary / points /
  patent variants)

The remaining seven indicators survive but with different keys, and two
new indicators are added (number of mandatory qualifying criteria;
system type compensatory vs. conjunctive vs. hybrid). The full new
Pillar A is documented in `methodology-v1.ts`.

ADR-016 introduced Stage 6.5 (Derive) to deterministically compute two
indicators that could not be extracted as a verbatim sentence: **A.1.2
— salary threshold as % of local median wage** (computed from A.1.1
absolute salary ÷ country median wage × 100) and **D.2.2 — years to
citizenship**. Under v2.0.0, the % of median moves to a directly
extracted indicator at the new key A.1.1; the absolute salary
indicator is dropped. There is no longer a Pillar A field that needs
deterministic derivation.

## Decision

The Pillar A portion of ADR-016 is **superseded**.

1. Stage 6.5 is no longer a producer of any Pillar A row. The
   `deriveA12` function, the `DerivedA12Input` interface, the
   `buildA12NotApplicableRow` helper, the `POINTS_BASED_A13_VALUES`
   constant, and the `inputs.a12` field on `DeriveStageInputs` are all
   removed (`packages/extraction/src/stages/derive.ts`,
   `packages/extraction/src/types/pipeline.ts`).
2. The new A.1.1 ("Salary threshold as % of local median wage",
   numeric, min_max, lower_is_better) is extracted directly by the
   batch LLM stage. Its prompt explicitly handles the cases the old
   derivation handled: explicit % anchors, "going rate" / "prevailing
   wage" methodologies, multiples ("1.5x median" → 150),
   page-internal computation when both threshold and median are
   stated, and points-based programs (return null with notes).
3. The country median-wage table (`COUNTRY_MEDIAN_WAGE`) and FX rates
   (`FX_RATES`) are still imported as data but are no longer plumbed
   into the canary or extract-single-program orchestrators for Pillar
   A. They remain available for future derivations and for analyst
   reference at /review.
4. Stage 6.5 retains its other responsibilities for Pillar D and E
   derivations (D.2.2, D.1.2, D.1.3, D.1.4, D.2.3, D.2.4, B.2.4,
   D.3.1, D.3.3, E.1.3, E.1.1).

ADR-016 stays in force for the Pillar D / E derivations it documents.

## Consequences

### Positive

- One LLM call replaces a multi-input arithmetic chain (extract A.1.1
  absolute → look up median → look up FX → detect monthly/annual →
  compute %). Fewer skip conditions, fewer "ABSENT" classifications
  from missing FX or median entries. The old A.1.2 derived from the
  AUS canary regularly skipped because the median-wage table didn't
  cover the country at the relevant year.
- The points-based not-applicable path (Phase 3.6.6 / FIX 1) is no
  longer special-cased in code; the LLM prompt handles it as a normal
  null-with-notes return.
- The wave split (`wave-config.ts`) is simpler: all Pillar A fields
  are in WAVE_1, since none depend on a previously published row.

### Negative / risks

- The LLM is now responsible for both the absolute-vs-percentage
  recognition and any page-internal arithmetic. The new A.1.1 prompt
  explicitly covers these cases, but %-of-median values that require
  cross-page reasoning (threshold on visa page, median on a separate
  statistics-bureau page) will be harder to populate than they were
  via the deterministic derive. Mitigated by (a) `tier2_allowed`
  remaining on for Pillar A, (b) /review backstop for the cohort,
  (c) analyst override at /review with the median-wage table still
  available as reference.
- All historic Pillar A `field_values` rows are hard-deleted by
  migration `00026_pillar_a_v2_purge.sql` because the keys are
  reused with different meanings. There is no archive; restoring v1
  Pillar A would require a re-extraction cohort run.
- Persisted `methodology_versions.calibrated_params` payloads have
  their `A.*` entries stripped in the same migration (the old A.1.1
  z_score mean/stddev for absolute salary is meaningless under the
  new min_max % indicator). The next calibration pass repopulates.

## Migration

`supabase/migrations/00026_pillar_a_v2_purge.sql`:

1. Hard-delete every `field_values` row tied to a Pillar A
   `field_definitions` row.
2. Delete the two retired keys (`A.3.2`, `A.3.3`) so they don't linger
   as orphaned `field_definitions` rows after re-seed.
3. Strip `A.*` keys from any persisted `calibrated_params` payload.

The seed bumps `methodology_versions.version_tag` from `1.0.0` to
`2.0.0`; `methodology-v1.ts` upserts the new Pillar A indicators in
place via `onConflictDoUpdate` on `field_definitions.key`.

## Related ADRs

- **Supersedes (Pillar A only):** ADR-016 (Derived fields — Stage 6.5).
  ADR-016 remains in force for D.2.2 and the other Pillar D / E
  derivations.
- **Related:** ADR-013 (Tier-2 fallback), ADR-014 (Methodology v2
  indicator review), ADR-019 (Rubric validation gate).
