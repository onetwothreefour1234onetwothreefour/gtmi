# ADR-029 — Pillar B restructure (methodology v3.0.0); supersedes ADR-016 for B.2.4 derivation

**Status:** Approved
**Date:** 2026-05-05
**Authors:** Szabi (methodology review).

---

## Context

Methodology v2 Pillar B had ten indicators across three sub-factors
(B.1 Time-to-decision, B.2 Direct cost, B.3 Digital and administrative
access). The methodology review collapsed and re-cut Pillar B around
four cleaner applicant-centric concepts:

- **B.1 Speed** — standard SLA + fast-track availability
- **B.2 Process Complexity** — number of mandatory steps + in-person
  touchpoints
- **B.3 Total Cost** — a single all-in USD figure for principal +
  spouse + 2 children
- **B.4 Transparency** — appeal-process clarity + status tracking

Two v2 indicators were dropped as low-signal under the index's
measurement objective:

- old **B.2.3** — Employer-borne levies (overlapped B.3.1 in practice;
  only meaningful for sponsorship-required programs)
- old **B.3.1** — Online application availability (subsumed by the new
  B.2.2 in-person touchpoints, which is a sharper signal)

Three v2 indicators were merged into the new **B.3.1 Total applicant
cost (USD)**:

- old B.2.1 (Principal applicant fees, USD, z_score)
- old B.2.2 (Per-dependant fees, USD, z_score)
- old B.2.4 (Mandatory non-government costs, boolean+annotation,
  derived in Stage 6.5)

The remaining v2 indicators (B.1.1 SLA, B.3.2 in-person visits, B.3.3
appeal clarity, B.1.2 fast-track, B.1.3 step count) were repurposed
under new keys with new normalizations as documented in
`packages/db/src/seed/methodology-v1.ts`.

ADR-016 introduced Stage 6.5 (Derive) to deterministically produce
indicators that could not be extracted as a literal verbatim sentence.
**B.2.4** ("Mandatory non-government costs") was the only Pillar B
field in that pipeline — `deriveB24` reads
`COUNTRY_NON_GOV_COSTS_POLICY` and emits a `boolean_with_annotation`
row. Under v3.0.0, the new B.3.1 absorbs the same information as a
USD component with explicit "extract from official source if disclosed,
flag low confidence otherwise" semantics. There is no longer a Pillar
B field that needs deterministic derivation.

## Decision

The B.2.4 portion of ADR-016 is **superseded**.

1. Stage 6.5 is no longer a producer of any Pillar B row. The
   `deriveB24` function and the `DerivedB24Input` interface are
   removed; the `inputs.b24` field on `DeriveStageInputs` is removed
   (`packages/extraction/src/stages/derive.ts`,
   `packages/extraction/src/types/pipeline.ts`). The
   `NonGovCostsPolicyEntry` interface and the
   `COUNTRY_NON_GOV_COSTS_POLICY` data module are retained as analyst
   reference only — the orchestrator no longer wires them into the
   extraction pipeline.
2. The new B.3.1 ("Total applicant cost (USD; principal + 1 spouse + 2
   children)", numeric, min_max, lower_is_better) is extracted directly
   by the batch LLM stage. Its prompt itemises the components to sum
   (government fees + dependant fees + explicitly-stated mandatory
   non-gov costs) and the currency-handling protocol: the LLM converts
   to USD inline using a single date-stamped rate, quoted in notes.
   Downstream scoring treats the value as opaque USD; FX_RATES is NOT
   consulted at score time.
3. The `boolean_with_annotation` normalization remains in force for
   D.1.3 / D.1.4 (PR-presence requirements). The
   `BOOLEAN_WITH_ANNOTATION_KEYS` registry has B.2.3 and B.2.4 entries
   removed.
4. Stage 6.5 retains its other responsibilities for Pillar D and E
   derivations (D.2.2, D.1.2, D.1.3, D.1.4, D.2.3, D.2.4, D.3.1,
   D.3.3, E.1.3, E.1.1).

ADR-016 stays in force for the Pillar D / E derivations it documents.
ADR-028 (Pillar A restructure) is unaffected.

## Consequences

### Positive

- The applicant cost view becomes a single comparable USD figure
  rather than four separate fields with mixed normalizations
  (z_score for fees, boolean_with_annotation for non-gov costs).
- The `boolean_with_annotation` data type contracts to a smaller
  surface (D.x only), which simplifies future calibration and
  validation work.
- Pillar B's wave-split rationale dies with deriveB24: all 7 new
  Pillar B indicators land in WAVE_1.
- Two retired v2 indicators (B.2.3 employer levies, B.3.1 online
  application availability) were each tagged in earlier reviews as
  weak signals; dropping them sharpens Pillar B's measurement focus.

### Negative / risks

- The LLM is now responsible for currency conversion at extraction
  time. The new B.3.1 prompt explicitly requires a single date-stamped
  conversion rate quoted in notes; reviewer can override at /review.
  This deviates from the Pillar A pattern (no FX) but is the cleanest
  fit for a multi-component cost sum where each component may be
  published in a different currency on the same page.
- All historic Pillar B `field_values` rows are hard-deleted by
  migration `00027_pillar_b_v3_purge.sql` because the keys are reused
  with different meanings. Includes B.1.1 SLA rows, which are
  structurally compatible with the new schema but re-extracted under
  the new prompt (range / midpoint / unit-conversion rules) for
  uniformity. There is no archive; restoring v2 Pillar B would
  require a re-extraction cohort run.
- The same `methodology_versions.calibrated_params` cleanup caveat as
  ADR-028 applies: the column is not present on every environment,
  and `apply-migration.ts` cannot run a `DO $$ ... END $$` block, so
  the cleanup is documented as a manual one-liner in the migration.

## Migration

`supabase/migrations/00027_pillar_b_v3_purge.sql`:

1. Hard-delete every `field_values` row tied to a Pillar B
   `field_definitions` row. Cleans dependent rows in `review_queue`,
   `policy_changes`, `extraction_attempts`, and `extraction_prompts`
   first.
2. Delete the five retired keys (`B.1.3`, `B.2.3`, `B.2.4`, `B.3.2`,
   `B.3.3`) so they don't linger as orphaned `field_definitions`
   rows after re-seed.
3. Comment-only note for the `calibrated_params` Pillar B cleanup
   one-liner (run separately on environments that have 00023 applied).

The seed bumps `methodology_versions.version_tag` from `2.0.0` to
`3.0.0`; `methodology-v1.ts` upserts the new Pillar B indicators in
place via `onConflictDoUpdate` on `field_definitions.key` for the
four colliding keys (B.1.1, B.1.2, B.2.1, B.2.2, B.3.1) and inserts
the two net-new keys (B.4.1, B.4.2).

## Related ADRs

- **Supersedes (B.2.4 only):** ADR-016 (Derived fields — Stage 6.5).
  ADR-016 remains in force for D.2.2 and the other Pillar D / E
  derivations.
- **Related:** ADR-014 (Methodology v2 indicator review), ADR-019
  (Rubric validation gate), ADR-028 (Pillar A restructure).
