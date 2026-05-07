# ADR-032 — Pillar E restructure (Track Record + Rule Stability) and WGI/V-Dem retirement

**Status:** ACCEPTED — 2026-05-07. Supersedes ADR-016 (E portion), ADR-025 (E.1.1 / E.1.3 portion). Partially superseded by future ADR-033 (deferred dormant-infrastructure cleanup).

## Context

Methodology v6.0.0 collapses Pillar E (Stability) from **8 indicators across 3 sub-factors** to **4 indicators across 2 sub-factors**, framed as **Track Record** (E.1) and **Rule Stability** (E.2). The institutional-quality sub-factor E.3 is retired entirely, killing the World Bank WGI Government Effectiveness (E.3.2) and Rule of Law (E.3.1, V-Dem fallback) ingestion path. Pillar E weight within PAQ is unchanged at 15%.

The new structure is:

| Key   | Label                                                             | dataType               | normFn                 | Direction        | Sub-weight |
| ----- | ----------------------------------------------------------------- | ---------------------- | ---------------------- | ---------------- | ---------- |
| E.1.1 | Program age (years since introduction in current form)            | numeric                | min_max                | higher_is_better | 0.5        |
| E.1.2 | Cumulative approvals or active visa holders                       | numeric_or_categorical | numeric_or_categorical | higher_is_better | 0.5        |
| E.2.1 | Material policy changes in last 5 years (severity-weighted count) | numeric                | min_max                | lower_is_better  | 0.5        |
| E.2.2 | Program suspension or abrupt closure history (last 10 years)      | boolean                | boolean                | lower_is_better  | 0.5        |

Sub-factor weights: E.1 = 0.5, E.2 = 0.5. Total methodology indicator count: 9 (A) + 7 (B) + 8 (C) + 5 (D) + **4 (E)** = **33** (was 37 under v5.0.0).

## Key collisions

Five of the eight v5 keys carried into v6 with semantic changes; this required a hard-delete of every Pillar E `field_values` row. The four retained keys (E.1.1, E.1.2, E.2.1, E.2.2) are UPDATEd in place via the seed's `onConflictDoUpdate(target=key)` pattern (decision §a — preserves `field_definitions.id` lineage); the four retired keys (E.1.3, E.2.3, E.3.1, E.3.2) are DELETEd. Migration `00030_pillar_e_v6_purge.sql` cascades through `review_queue`, `policy_changes`, `extraction_attempts`, `extraction_prompts`, and `field_values` before dropping the retired keys.

| New key | v5 meaning                                                  | v6 meaning                                                           |
| ------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| E.1.1   | severity-weighted policy changes (z_score, lower_is_better) | program age (min_max, higher_is_better, ceiling 20)                  |
| E.1.2   | forward-announced pipeline changes (boolean)                | cumulative approvals or active visa holders (numeric_or_categorical) |
| E.2.1   | published approval rate (boolean)                           | severity-weighted policy changes (min_max, lower_is_better)          |
| E.2.2   | published quota / cap (categorical)                         | program suspension history (boolean, last 10 years)                  |

## Decisions

### a. Conditional in-place UPDATE for retained keys

Migration deletes only the four genuinely-retired keys (E.1.3, E.2.3, E.3.1, E.3.2) and lets the seed UPDATE the four retained keys' `label`, `prompt`, `normFn`, `direction`, `rubric`, and `weightWithinSubFactor`. Preserves `field_definitions.id` lineage for audit. All `field_values` rows are still hard-deleted because the prompts and normFns differ enough that legacy values are unscoreable under v6.

### b. E.1.2 dual-format — numeric_or_categorical

A new normalization function `numeric_or_categorical` handles fields where the LLM may return either an integer (preferred) or a categorical bucket string (fallback when only a coarse range is reported). The engine discriminates on `typeof parsed === 'string'` vs `'number'`:

- **String form** → straightforward rubric lookup via `normalizeCategorical`. Rubric: `large=100 / medium=75 / small=50 / marginal=25 / no_data=0`.
- **Numeric form** → piecewise linear interpolation against bucket boundaries anchored at the rubric breakpoints:

  | Threshold | Score | Rubric anchor    |
  | --------- | ----- | ---------------- |
  | 0         | 0     | no_data baseline |
  | 100       | 25    | marginal lower   |
  | 1,000     | 50    | small lower      |
  | 10,000    | 75    | medium lower     |
  | ≥ 50,000  | 100   | large ceiling    |

  Numeric and categorical forms are continuous at the bucket boundaries: 50,000 → 100 (top of medium = bottom of large), 10,000 → 75 (top of small = bottom of medium), etc.

Bucket configuration lives in `packages/scoring/src/normalize.ts:NUMERIC_OR_CATEGORICAL_BUCKETS`, keyed by field — currently E.1.2 only. Adding new dual-format fields requires an entry there plus a matching rubric.

The `'no_data'` token is NOT mapped to null. Per the spec, absence of public reporting is itself a transparency signal — `no_data` scores 0 and stays in the cohort.

### c. E.1.1 program age ceiling — encoded in normalization params

The 20-year ceiling moved from the v5 derive (which truncated at the source) to the scoring engine. The placeholder `min_max` params for E.1.1 are `{ min: 0, max: 20 }`; `normalizeMinMax` already clamps the output to [0, 100], so a program with raw age 36 produces `(36 - 0) / (20 - 0) = 1.8` which clamps to score 100. The LLM is instructed to report the actual integer age (not capped) so the audit value preserves the underlying age and Phase 5 calibration can adjust the ceiling without re-extraction. Sanity range is `{ min: 0, max: 200 }` to catch typos without false-rejecting H-1B-style oldest programs.

### d. deriveE13 → deriveProgramAge; deriveE11 retired

The `deriveE13` (program age from `programs.launch_year`) function was renamed to `deriveProgramAge` and now writes to the new `E.1.1` key (was `E.1.3`). The `programs.launch_year` column and the `seed-launch-years.ts` curation script remain in use unchanged.

The `deriveE11` (severity-weighted policy-change count from `PROGRAM_POLICY_HISTORY`) function was deleted entirely. The new E.2.1 is LLM-extracted from the same recall hints (Migration Policy Institute, OECD migration outlooks, IMD reports). The `program-policy-history.ts` data file was also deleted; only one programme had been curated and the LLM-extraction path is now the standard.

### e. WGI / V-Dem fetchers retired

`fetchVdemRuleOfLawScore`, `fetchWgiScore`, `fetchAllWgiScores`, `ISO3_TO_ISO2` (the country-sources copy), and the `PHASE3_VDEM_ENABLED` env flag are all deleted from `scripts/country-sources.ts`, `scripts/canary-run.ts`, and `jobs/src/jobs/extract-single-program.ts`. The Phase 1 pre-fetch and the E.3.1 / E.3.2 publish branches that consumed them are gone. The `phase-3.6-vdem-flag.test.ts` test file is deleted.

`apps/web/lib/country-iso.ts` keeps its independent `ISO3_TO_ISO2` map (used by other features); the deletion is scoped to the `country-sources.ts` copy only.

### f. imd-appeal-refresh synthetic FK repointed

`jobs/src/jobs/imd-appeal-refresh.ts` writes a synthetic `policy_changes` summary row whose FK previously pinned to E.3.2. After v6 there is no E.3.2 row. The FK now points to A.1.1 (always-present, highest-weight cohort field). Per the original comment, the linkage is cosmetic — the row's purpose is the timeline marker.

### g. stabilityEdgeCase provenance flag dropped

The `stabilityEdgeCase` boolean on `ProvenanceOptionalFields` documented v5 E.1.1 z-score mean-substitution for programs younger than 3 years. v6 E.1.1 is min_max program age; mean-substitution is no longer applicable. The flag, the `provenance-drawer.tsx` rendering branch, and the `data-integrity.md` mention are all removed. (The `IMPLEMENTATION_PLAN.md` mentions are historical and left intact.)

### h. WAVE_2_FIELD_CODES kept empty

All 4 new E indicators move into `WAVE_1_FIELD_CODES`. `WAVE_2_FIELD_CODES` is kept as an empty array (with `WAVE_2_ENABLED` flag intact) for forward-compat with future indicator additions, matching the v5 cleanup pattern for other dormant infrastructure.

### i. SUB_FACTOR_WEIGHTS bug fix (D + E)

Discovered while tracing the engine's pillar-aggregation path: `packages/scoring/src/score.ts:SUB_FACTOR_WEIGHTS` had drifted from `methodology-v1.sub_factor_weights`. v5 left D in 3-sub-factor shape (`D.1: 0.5, D.2: 0.35, D.3: 0.15`) when the methodology had moved to 2-sub-factor shape (`D.1: 0.4, D.2: 0.6`). The runtime engine's re-normalisation in `aggregateWeightedMean` masked the drift (orphaned weights filtered out, in-scope weights re-normalised), but the constant was nonetheless inconsistent with the seed. ADR-032 brings score.ts into line with the seed for both D and E:

```
A: { 'A.1': 0.5, 'A.2': 0.3, 'A.3': 0.2 },
B: { 'B.1': 0.3, 'B.2': 0.2, 'B.3': 0.3, 'B.4': 0.2 },
C: { 'C.1': 0.4, 'C.2': 0.4, 'C.3': 0.2 },
D: { 'D.1': 0.4, 'D.2': 0.6 },
E: { 'E.1': 0.5, 'E.2': 0.5 },
```

### j. E.2.2 narrowed to last 10 years

E.2.2 (suspension history) asks about events in the last 10 years (2016+) rather than "ever". Reduces LLM-recall variance for older programs (e.g. H-1B from 1990) where pre-2016 events are poorly covered by current government sources. Window matches the methodology-v1 program-history convention used elsewhere.

### k. Pillar E label

`Pillar E: Stability` retained in `METHODOLOGY.md` for continuity with prior versions and the dashboard rendering. The new sub-factor framing (Track Record + Rule Stability) appears in the prose.

## Deferred to ADR-033

The boolean_with_annotation infrastructure (`BOOLEAN_WITH_ANNOTATION_KEYS`, `STRUCTURED_BOOL_RUBRIC`), country_substitute_regional infrastructure (`REGIONAL_SUBSTITUTES`, `executeCountrySubstitute`, the engine branch), and the orphaned policy-entry data modules (`country-pr-timeline`, `country-civic-test-policy`, `country-tax-residency`, `country-tax-basis`) all remain dormant after Pillar E retirement. ADR-033 will sweep these alongside any other dead code surfaced by Phase 5 calibration.

## Methodology version

Bumps from 5.0.0 → 6.0.0. Total indicator count 33. The `methodology_versions.calibrated_params` strip for `E.*` keys is documented as a manual one-liner in the migration's comment block (apply-migration.ts cannot parse DO blocks with embedded semicolons; same as 00026–00029).
