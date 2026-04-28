# ADR-015 — Self-improving sources table (Stage 0 write-back + URL merge)

**Status:** Approved (Phase 3.6 / Fix E)
**Date:** 2026-04-28
**Authors:** Szabi (drafted via Phase 3.6 plan; approved alongside ADR-016).

---

## Context

Stage 0 (Perplexity API, `sonar-pro`) is the highest-leverage step in
the extraction pipeline: every URL it returns flows into Stage 1
scraping and shapes which fields can be populated downstream. The
Stage 0 call is also non-deterministic — Perplexity's web index, model
state, and random seed all drift between runs. The Phase 3 AUS
re-canary made the cost of this drift explicit:

> Fields populated in run N from URL X went empty in run N+1 because
> Stage 0 didn't re-discover X — even though X was still live, on a
> government domain, and authoritative.

Mitigation options considered:

1. **Manual per-country URL injection** — fragile, country-specific,
   doesn't scale beyond the 30-country cohort. Rejected.
2. **Sticky discovery cache** — already exists (7-day TTL). Doesn't
   help when the cache expires; the next Stage 0 call may still drop
   URLs that worked before.
3. **Self-improving registry** — every successful Stage 0 verification
   writes the URL to the cumulative `sources` table; subsequent runs
   merge the registry with fresh Stage 0 output. The registry grows
   monotonically; from run 2 onward, every URL that any prior run
   verified is guaranteed in the scrape set.

This ADR adopts option 3.

---

## Decision

### 1. Stage 0 write-back to `sources`

After `verifyUrls()` succeeds (HEAD-checked URLs filtered), every
surviving URL is upserted into `sources` keyed on
`UNIQUE(program_id, url)` (per migration 00010 / Q1 decision). On
conflict:

- `last_seen_at` is bumped to `NOW()`.
- `discovered_by` is set to `'stage-0-perplexity'`.
- `tier` is set to `MIN(existing_tier, fresh_tier)` — **never
  downgrade**. If the existing row was Tier 1 and Stage 0 today
  reclassifies the URL Tier 2, the registry retains Tier 1 (the
  lower-numbered, higher-authority value wins).

Write-back runs on **both** the cache-hit path AND the cache-miss
path of `discover.execute()`. This means the registry stays warm
even when Stage 0's API call is skipped — a 7-day cache hit still
bumps `last_seen_at` for every cached URL.

### 2. URL merging utility

`packages/extraction/src/utils/url-merge.ts` exposes:

- `mergeDiscoveredUrls({ freshFromStage0, fromSourcesTable, cap })` —
  pure function; returns the deduplicated, tier-ordered, capped list.
  Dedup by normalised URL (lowercased scheme/host, stripped trailing
  slash, stripped `utm_*` / `gclid` / `fbclid` / `mc_cid` / `mc_eid`
  tracking params). Order: Tier 1 first (quota 7), Tier 2 next
  (quota 4), Tier 3 last (quota 1). Within a tier, registry entries
  appear before fresh entries. Default cap: **12** (raised from 10).
  Fresh wins on conflict (newer reason text and classification).

- `loadProgramSourcesAsDiscovered(programId)` — DB read companion;
  filters to `tier IN (1, 2)`,
  `last_seen_at > NOW() - INTERVAL '90 days'`, and
  `programs.status = 'active'`. Stale and closed-program rows are
  excluded. Tier 3 (news) is not used for re-discovery.

### 3. Call sites

Both `scripts/canary-run.ts` and `jobs/src/jobs/extract-single-program.ts`
invoke the merge step at the same logical insertion point (after
`discover.execute()` returns, before Stage 1 scrapes), via the same
shared utility. The merged URL set is what flows into scrape and
into `discoveredByUrl` so per-field provenance resolution succeeds
for registry-only URLs.

### 4. Schema additions (migration 00010, already shipped)

| Column                         | Default  | Purpose                                                                        |
| ------------------------------ | -------- | ------------------------------------------------------------------------------ |
| `last_seen_at TIMESTAMPTZ`     | `NOW()`  | Bumped on every Stage 0 write-back.                                            |
| `discovered_by VARCHAR(50)`    | `'seed'` | Provenance: `'seed'` \| `'stage-0-perplexity'` \| `'manual'`.                  |
| `geographic_level VARCHAR(20)` | `NULL`   | ADR-003 four-level classification (was in BRIEF but missing from live schema). |

Plus uniqueness change: `UNIQUE(url)` → `UNIQUE(program_id, url)` so
two programs can share a source URL (one row per program-URL pair).

---

## Consequences

### Positive

- **Discovery is monotonic across runs.** From run 2 onward, every
  URL any prior run verified is guaranteed in the scrape set. Field
  coverage no longer regresses on Perplexity drift.
- **Registry self-builds across countries.** A useful URL discovered
  for the AUS Skills in Demand canary is automatically available for
  the AUS Specialist Skills canary if Perplexity drops it next run.
- **No per-country manual URL injection.** Adding a missing source is
  either a discovery prompt improvement (cohort-wide) or a one-time
  seed; the pipeline persists and reuses it automatically.
- **Auditable.** `discovered_by = 'stage-0-perplexity'` distinguishes
  pipeline-discovered rows from seed rows; `last_seen_at` shows when
  a URL was last re-validated by Stage 0.

### Negative

- **Bad URL persistence.** If Stage 0 ever returns a misclassified
  non-government URL that passes `verifyUrls()` HEAD-check, it
  persists in the registry. Mitigation: the existing 5-category
  source-mix prompt + HEAD-check is the gate. The registry doesn't
  add new trust; it persists what Stage 0 already produces.
- **Registry can grow unboundedly.** Mitigation: 90-day
  `last_seen_at` filter in `loadProgramSourcesAsDiscovered` excludes
  stale entries from the merge (rows stay in the table for audit).
  Phase 6 living-index URL-drift job is the long-term pruner.
- **Schema migration ripple.** `UNIQUE(url)` → `UNIQUE(program_id, url)`
  required the migration 00010 work. No data was lost; existing rows
  satisfied the new constraint trivially.

### Neutral

- **No change to `discover.ts`'s Perplexity call, prompt,
  `verifyUrls()`, or cache-key logic.** Write-back is purely
  additive.
- **No methodology weight change.** Pure pipeline operation.

---

## Implementation in commit 7

- `packages/extraction/src/utils/url-merge.ts` — new utility.
  `mergeDiscoveredUrls`, `loadProgramSourcesAsDiscovered`,
  `normaliseUrl`, `DEFAULT_URL_CAP`, `TIER_QUOTAS`.
- `packages/extraction/src/stages/discover.ts` — `writeToSourcesTable`
  exported; called on both cache-hit and cache-miss paths.
- `packages/extraction/src/index.ts` — new exports.
- `scripts/canary-run.ts`, `jobs/src/jobs/extract-single-program.ts`
  — merge call after Stage 0, before Stage 1.
- Tests:
  - `__tests__/url-merge.test.ts` (16): normalisation, dedup, tier
    ordering, registry-first within tier, quotas, cap, fall-through.
  - `__tests__/discover-writeback.test.ts` (6): inserts with
    `discovered_by='stage-0-perplexity'`, never downgrade tier,
    bumps `last_seen_at`, idempotent across runs, FK-skip,
    cache-hit-path write-back fires.
  - `__tests__/sources-registry-monotonic.integration.test.ts` (2):
    LIVE DB against staging DIRECT_URL. Run 2 sources are a superset
    of run 1; idempotent same-input → same row count. `afterAll`
    cleanup verified zero residue.

Schema migration shipped earlier in commit 1 (migration 00010).

## Rollback

If this ADR is revoked:

1. Revert commit 7 (the wiring + utility + tests).
2. Optionally drop the new schema columns and restore `UNIQUE(url)`
   via a follow-up migration. The columns are inert without the
   write-back wiring; rollback can be deferred.
3. Existing `sources` rows written by Stage 0 stay in the table as
   historical record. They will not be queried by any code after
   the revert.

## Approval

This ADR was approved alongside ADR-016 by Szabolcs Fulop on
2026-04-28 as part of the Phase 3.6 plan sign-off.

**Approved:** 2026-04-28, Szabolcs Fulop (TTR Group)
