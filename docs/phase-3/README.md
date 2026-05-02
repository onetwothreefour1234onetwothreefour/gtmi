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

**Phase 3 closed at Phase 3.9 (2026-05-02).** Sub-phases 3.1 (V-Dem
direct-API), 3.2 (cross-departmental discovery audit), 3.3 (cohort-wide
prompt sweep), 3.4 (Tier 2 backfill via ADR-013), 3.5 (methodology v2
review via ADR-014), 3.6 (re-canary prep + ADR-015 self-improving
discovery + ADR-016 derive stage), 3.7 (review-tab + rubric integrity
ADRs 017/018/019), 3.8 (bulk-approve + on-demand + auto re-score ADRs
020/021/022), and **3.9** (robustness + archive + anti-bot routing +
expanded derives via ADRs 023/024/025) all shipped on `main`.

Phase 3.9 closing position:

- **Derive coverage: 12/48** (was 7 entering 3.9). Every D-pillar
  country-deterministic indicator and the E-pillar age + history
  indicators are now derived without LLM invocation.
- **Anti-bot routing live.** `blocker_domains` registry seeded
  organically; `www.isa.go.jp` was the first auto-flag (2026-05-01).
- **Production canary outcomes:** NLD HSM 44/48 (D.3.1 correctly null
  per facts-and-circumstances; A.1.1/A.1.2/B.2.2 still IND-page-bound).
  JPN HSP 23/48 (ISA's all-paths anti-bot wall is the structural
  ceiling; the 11 applicable derives all publish).

The Phase 5 gate has been replaced. The new gate is the **Phase 3.10
readiness pass** — see [IMPLEMENTATION_PLAN.md §Phase 3.10](../IMPLEMENTATION_PLAN.md). Until that passes, no
mass-cohort scrape runs.
