# Phase 3 — Coverage Maximization

This directory holds the artefacts for the Phase 3 coverage push (per
`docs/IMPLEMENTATION_PLAN.md` §Phase 3).

## Pre-flight baseline (read-only — captured at tag `phase-3-baseline`)

| File                     | Source                                 | What it captures                                                                             |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `baseline-gaps.csv`      | `scripts/audit-empty-fields-rollup.ts` | One row per (programme, field) for AUS+SGP+CAN canary programmes; classification per ADR-013 |
| `baseline-url-drift.csv` | `scripts/check-tier1-url-drift.ts`     | HEAD-probe of every Tier-1 URL across the cohort (DB `sources` + registry)                   |

### Coverage at baseline (post-Phase 2 close-out + a few /review approvals)

| Programme                                     | POPULATED / 48 | Coverage |
| --------------------------------------------- | -------------- | -------- |
| AUS Skills in Demand 482 — Core Skills Stream | 31 / 48        | 64.6%    |
| SGP S Pass                                    | 36 / 48        | 75.0%    |
| CAN Express Entry – Federal Skilled Worker    | 23 / 48        | 47.9%    |

**Total POPULATED:** 90 / 144 (62.5%).

### Empty-field classification at baseline

| Bucket      | Count | Notes                                                                                                                                                       |
| ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRUNCATION  | 0     | The Phase 2 windowing fix held — no fields blocked purely by the 30K-char head-slice.                                                                       |
| LLM_MISS    | 29    | Fuzzy upper bound — keyword matched somewhere in cached content but extraction returned empty. Phase 3.3 prompt sweep target. Manual triage will trim this. |
| ABSENT      | 25    | Keyword not found in any cached scrape — likely needs cross-departmental discovery (3.2) or a methodology v2 decision (3.5).                                |
| URL_MISSING | 0     | No canary programme is missing all source rows.                                                                                                             |

### Provenance health at baseline (read-only — `verify-provenance.ts`)

| Status filter    | AUS     | SGP                     | CAN                       | Notes                                                                                                                                                                               |
| ---------------- | ------- | ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approved`       | ✓ 6/6   | ✓ 6/6                   | ✓ 3/3                     | Every approved row carries complete provenance (13 + 3 keys per ADR-007).                                                                                                           |
| `pending_review` | 1 issue | 14 issues across 2 rows | 140 issues across 20 rows | Pre-Phase-3 orphan rows from earlier canary runs. **Left in place** per Phase 3 safety rail "document, don't delete" — they are someone's in-progress work and predate this branch. |

The orphan pending_review rows do not contribute to scoring (only `approved`
rows do), and they are visible in the gap register so they cannot be silently
forgotten.

### URL drift at baseline

| Status     | Count | Notes                                                                                                                                       |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| LIVE       | 37    | OK.                                                                                                                                         |
| GONE (404) | 2     | `mom.gov.sg/.../bringing-your-family-to-singapore`, `moe.gov.sg/.../register-for-primary-1`. Replace before the next SGP re-canary.         |
| ERROR_4xx  | 1     | `edb.gov.sg/.../tech-pass.html` (403 — likely user-agent block; the Playwright scraper service is unaffected).                              |
| TIMEOUT    | 8     | All on `canada.ca` — the canada.ca CDN rejects our HEAD probe but works fine through the Playwright scraper service. **Not a real outage.** |

URL replacements are **not** auto-applied. Per safety rail "document, don't
delete" — every change to `country-sources.ts` or the DB `sources` table
goes through PR review, because a wrong replacement loses provenance
continuity.

## Test posture at baseline

`pnpm test` runs three packages — all green:

| Package            | Test files | Tests passing |
| ------------------ | ---------- | ------------- |
| `@gtmi/scoring`    | 2          | 93            |
| `@gtmi/web`        | 10         | 124           |
| `@gtmi/extraction` | 2          | 25            |
| **Total**          | **14**     | **242**       |

(The "99 tests" figure in older docs was scoring + db combined, before the
Phase 4 a11y suite shipped. Total is now 242.)

## Reproducing the baseline

```bash
# Gap register
pnpm --filter @gtmi/db exec tsx ../../scripts/audit-empty-fields-rollup.ts \
  --countries AUS,SGP,CAN \
  --only-canaried \
  --out ../../docs/phase-3/baseline-gaps.csv

# URL drift sweep
pnpm --filter @gtmi/db exec tsx ../../scripts/check-tier1-url-drift.ts \
  --countries AUS,SGP,CAN,GBR,HKG \
  --out ../../docs/phase-3/baseline-url-drift.csv

# Provenance verifier (run for each country)
pnpm --filter @gtmi/db exec tsx ../../scripts/verify-provenance.ts --country AUS --status approved
pnpm --filter @gtmi/db exec tsx ../../scripts/verify-provenance.ts --country SGP --status approved
pnpm --filter @gtmi/db exec tsx ../../scripts/verify-provenance.ts --country CAN --status approved
```

## Regression gate for every Phase 3 sub-phase

Per the plan's safety rail #6, after each sub-phase merges the same three
commands are re-run and the new gap register is diffed against
`baseline-gaps.csv`. **No field is allowed to flip from POPULATED → empty
without a documented reason** (e.g., a methodology v2 indicator drop).

## What's next

`IMPLEMENTATION_PLAN.md` §Phase 3 sub-phases, in order:

1. **3.1 V-Dem direct-API** — closes E.3.1 cohort-wide.
2. **3.2 Cross-departmental discovery audit** — D.3.x tax + E.2.x transparency.
3. **3.3 Cohort-wide prompt sweep** — LLM_MISS → 0.
4. **3.4 Tier 2 backfill (ADR-013)** — fields outside the scoring core.
5. **3.5 Methodology v2 (ADR-014)** — restructure / drop / country-substitute.

Phase 5 (the 5-country pilot) cannot start until every canary programme
reaches ≥42/48 — the Phase 3 close-out gate.
