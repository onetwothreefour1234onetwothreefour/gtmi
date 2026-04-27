# ADR-014 — Methodology V2 indicator review

**Status:** APPROVED — analyst review complete. Implementation shipped on
`phase-3.5-methodology-v2-proposal` branch. See "Implementation notes
(Phase 3.5)" at the bottom of this document.
**Date:** 2026-04-27 (proposed); 2026-04-27 (approved + implemented).
**Authors:** Szabi (drafted Phase 3.5 PROPOSED); approved + implementation
spec (Phase 3.5) by Szabi.

## Context

The Phase 3 baseline gap register
(`docs/phase-3/baseline-gaps.csv`, captured at tag `phase-3-baseline`)
identifies 16 indicators with empty rows on **at least 2 of the 3
canary programmes** (AUS Skills in Demand 482, SGP S Pass, CAN Express
Entry FSW). That's the threshold the Phase 3 plan uses to flag a
candidate for v2 methodology review per the user-defined criterion:
"indicator returning `not_addressed` / `not_found` on >50% of the
cohort."

The 16 candidates are listed in the matrix below. **Most are expected
to close via Phase 3.1–3.4 work without any methodology change.**
Only those that remain ≥2/3 empty AFTER the next canary run are
genuine candidates for the three v2 dispositions:

- **Drop** — remove from methodology, re-normalize sub-factor weights.
- **Restructure** — change normalization or data type (e.g., categorical
  → boolean) to align with what data is actually publishable.
- **Country-substitute** — apply cohort-mean substitution similar to
  the E.1.1 stability edge case.

This ADR is intentionally written **before** the next canary so the
analyst (you) can approve the disposition rules in advance. After the
canary lands, decisions auto-trigger from the rule table without
another ADR.

## Decision (APPROVED 2026-04-27 — implementation shipped)

For each candidate, the matrix below specifies:

- **Phase 3 lever** that's expected to close the gap.
- **If the lever closes it**: no methodology change; no further action.
- **If the lever fails**: the proposed v2 disposition.

| #   | Field | Empty cohort                   | Phase 3 lever expected to close it                                                                                                                                                                                        | If still ≥2/3 empty after re-canary                                                                                                                                                                                                                                                          | Disposition                                |
| --- | ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | A.1.2 | 3/3 (3 LLM_MISS)               | Phase 3.3 prompt rewrite (added "implied % from absolute + median both stated" path; cross-reference computation hint).                                                                                                   | KEEP if median-wage data is genuinely absent on most government pages; lower the indicator weight from 0.30 → 0.20 within A.1 and shift the difference to A.1.1 (which is more reliably published). DROP only if absent on all 5 pilot countries post-Phase-5.                               | RESTRUCTURE (weight reduction) or DROP     |
| 2   | B.2.3 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.3 prompt rewrite (added "no employer sponsorship → return 0" path); Phase 3.2 v2 may surface tax-authority page with the levy schedule.                                                                           | RESTRUCTURE to **boolean**: "Does the programme have any employer-borne levy / skill charge?" Boolean inputs are easier to source than dollar amounts. Expected coverage rises to >90%.                                                                                                      | RESTRUCTURE (numeric → boolean)            |
| 3   | B.2.4 | 3/3 (1 LLM_MISS, 2 ABSENT)     | Phase 3.3 prompt rewrite (permits standard-case estimates with low confidence). Estimates are inherently weak though — this indicator is the strongest v2-restructure candidate in the matrix.                            | RESTRUCTURE to **boolean**: "Does the programme require non-government costs (medical, translation, etc.)?" The dollar amount is too variable across applicants to support a credible numeric scoring.                                                                                       | RESTRUCTURE (numeric → boolean)            |
| 4   | B.3.2 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.3 prompt rewrite (clarifies counting rules; common-pattern hints).                                                                                                                                                | KEEP as numeric. Already-published when the page describes the application flow; the rewrite is high-confidence to close the gap.                                                                                                                                                            | KEEP — no v2 change                        |
| 5   | B.3.3 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.4 Tier 2 backfill allowlist (ADR-013); Phase 3.3 prompt rewrite (Federal Court judicial-review-only → "limited").                                                                                                 | KEEP — Tier 2 backfill is the explicit remediation for this kind of gap.                                                                                                                                                                                                                     | KEEP — no v2 change                        |
| 6   | C.2.2 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.3 prompt rewrite (added country-default age caps: AU 18/23-student, UK 18, CAN 22, SGP 21).                                                                                                                       | KEEP — prompt fix should close.                                                                                                                                                                                                                                                              | KEEP — no v2 change                        |
| 7   | C.2.4 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.3 prompt rewrite (common-law / civil-partner recognition; country defaults) + Phase 3.4 Tier 2 allowlist.                                                                                                         | KEEP — should close.                                                                                                                                                                                                                                                                         | KEEP — no v2 change                        |
| 8   | C.3.2 | 2/3 (SGP ABSENT, AUS ABSENT)   | Phase 3.2 v2 discovery routes to the national education authority (MOE for SGP, AU Department of Education).                                                                                                              | If still ABSENT after re-canary: COUNTRY-SUBSTITUTE. Public education access for visa-holder dependants is heavily country-determined — within OECD members the answer is universally "automatic"; within Gulf states it's universally "fee-paying". Use cohort-mean substitution by region. | COUNTRY-SUBSTITUTE (regional default)      |
| 9   | D.1.3 | 3/3 (1 LLM_MISS, 2 ABSENT)     | Phase 3.3 PROMPT_UNCERTAIN (boundary failure — data lives on PR-residency-obligation sibling page). Phase 3.2 v2 deep-link discovery may close.                                                                           | RESTRUCTURE to **boolean + threshold**: "Does the programme require physical presence during PR-accrual? (yes/no, with note for typical day-count)." The granularity loss is small; the coverage gain is large.                                                                              | RESTRUCTURE (numeric → boolean+annotation) |
| 10  | D.1.4 | 3/3 (1 LLM_MISS, 2 ABSENT)     | Phase 3.3 PROMPT_UNCERTAIN (same boundary issue as D.1.3).                                                                                                                                                                | RESTRUCTURE to **boolean + threshold** with country defaults: most OECD countries use "2-of-5-years" or equivalent → numeric default 146 days/year.                                                                                                                                          | RESTRUCTURE or COUNTRY-DEFAULT             |
| 11  | D.2.2 | 3/3 (2 LLM_MISS, 1 ABSENT)     | Phase 3.3 PROMPT_UNCERTAIN (boundary failure — citizenship physical-presence calculator page is JS-rendered and the canary scrape returned only the bullet-point summary). Phase 3.2 v2 deep-link discovery should close. | KEEP — boundary fix expected to close. If it doesn't, COUNTRY-DEFAULT (Canada 5 years, AU 4, UK 5, SGP varies, HK 7) since the answer is structural per country.                                                                                                                             | KEEP — no v2 change pending boundary fix   |
| 12  | D.2.3 | 3/3 (1 LLM_MISS, 2 ABSENT)     | Phase 3.3 prompt rewrite (country defaults: CAN/AU/UK permit, SGP doesn't) + Phase 3.4 Tier 2 allowlist.                                                                                                                  | KEEP — should close via prompt + Tier 2 fallback.                                                                                                                                                                                                                                            | KEEP — no v2 change                        |
| 13  | D.2.4 | 3/3 (2 LLM_MISS, 1 ABSENT)     | Phase 3.3 prompt rewrite (added CLB ↔ IELTS ↔ TOEFL ↔ CEFR mapping; civics-test names).                                                                                                                                   | KEEP — should close.                                                                                                                                                                                                                                                                         | KEEP — no v2 change                        |
| 14  | D.3.1 | 2/3 (CAN LLM_MISS, AUS ABSENT) | Phase 3.2 v2 discovery routes to tax authority (ATO, CRA); Phase 3.3 prompt rewrite (183-day default, country defaults with confidence cap).                                                                              | KEEP — should close.                                                                                                                                                                                                                                                                         | KEEP — no v2 change                        |
| 15  | D.3.2 | 3/3 (1 LLM_MISS, 2 ABSENT)     | Phase 3.2 v2 discovery routes to tax authority; Phase 3.3 prompt rewrite (named regimes; explicit "none" for countries with no special regime).                                                                           | KEEP — should close.                                                                                                                                                                                                                                                                         | KEEP — no v2 change                        |
| 16  | E.3.1 | 3/3                            | **Already closed by Phase 3.1** (V-Dem direct-API).                                                                                                                                                                       | —                                                                                                                                                                                                                                                                                            | CLOSED — no v2 change                      |

## Summary of proposed v2 changes (PROPOSED — pending approval)

If the analyst approves this matrix and the next canary confirms which
gaps remain, the following v2 changes will be implemented:

### Likely v2 changes (assuming Phase 3 closes most gaps)

- **B.2.3** — numeric → boolean ("Does the programme require any
  employer-borne levy?"). Re-normalize B.2 sub-factor weights (B.2.1
  remains 0.40, B.2.2 0.25, B.2.3 0.20→**0.15**, B.2.4 0.15→**0.20**)
  — assumes B.2.4 simultaneously moves to boolean and gets a small
  weight bump because its coverage rises.
- **B.2.4** — numeric → boolean ("Does the programme require any
  non-government costs?"). Re-normalize as above.
- **C.3.2** — categorical → categorical-with-regional-default. Add
  "country region" as the substitution key (OECD high-income → automatic
  default; Gulf high-income → fee-paying default; etc.). No weight
  change.
- **D.1.3** — numeric → boolean+annotation. Indicator weight stays at
  0.20 within D.1; the categorical normalization function changes.
- **D.1.4** — numeric → boolean+annotation, OR country-default with
  numeric still in place. Decision depends on D.1.3 outcome.

### Unlikely v2 changes (pending re-canary verification)

- **A.1.2** — weight reduction from 0.30 to 0.20 within A.1 (drift A.1.1
  to 0.55, A.1.3 to 0.25). Only if the indicator stays >50% empty post-
  Phase-5 calibration.

### No v2 change

- 10 of 16 candidates (B.3.2, B.3.3, C.2.2, C.2.4, D.2.2, D.2.3, D.2.4,
  D.3.1, D.3.2, E.3.1).

## Methodology version handling

If any of the proposed changes are approved and implemented:

- A new `methodology_versions` row is created with `version_tag`
  `2.0.0` (the prompt-only changes from Phase 3.3 are tagged
  `1.0.1-phase-3-3-prompts` and do NOT bump the row — they are a
  prompt-content marker, not a methodology version).
- v1 scores remain in the `scores` table tagged `methodology_version_id
= v1`. They are NOT recomputed under v2 (per dispatch §14: scores
  carry their methodology version; no retroactive recomputation).
- Public dashboard renders the methodology version per score row,
  unchanged.
- The v2 weight re-normalization arithmetic (any time a sub-factor
  weight moves) is unit-tested in
  `packages/db/src/seed/__tests__/methodology-v2.test.ts` (to be added
  in the implementation commit).

## Process

1. **Now (this commit):** ADR-014 PROPOSED — analyst reads, edits any
   matrix row, marks each row APPROVED or DEFERRED.
2. **Next canary** — run AUS+SGP+CAN with all Phase 3 changes live
   (V-Dem flag ON, Discovery V2 flag ON, prompt v2 in DB,
   tier2_allowed allowlist applied). Re-run
   `audit-empty-fields-rollup.ts`. Diff against
   `docs/phase-3/baseline-gaps.csv`.
3. **Decision triage** — for each row in the matrix, check post-canary
   classification:
   - If POPULATED — row closed; no v2 change.
   - If still ≥2/3 empty AND row's "If still empty" disposition is
     APPROVED — implement the disposition.
4. **Implementation commit** — single commit landing all approved v2
   changes: `methodology-v2.ts` updates, schema/seed updates if any
   data-type changes, weight re-normalization, methodology_versions
   row insert, unit tests, dashboard surface unchanged.

## Consequences

### Positive

- Per-indicator dispositions are pre-approved before the canary, so
  post-canary work is mechanical execution rather than another ADR
  cycle.
- Re-normalization arithmetic is preserved (sub-factor weights still
  sum to 1.0 at every level); we don't accumulate fractional
  imbalances across iterations.
- v1 scores remain stable and reproducible; v2 is additive.

### Negative

- The ADR is intentionally provisional and will need editing if the
  analyst disagrees with any matrix row. This is the right tradeoff
  vs. waiting until canary lands and writing the ADR then — pre-
  approval shortens the post-canary loop.

### Neutral

- No code change in this commit. This is an editorial proposal.

---

## Implementation notes (Phase 3.5 — APPROVED 2026-04-27)

The analyst approved the matrix with the following final dispositions
(the rest are KEEP / no change):

| Field     | Final disposition                                                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A.1.2** | DEFER — weight rebalance held until Phase 5 post-canary evidence                                                                                                                                                                                            |
| **B.2.3** | RESTRUCTURE numeric → boolean_with_annotation: `{ hasLevy: boolean, notes: string \| null }`                                                                                                                                                                |
| **B.2.4** | RESTRUCTURE numeric → boolean_with_annotation: `{ hasMandatoryNonGovCosts: boolean, notes: string \| null }`                                                                                                                                                |
| **D.1.3** | RESTRUCTURE numeric → boolean_with_annotation: `{ required: boolean, daysPerYear: number \| null, notes: string \| null }`                                                                                                                                  |
| **D.1.4** | RESTRUCTURE numeric → boolean_with_annotation: `{ required: boolean, daysPerYear: number \| null, notes: string \| null }`                                                                                                                                  |
| **C.3.2** | COUNTRY-SUBSTITUTE with badge: regional default (OECD high-income → `automatic` score 100; GCC → `fee_paying` score 40); `provenance.extractionModel = 'country-substitute-regional'` triggers a purple "Country-substitute" badge in `<ProvenanceTrigger>` |

### What shipped

- `packages/scoring/src/types.ts` — `NormalizationFn` extended with
  `'boolean_with_annotation'` and `'country_substitute_regional'`.
- `packages/scoring/src/normalize.ts`:
  - `BOOLEAN_WITH_ANNOTATION_KEYS` map (B.2.3 → `hasLevy`, B.2.4 →
    `hasMandatoryNonGovCosts`, D.1.3/D.1.4 → `required`).
  - `normalizeBooleanWithAnnotation(parsed, fieldKey, direction)`.
  - `COUNTRY_REGIONS` ISO3 → Region map (5 pilots + wider OECD high-income
    - GCC enumerated).
  - `REGIONAL_SUBSTITUTES['C.3.2']` map.
  - `getRegionalSubstitute(countryIso, fieldKey)`.
  - `parseIndicatorValue` extended for both new fns.
- `packages/scoring/src/normalize-raw.ts` — extended `isNormalizationFn`
  - 2 new switch cases. `NormalizedValue` widened to include
    `Record<string, unknown>`.
- `packages/scoring/src/engine.ts` — `KNOWN_NORMALIZATION_FNS`
  extended; `scoreIndicator` switch handles both new fns
  (country_substitute_regional reuses the categorical scoring path).
- `packages/db/src/seed/methodology-v2.ts` — five `PHASE_3_5_INDICATOR_RESTRUCTURES`
  entries; `methodologyV2.version_tag = '2.0.0'`; `applyPhase3_5` overlay
  composes on top of Phase 3.3 prompt overrides.
- `supabase/migrations/00009_methodology_v2.sql` — inserts a v2.0.0 row
  into `methodology_versions` derived from v1 via `jsonb_set` on
  `normalization_choices` for the 5 affected fields. Applied via
  `apply-migration.ts` on staging.
- `apps/web/components/gtmi/provenance-trigger.tsx` — purple
  "Country-substitute" badge inside the popover, gated on
  `provenance.extractionModel === 'country-substitute-regional'`.
- `apps/web/app/preview-gallery/page.tsx` — added `PROVENANCE_COUNTRY_SUBSTITUTE`
  fixture with a "Country-substitute (Phase 3.5 / ADR-014)" row in the
  ProvenanceTrigger states block.

### What did NOT change

- Pillar weights, sub-factor weights, indicator weights — all unchanged.
- v1 scores — not recomputed (per dispatch §14).
- v1 row in `methodology_versions` — untouched.
- Phase 3.3 prompt overrides — preserved (Phase 3.5 composes on top).
- The publish stage's actual country-substitute write path — NOT wired
  here. The publish stage will need a small follow-up commit at
  re-canary time to detect `normalizationFn === 'country_substitute_regional'`,
  call `getRegionalSubstitute(countryIso, fieldKey)` when LLM extraction
  returns empty, and write a synthetic field_values row with
  `provenance.extractionModel = 'country-substitute-regional'`. Same
  pattern for the boolean_with_annotation publish path. ADR-013-style:
  schema + scoring + UI scaffolding here; pipeline change separately.

### Verified

- `pnpm test` — 285/285 passing across `@gtmi/scoring` (134),
  `@gtmi/web` (126), `@gtmi/extraction` (25). No regressions.
- New tests: `phase-3.5-normalize.test.ts` (21 tests),
  `phase-3.5-engine.test.ts` (7 tests), `methodology-v2.test.ts` (13
  tests including weight-sum invariants), `provenance-trigger.test.tsx`
  (+ 2 new badge tests).
- Migration 00009 applied successfully on staging. Both v1.0.0 and
  v2.0.0 rows present; v2's `normalization_choices` reflects all five
  restructured fields.
- Build (`pnpm --filter @gtmi/web build`) compiles successfully; the
  Windows symlink/standalone-tracing warning is unrelated to code
  (Cloud Run Linux build is unaffected).

### Rollback

- v2 scores not yet computed (re-canary still pending) → nothing to
  recompute under v1.
- DELETE FROM methodology_versions WHERE version_tag = '2.0.0' (single
  row).
- Revert the Phase 3.5 commit on the branch.
- v1 row in methodology_versions is untouched.
