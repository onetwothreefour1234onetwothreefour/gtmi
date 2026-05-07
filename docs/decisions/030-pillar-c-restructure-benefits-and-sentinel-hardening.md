# ADR-030 — Pillar C restructure (Benefits) + 999 sentinel hardening; supersedes C.3.2 portion of ADR-014

**Status:** Approved
**Date:** 2026-05-06
**Authors:** Szabi (methodology review).

---

## Context

### Pillar C restructure

Methodology v3 Pillar C ("Rights") had ten indicators across three sub-factors
(C.1 Labor market flexibility, C.2 Family, C.3 Social access). The
methodology review re-cut Pillar C around eight cleaner applicant-facing
benefit categories and renamed the pillar to **"Benefits"**:

- **C.1 Work Flexibility** — employer switching + self-employment +
  visa duration & renewability (net-new indicator)
- **C.2 Family** — spouse inclusion + dependent child age cap +
  extended family inclusion
- **C.3 Social Access** — public healthcare + public education

Three v3 indicators were dropped:

- old **C.1.1** Employer-sponsorship requirement — subsumed by the
  new C.1.1 Employer switching
- old **C.1.4** Labor market test requirement — low-signal, narrow
  applicability
- old **C.2.4** Same-sex partner recognition — not in new structure

Two v3 indicators were retired and one is net-new:

- **C.1.3 Visa duration and renewability** is conceptually new (the
  old C.1.3 was self-employment, which moves to the new C.1.2)
- **C.1.4** and **C.2.4** field_definitions rows are deleted

Six v3 vocabularies collapsed onto cleaner 3-value (or 4-value for
C.1.3) rubrics:

- C.1.1: 4-value switching → 3-value (open / notification_only /
  new_application_required)
- C.1.2: 4-value self-employment → 3-value (full / restricted / none)
- C.1.3: 4-value self-employment → 4-value duration (permanent /
  long_term_renewable / short_term_renewable / non_renewable)
- C.2.1: 6-value spouse inclusion → 3-value (automatic_full /
  automatic_limited_or_permit / not_permitted)
- C.3.1: 8-value healthcare → 3-value (full / partial / none)
- C.3.2: 4-value education → 3-value (full / partial / none)

### Sentinel hardening

The codebase has a structured sentinel pattern (Phase 3.6.3 / FIX 4 in
`packages/scoring/src/sentinels.ts`): valueRaw tokens `'no_cap'` /
`'no_limit'` / `'none'` / `'999'` all normalise to the structured
`NO_LIMIT_MARKER = { __noLimit: true }`, and the engine short-circuits
to 100 (higher_is_better) / 0 (lower_is_better) without passing
through min_max. This pattern landed in 3.6.3 and is the right
precedent.

What remained was the back-door admission of the integer 999 as a
"valid age" through the universal numeric sanity gate. Two fields
(A.1.5 applicant age cap, C.2.2 dependent child age cap) had sanity
ranges of 0..999, which let an LLM-emitted integer 999 trickle
through as a real numeric value rather than being routed via the
sentinel-token path.

## Decision

### Pillar C restructure

1. Pillar C is renamed to **"Benefits"** in `docs/METHODOLOGY.md` and
   in section headings throughout the doc. The framework_structure
   key stays `'C'`; no enum or code-side identifier changes.
2. The eight new Pillar C indicators replace the v3 ten in
   `packages/db/src/seed/methodology-v1.ts` with new prompts, new
   rubrics, and the weight tree:
   - C.1 Work Flexibility = 0.40 (C.1.1=0.40, C.1.2=0.30, C.1.3=0.30)
   - C.2 Family = 0.40 (C.2.1=0.50, C.2.2=0.30, C.2.3=0.20)
   - C.3 Social Access = 0.20 (C.3.1=0.50, C.3.2=0.50)
3. Pillar C weight within PAQ stays **0.20**. Total methodology
   indicator count drops from 45 to **43**.
4. C.1.4 and C.2.4 `field_definitions` rows are deleted by migration
   00028; C.2.4's tier-2-allowlist entry is replaced with C.3.1
   (healthcare access is the new tier-2-eligible field, healthcare
   info is rarely on the visa page).
5. All Pillar C `field_values` rows are hard-deleted by migration
   00028 — every key collides with destructive vocabulary changes.

### Sentinel hardening

6. `NUMERIC_SANITY_RANGES` upper bound for **A.1.5** and **C.2.2**
   drops from 999 → 100. The integer 999 is no longer a valid in-band
   value through the universal gate.
7. The structured no-cap path remains the canonical encoding:
   valueRaw token `'no_cap'` (or any of `'no_limit'` / `'none'` /
   `'999'`) → `normalize-raw.ts` → `value_normalized = { __noLimit:
true }` → engine short-circuits to 100 for higher_is_better.
8. Extraction prompts for A.1.5 and the new C.2.2 instruct the LLM to
   return the `'no_cap'` token instead of the integer 999.
9. Migration 00028 includes a defensive UPDATE that converts any
   surviving A.1.5 `field_values` row whose `value_raw = '999'` to
   the canonical `'no_cap'` + `{__noLimit: true}` shape. Pillar C
   rows are already deleted earlier in the migration so the fix only
   touches A.1.5 in practice.
10. The `boolean_with_annotation` precedent (ADR-014) is **NOT**
    extended for no-cap. boolean_with_annotation expresses a
    boolean-plus-metadata semantic; the no-cap case is a sentinel
    marker on a numeric field. The existing `NO_LIMIT_MARKER`
    pattern from Phase 3.6.3 is the correct precedent.
11. The dispatch's JSON wire format `{value: null, no_cap: true,
source_sentence, confidence}` is **NOT** adopted as the
    extraction-time shape. The token-string approach is preserved
    (zero plumbing risk; semantically equivalent to the marker after
    `normalize-raw.ts` runs).

### C.3.2 country_substitute_regional supersedure

12. C.3.2 reverts from `country_substitute_regional` (Phase 3.5 /
    ADR-014) to plain `categorical` extraction with the new
    full/partial/none rubric. The `PHASE_3_5_INDICATOR_RESTRUCTURES`
    entry for C.3.2 in `methodology-v2.ts` is removed.
13. The `country_substitute_regional` infrastructure
    (`REGIONAL_SUBSTITUTES`, `getRegionalSubstitute`,
    `executeCountrySubstitute`, the engine branch) is **left in
    place dormant**, not deleted. C.3.2 was the only field using it.
    Cleanup will be a follow-up PR if no future field adopts the
    pattern.
14. The C.3.2 portion of ADR-014 is superseded.

## Consequences

### Positive

- Pillar C scoring becomes more discriminating with collapsed,
  meaningful 3-value rubrics (the v3 8-value healthcare rubric had
  rubric inflation; in practice analysts mapped most non-OECD
  countries to 2–3 of the 8 values).
- The integer 999 is no longer load-bearing in the universal sanity
  gate. The structured `NO_LIMIT_MARKER` is the only valid no-cap
  encoding at the normalized layer, which makes the score-engine
  contract explicit.
- The "Benefits" rename better matches the dispatch description's
  applicant-facing framing (entitlements they get, not abstract
  rights).
- Pillar C goes from a mix of categorical / boolean to mostly
  categorical, which simplifies calibration.

### Negative / risks

- All historic Pillar C `field_values` rows are hard-deleted (8 of 10
  keys collide with destructive or vocabulary-collapse semantics; the
  other 2 keys are retired entirely). Recovering v3 Pillar C would
  require a re-extraction cohort run.
- C.3.1 Public healthcare access loses some nuance — the v3 rubric
  distinguished levy-required from insurance-required from
  conditional-RHCA, all of which now collapse to "partial". Analyst
  notes (captured in the `notes` field on each extraction) preserve
  the fine-grained distinction for the analyst-facing /review UI but
  do not affect the score.
- The dormant `country_substitute_regional` infrastructure is dead
  code until a future field adopts it. Carrying ~200 lines of
  orphaned engine + publish + normalize code is a small maintenance
  cost; cleanup deferred per dispatch decision §k.4.
- The same `methodology_versions.calibrated_params` cleanup caveat as
  ADR-028 / ADR-029: column not present on every environment;
  `apply-migration.ts` cannot run a `DO $$ ... END $$` block; the
  C.\* strip is documented as a manual one-liner in the migration.

## Migration

`supabase/migrations/00028_pillar_c_v4_purge.sql`:

1. Hard-delete every `field_values` row tied to a Pillar C
   `field_definitions` row. Cleans dependent rows in `review_queue`,
   `policy_changes`, `extraction_attempts`, and `extraction_prompts`
   first.
2. Delete the two retired keys (`C.1.4`, `C.2.4`) so they don't
   linger as orphaned `field_definitions` rows after re-seed.
3. Defensive sentinel hardening: convert any A.1.5 row with
   `value_raw = '999'` to the canonical `'no_cap'` + `{__noLimit:
true}` shape.
4. Comment-only note for the `calibrated_params` C.\* cleanup
   one-liner (run separately on environments that have 00023
   applied).

The seed bumps `methodology_versions.version_tag` from `3.0.0` to
`4.0.0`; `methodology-v1.ts` upserts the new Pillar C indicators in
place via `onConflictDoUpdate` on `field_definitions.key` for the
six surviving keys (C.1.1, C.1.2, C.1.3, C.2.1, C.2.2, C.2.3, C.3.1,
C.3.2).

## Related ADRs

- **Supersedes (C.3.2 only):** ADR-014 (Methodology v2 indicator
  review) — the C.3.2 country_substitute_regional restructure is
  removed. The B.2.3 / B.2.4 / D.1.3 / D.1.4 boolean_with_annotation
  decisions in ADR-014 are unaffected (B.2.3 / B.2.4 retired by
  ADR-029; D.1.3 / D.1.4 still in force).
- **Related:** ADR-013 (Tier-2 allowlist), ADR-019 (Rubric validation
  gate), ADR-028 (Pillar A restructure), ADR-029 (Pillar B
  restructure). Sentinel pattern Phase 3.6.3 / FIX 4 in
  `packages/scoring/src/sentinels.ts` is the foundational design this
  ADR hardens.
