# ADR-016 — Derived fields (Stage 6.5: deterministic computation for A.1.2 and D.2.2)

**Status:** Partially superseded by ADR-028 (2026-05-05) and ADR-029
(2026-05-05). The Pillar A portion (A.1.2 % of median) is removed
under methodology v2.0.0; % of median is now extracted directly as
A.1.1. The Pillar B portion (B.2.4 mandatory non-government costs)
is removed under methodology v3.0.0; the new B.3.1 absorbs it as a
USD component. The D.2.2 derivation and the other Pillar D / E
derivations described below remain in force.

**Original status:** Approved (Phase 3.6 / Fix D)
**Date:** 2026-04-28
**Authors:** Szabi (drafted via Phase 3.6 plan, analyst pre-approval required per Q4 decision before commit 6 ships).

---

## Context

Two PAQ indicators in the methodology cannot be sourced as a literal
sentence on any government page because they are computational
derivations of values that ARE sourced:

- **A.1.2** — Salary threshold as % of local median wage (Pillar A,
  weight 0.30 within sub-factor A.1).
- **D.2.2** — Total minimum years from initial visa entry to citizenship
  eligibility (Pillar D, weight 0.30 within sub-factor D.2).

Both require arithmetic the LLM cannot legitimately perform under the
project's `do not infer, do not bridge from related fields, do not use
general knowledge` discipline (BRIEF.md §14). Phase 2's Session 10
prompt-sweep work added recall hints for both indicators; the AUS
re-canary still produced empty for both fields, classified `LLM_MISS`.

The methodology requires both indicators in scoring (their weights are
non-zero in `methodology-v1.ts`), so leaving them permanently empty
applies the missing-data penalty at sub-factor level on every program in
the cohort. Effective cohort coverage on these two fields is ≤30%; the
penalty is significant.

The Phase 3.6 plan (commits 1–8) introduced Stage 6.5 — Derive — as the
remediation. This ADR captures the editorial decision separately from
the implementation so the analyst can pre-approve the pattern before any
code that writes derived rows ships (per analyst Q4 decision). Commit 6
implements Stage 6.5 against this ADR; commit 6 is blocked on this ADR
being marked APPROVED.

The companion data tables ship in commit 5 (the same commit as this ADR)
so the analyst can review the source-of-truth values alongside the
methodology decision:

- `scripts/country-median-wage.ts` — 30 cohort entries, OECD AAW for OECD
  members, ILO mean-earnings fallback for non-OECD (per Q3).
- `scripts/fx-rates.ts` — annual-average LCU-per-USD for cohort
  currencies, World Bank PA.NUS.FCRF.
- `scripts/country-citizenship-residence.ts` — minimum years as PR
  before naturalisation, hand-curated from each country's citizenship
  act; `null` for countries where no realistic citizenship pathway
  exists from a talent visa (the GCC monarchies).

---

## Decision

### Pattern

Add **Stage 6.5 — Derive** between Stage 2 (Extract) and Stage 3
(Validate) in the canary and Trigger.dev pipelines. Stage 6.5 is pure
arithmetic with three properties the analyst can verify independently:

1. **No LLM call.** The derive stage is deterministic. Same inputs →
   same output, byte-identical across runs. `extractionModel` is set to
   the literal string `'derived-computation'`.
2. **Inputs are already-extracted, already-published `field_values`
   rows for the same program.** The derive stage does not reach back to
   the LLM, the scraper, or any external network. It reads the inputs
   from the in-memory extraction map produced by Stage 2 plus the static
   lookup tables in the repo.
3. **Output routes to /review automatically.** Confidence is hard-coded
   to **0.6** so the auto-approve threshold (0.85 on both extraction and
   validation per the existing pipeline) is never met. Every derived
   row is reviewed by an analyst before it influences a public score.

### Computations

#### A.1.2 — Salary threshold as % of local median wage

```
input1 = field_values[A.1.1].valueRaw            // e.g. "AUD 73,150"
input2 = field_values[A.1.1].provenance.valueCurrency  // e.g. "AUD"
input3 = COUNTRY_MEDIAN_WAGE[countryIso]         // e.g. AUS, 60_200, OECD, 2023
input4 = FX_RATES[currency]                      // e.g. AUD, 1.518 LCU/USD, 2024

amountUsd = parseNumeric(input1) ÷ input4.lcuPerUsd
percent   = amountUsd ÷ input3.medianWageUsd × 100   // round to 1 dp
```

**Skip conditions** (each emits a one-line log; no row is written;
missing-data penalty applies):

- A.1.1 not POPULATED for this program.
- A.1.1 has no `valueCurrency` in provenance (Phase 2 currency
  preservation should always set it, but defence in depth).
- COUNTRY_MEDIAN_WAGE has no entry for this country.
- FX_RATES has no entry for the currency.

#### D.2.2 — Total minimum years to citizenship

```
input1 = field_values[D.1.2].valueNormalized          // years to PR
input2 = COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[countryIso]
                                                       // years as PR before citizenship

if (input2.yearsAsPr === null) skip                   // no realistic pathway (GCC)
output = input1 + input2.yearsAsPr                    // years, round to 0.5
```

**Skip conditions:**

- D.1.2 not POPULATED for this program.
- `D.1.1` (PR provision available) is `false` (the program has no PR
  pathway; D.2.2 is structurally inapplicable).
- COUNTRY_CITIZENSHIP_RESIDENCE_YEARS has no entry for this country, or
  `yearsAsPr` is `null`.

### Provenance shape for derived rows

Every derived row writes a complete `ProvenanceRecord` (per ADR-007 + the
13 required keys checked by `verify-provenance.ts`). Fields specific to
the derived pattern:

| Key                    | Value                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `sourceUrl`            | `derived-computation:A.1.2` (or `:D.2.2`)                                                                               |
| `geographicLevel`      | `'global'` (computation, no jurisdiction)                                                                               |
| `sourceTier`           | `null` (matches the country-substitute pattern from ADR-014)                                                            |
| `contentHash`          | `sha256('derived-computation:<key>:' + serialised inputs)`                                                              |
| `sourceSentence`       | `Derived from A.1.1 (AUD 73,150) ÷ AUS median wage USD 60,200 × 100 = 78.5%` (human-readable inputs + formula + result) |
| `extractionModel`      | `'derived-computation'`                                                                                                 |
| `extractionConfidence` | **0.6** (forces /review per ADR-013 review threshold)                                                                   |
| `validationConfidence` | **0.6**                                                                                                                 |
| `validationModel`      | `'derived-computation'`                                                                                                 |
| `crossCheckResult`     | `'not_checked'`                                                                                                         |
| `reviewedBy`           | `'auto'`                                                                                                                |
| `reviewDecision`       | `null` (pending — `humanReview.enqueue` writes the row at status `pending_review`)                                      |

Plus an extra non-required JSONB key for analyst convenience:

```
provenance.derivedInputs = {
  'A.1.1': { valueRaw, valueCurrency, sourceUrl },
  'medianWage': { value, year, source, sourceUrl }
}
```

`derivedInputs` is _not_ in the `verify-provenance.ts` required-key list;
it is an extension. The /review UI surfaces it so the reviewer can audit
the inputs without joining tables.

### Refresh cadence for the data tables

- `country-median-wage.ts`, `fx-rates.ts` — refreshed annually, aligned
  with IMD's annual cycle and the OECD AAW publication. Hand-edited;
  PR-reviewed; future Phase 7 script automates against OECD + ILO APIs.
- `country-citizenship-residence.ts` — refreshed only when a country
  amends its citizenship law. Refresh signal: Phase 6 living-index
  policy_changes flagged as Breaking on D.2.2 inputs.
- All three tables are hand-curated and version-controlled. Each entry
  cites the authoritative source URL; a future analyst can replicate
  the value by visiting the URL.

### Live-DB pre-canary check

`scripts/check-median-wage-coverage.ts` queries `sources` for every
country with at least one `is_primary=true` Tier 1 source row and
asserts both lookup tables cover every cohort country. Exits 1 on any
miss. Run pre-canary; gates the derive stage from running with an
incomplete table.

---

## Consequences

### Positive

- **A.1.2 and D.2.2 move from permanent LLM_MISS to consistently
  pending-review-then-approved.** Cohort coverage on these two fields
  rises from ≤30% to expected >85% (analyst review converts most rows
  to approved unless inputs are clearly wrong).
- **Methodology's `do not infer` rule is preserved.** Derived fields
  are deterministic arithmetic, not LLM inference. The reviewer, not
  the model, decides whether to accept the computation.
- **Auditable.** Every derived row carries the inputs, the formula, and
  the result in human-readable form. `verify-provenance.ts` passes.
- **Safe rollback.** Derived rows are tagged `extractionModel =
'derived-computation'`. To roll back, delete by tag:
  `DELETE FROM field_values WHERE provenance->>'extractionModel' =
'derived-computation';`

### Negative

- **Static tables drift annually.** Median wages and FX rates change
  yearly; citizenship laws change rarely but materially. Mitigation:
  refresh discipline (above), Phase 7 automated refresh script, and
  /review's mandatory analyst step catches stale-input rows before
  publication.
- **Cohort coverage of the data tables is an external dependency on
  this ADR's correctness.** A missing entry silently skips the
  derivation. Mitigation: `check-median-wage-coverage.ts` exits 1 on
  any miss; ships in this commit.
- **Derived rows extend the /review queue.** Two extra rows per program
  per run. With 85 cohort programs that's up to 170 review items per
  re-canary. Mitigation: derived rows are typically straightforward to
  review (inputs are visible); analyst time per row is low.

### Neutral

- **No methodology weight change.** Existing v1 indicator weights for
  A.1.2 (0.30 within A.1) and D.2.2 (0.30 within D.2) are unchanged. v1
  scores already in `scores` are not recomputed (per dispatch §14).
- **No Tier 2 expansion.** Derived fields do not invoke Tier 2 sources;
  ADR-013 is unaffected.
- **Phase 3.5 / ADR-014 disposition for D.2.2** ("KEEP — boundary fix
  expected to close. If it doesn't, COUNTRY-DEFAULT") aligns with this
  ADR. ADR-016's COUNTRY_CITIZENSHIP_RESIDENCE_YEARS table IS the
  country-default fallback ADR-014 anticipated; the derive stage is the
  mechanism that applies it.

---

## Implementation in commit 5 (this commit)

- `scripts/country-median-wage.ts` — 30-country lookup table, OECD primary
  / ILO fallback per Q3.
- `scripts/fx-rates.ts` — annual-average LCU-per-USD for cohort
  currencies.
- `scripts/country-citizenship-residence.ts` — years-as-PR-before-
  naturalisation, `null` for no-pathway countries.
- `scripts/check-median-wage-coverage.ts` — live-DB cohort-coverage
  check; gates re-canary.
- `packages/scoring/__tests__/country-median-wage.test.ts` — 11 static
  cohort-completeness assertions across all three tables.

## NOT in this commit (commit 6, blocked on this ADR being APPROVED)

- `packages/extraction/src/stages/derive.ts` — the derive stage
  implementation.
- Wiring into `scripts/canary-run.ts` and
  `jobs/src/jobs/extract-single-program.ts`.
- `packages/extraction/src/types/pipeline.ts` — new `DeriveStage`
  interface.
- Per-skip-condition logging.
- Vitest test for the derive stage's pure logic + skip conditions.
- /review UI surfacing `provenance.derivedInputs` (a small extension
  to `<ProvenanceTrigger>`).

## Rollback

If this ADR is rejected before commit 6 ships: nothing to roll back.
The static tables shipped in commit 5 are inert without commit 6's
derive stage.

If this ADR is approved and shipped, then later revoked:

1. Delete derived rows: `DELETE FROM field_values WHERE
provenance->>'extractionModel' = 'derived-computation';`
2. Revert commit 6.
3. Update this ADR to **Status: Reverted** with the rationale.
4. The static tables can stay (inert without the derive stage) or be
   deleted in a follow-up commit.

## Approval

This ADR requires explicit analyst approval before commit 6 ships per
analyst Q4 decision. To approve, change the **Status** line at the top
of this file to `APPROVED` and commit the change.

**Approved:** 2026-04-28, Szabolcs Fulop (TTR Group)
