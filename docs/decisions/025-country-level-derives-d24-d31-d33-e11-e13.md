# ADR-025 — Country-level derives for D.2.4 / D.3.1 / D.3.3 + E.1.1 / E.1.3

**Status:** ACCEPTED — 2026-05-01.
**Supersedes:** none. Extends ADR-016 (derived fields, Stage 6.5).

## Context

ADR-016 introduced the derive stage with two indicators: A.1.2 (salary
threshold % of median wage) and D.2.2 (years to citizenship). Phase
3.6.1–3.6.4 added five more (D.2.3, B.2.4, D.1.3, D.1.4, D.1.2). This
brought derive coverage to 7/48 fields.

Phase 3.9 canary diagnostics revealed a coherent class of **country-
deterministic** indicators that were still being attempted via LLM
extraction despite their authoritative source living entirely off the
visa-programme page Stage 0 reaches first:

- **D.2.4** (civic / language / integration test burden for citizenship)
  — set by national citizenship law. Lives on the citizenship
  authority's site (USCIS / Home Office / BAMF / ICA / MOJ), not the
  temporary-visa page.
- **D.3.1** (tax-residency trigger, days/yr) — set by national tax code.
  Lives on the tax authority's site (IRS / ATO / IRAS / NTA), not the
  visa page. Some jurisdictions use a non-day-count primary mechanism
  (NLD facts-and-circumstances; territorial regimes); for those D.3.1
  is structurally null and D.3.3 carries the answer.
- **D.3.3** (territorial vs. worldwide taxation for residents) — set by
  national tax code. Same locality issue.
- **E.1.3** (program age, capped at 20) — fully deterministic from
  `programs.launch_year` minus the current year, capped. No external
  source needed.
- **E.1.1** (severity-weighted policy-change count, 5-yr window) —
  per-programme curated knowledge. The events themselves are not always
  on a "changelog" page; analysts compile from OECD migration outlooks,
  MPI country profiles, and government press releases.

Without derives, these five indicators routed through the full LLM
cascade for every cohort programme and routinely returned LLM_MISS
because the answer is not on the page Stage 0 surfaced.

## Decision

Add five new derive functions following the existing ADR-016 pattern:
country-agnostic mechanism in code, per-country (or per-programme)
data in lookup tables. Total derive coverage moves from 7/48 to
**12/48**.

### New lookups

`packages/extraction/src/data/`:

- `country-civic-test-policy.ts` — `CivicTestPolicy { iso3, burden:
'none' | 'light' | 'moderate' | 'heavy' | null, notes, sourceUrl,
sourceYear }`. 27 cohort countries; `null` for GCC monarchies (no
  realistic naturalisation pathway from a talent visa).
- `country-tax-residency.ts` — `TaxResidencyPolicy { iso3, triggerDays:
number | null, ... }`. Day-count threshold (typically 183) where the
  jurisdiction has one; `null` for territorial / facts-and-circumstances
  jurisdictions.
- `country-tax-basis.ts` — `TaxBasisPolicy { iso3, basis:
'worldwide' | 'worldwide_with_remittance_basis' | 'territorial' |
'hybrid' | null, ... }`.
- `program-policy-history.ts` — `ProgramPolicyHistory { programId,
programName, windowStartYear, windowEndYear, events:
PolicyChangeEvent[], sourceUrl, notes? }` keyed by programId. Empty
  by default; only the programmes with known reform history are
  seeded. Each event is `{ year, severity: 'major' | 'moderate' |
'minor', description }`.

### New derives

`packages/extraction/src/stages/derive.ts`:

| derive      | model                 | confidence | inputs                               |
| ----------- | --------------------- | ---------- | ------------------------------------ |
| `deriveD24` | `derived-knowledge`   | 0.7        | `CivicTestPolicy`                    |
| `deriveD31` | `derived-knowledge`   | 0.7        | `TaxResidencyPolicy`                 |
| `deriveD33` | `derived-knowledge`   | 0.7        | `TaxBasisPolicy`                     |
| `deriveE13` | `derived-computation` | 0.6        | `programs.launch_year`, current year |
| `deriveE11` | `derived-knowledge`   | 0.7        | `ProgramPolicyHistory`               |

`buildCountryDerivedRow` is a shared helper for the three D-pillar
categorical/numeric derives. All five route to /review (confidence <
0.85). The methodology weights for E.1.1 (major=3, moderate=2,
minor=1) live in code; the per-programme data is just a list of
events.

### Skip semantics

Each derive returns null on a skip condition with a one-line log.
None throw. Skip logs differentiate "no entry for this country" from
"entry exists but value is null (genuinely not applicable)" — the
distinction matters for the missing-data audit:

```
[D.2.4] derived skip — no COUNTRY_CIVIC_TEST_POLICY entry for XYZ
[D.2.4] derived skip — ARE has no realistic naturalisation pathway
[D.3.1] derived skip — NLD uses non-day-count primary mechanism (see D.3.3)
[E.1.3] derived skip — programs.launch_year is null for program {id}
[E.1.1] derived skip — no PROGRAM_POLICY_HISTORY entry for program {id}
```

For E.1.3, "future launch year" also skips (defensive against bad
data).

## Consequences

### Positive

- Coverage ceiling raised: every programme in a cohort country now has
  D.2.4, D.3.3 derived for free. D.3.1 derived where applicable.
  E.1.3 derived as soon as `programs.launch_year` is set. E.1.1
  derived for any seeded programme.
- Analyst-curated, methodology-aligned: the categorical scales follow
  the methodology-v1 D.2.4 / D.3.3 rubrics exactly; severity weights
  for E.1.1 follow the methodology's major/moderate/minor definitions.
- Country-agnostic mechanism: extending to a new country is a data PR
  (one row in each lookup), not a code change.
- Reproducible: same inputs → same output bytes. Same content_hash on
  every run.
- /review-routed: derived rows carry `extractionConfidence = 0.7`
  (knowledge) or `0.6` (computation), forcing human approval before
  publish. The category names in `extractionModel` (`derived-knowledge`
  / `derived-computation`) flag the row in the review UI.

### Negative / accepted trade-offs

- The lookups are now an analyst-maintained surface area. Annual
  re-check cadence required (header notes on each file enforce this).
- For NLD-style jurisdictions, D.3.1 stays null. The methodology's
  missing-data handling already covers this; we explicitly do not
  invent a number.
- The mapping from real-world tests to the methodology categorical
  scale (D.2.4: how heavy is "light vs moderate vs heavy"?) involves
  judgement. The notes field on each entry preserves the underlying
  detail so a /review pass can interrogate the call.

## Validation

- `packages/extraction/src/__tests__/derive-d24-d31-d33.test.ts` — 17
  cases covering happy path, null-entry skip, null-value skip,
  below-auto-approve confidence, cohort completeness against
  `COUNTRY_PR_TIMELINE`, and categorical-scale validation.
- `packages/extraction/src/__tests__/derive-e11-e13.test.ts` — 15
  cases covering cap-at-20, zero-on-launch-year, null launchYear,
  future launch-year, sourceUrl override / urn-sentinel fallback,
  empty events array, and the registry-shape sanity (severity
  buckets, window non-empty, every event year inside its window).
- 2026-05-01 production canary: NLD HSM published all five new
  derives (D.2.4 = moderate, D.3.1 correctly skipped facts-and-
  circumstances, D.3.3 = worldwide, E.1.3 = 22 → 20 cap, E.1.1 =
  5). JPN HSP published the four applicable (D.2.4 = light, D.3.1 =
  183, D.3.3 = hybrid, E.1.3 = 11, E.1.1 = 5 once seeded).

## Files

- `packages/extraction/src/data/country-civic-test-policy.ts`
- `packages/extraction/src/data/country-tax-residency.ts`
- `packages/extraction/src/data/country-tax-basis.ts`
- `packages/extraction/src/data/program-policy-history.ts`
- `packages/extraction/src/stages/derive.ts` — `deriveD24`,
  `deriveD31`, `deriveD33`, `deriveE13`, `deriveE11`,
  `buildCountryDerivedRow`
- `packages/extraction/src/types/pipeline.ts` — `DeriveStageInputs`
  optional `d24` / `d31` / `d33` / `e13` / `e11` fields
- `packages/extraction/src/index.ts` — public exports
- `scripts/canary-run.ts` — resolve lookup entries + queue derived
  rows alongside the existing seven
