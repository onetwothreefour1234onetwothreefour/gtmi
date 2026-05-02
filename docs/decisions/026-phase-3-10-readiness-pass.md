# ADR-026 — Phase 3.10 readiness pass

**Status:** ACCEPTED — 2026-05-02. Code shipped Sessions 18–19; this ADR
captures the decisions retroactively so the trade-offs survive the next
maintainer.
**Supersedes:** none. Extends ADR-024 (anti-bot blocker registry) and
ADR-025 (country-level derives) by adding the wiring + observability
layer that makes them production-ready.

## Context

Phase 3.9 closed with twelve derives, an auto-populating
`blocker_domains` registry, and Wayback-first routing — the _mechanisms_
were correct. But the cohort dry-run revealed three unresolved gaps:

1. The mechanisms shipped without the surface area that turns them
   into a usable production system. The registry was queryable only
   via SQL; the new derive provenance markers were never tested
   against the /review UI; the Trigger.dev twin still spoke the
   pre-Phase-3.9 derive set; cost was guarded only at the per-canary
   grain, not per-programme.
2. The repo had accumulated 18 phase-specific one-shot scripts and a
   1361-line `canary-run.ts` that was hard to safely change.
3. Six independent quality / operational improvements were on the
   wishlist but unprioritized: cross-check activation, derive-vs-LLM
   mismatch detection, parallel HEAD-check, per-programme cost cap,
   blocker-recheck cron, /review keyboard nav.

Cohort scaling without addressing all three would be brittle. Phase 3.10
is the readiness pass that closes them.

## Decision

Three buckets, each shipped as a coherent set of small commits:

### Bucket 1 — Wiring (steps 3.10.1 → 3.10.4)

- **3.10.1 — Data hygiene.** Curated `programs.launch_year` for the
  full 91-row cohort via `scripts/seed-launch-years.ts`. Idempotent
  re-runs; default dry-run; `--execute` writes; `--force` overwrites.
- **3.10.2 — `/admin/blockers` route.** Read-only registry list +
  manual-override insert + per-row clear. Auth-gated under the
  existing (internal) layout. Mounted in the same Cloud Run image as
  /review.
- **3.10.3 — Trigger.dev parity.** `extract-single-program.ts` now
  reads `blocker_domains`, threads `blockerDomains` into
  `mergeDiscoveredUrls` (W22), loads `programs.launch_year` for
  E.1.3, calls all twelve derives — closing the divergence with
  `canary-run.ts`.
- **3.10.4 — Cost + observability.** `costEstimate` field added to
  `PipelineResult`; structured `{"event":"blocker_detected",…}` JSON
  marker emitted alongside the human-readable log line so a Cloud
  Logging metric can count daily blocker registrations.

### Bucket 2 — Cleanup (step 3.10.5b)

Deleted 18 phase-specific one-shot scripts (every reference verified
to be docs / settings only, no live imports). Consolidated 11
`check-*.ts` scripts and 3 `purge-*.ts` scripts into single-file
subcommand runners (`scripts/check.ts`, `scripts/purge.ts`). Dropped
the deprecated `PHASE3_TARGETED_RERUN` env var and the unused
`MODEL_DISCOVERY` constant. Net effect: 25 scripts in `scripts/`
(was 43), no test regressions, smaller surface area for the cohort
run to inherit.

### Bucket 3 — Quality + operations (step 3.10.5c, six independent items)

Each independently small; bundled as one logical group.

1. **Cross-check selectively for auto-approve candidates.** The
   stage was hardcoded `not_checked` since Phase 2. Wiring it up
   on every published row would double LLM cost. The chosen
   trade-off: run `crossCheck.execute()` against ONE Tier 2 source
   only when a row would otherwise auto-approve. Disagreements
   override auto-approve and route to /review with the conflict
   recorded in `provenance.crossCheckResult`. Cost impact:
   ~$0.02–$0.04 per programme.
2. **Derive vs. LLM mismatch detection.** When `executeDerived`
   publishes a row whose prior `field_values` row was an LLM
   extraction with a different normalized value, log a
   `[DERIVE_LLM_MISMATCH]` event and attach a `deriveLlmMismatch`
   note to the new row's provenance. Free quality gate (DB lookup
   only); the derive still publishes (methodology-mandated source).
3. **Smarter HEAD verification.** `verifyUrls` now (a) caps at 8
   concurrent HEAD requests (was unbounded), (b) drops blocker-
   domain hostnames pre-HEAD, (c) drops URLs whose `Content-Length`
   header is below 1024 bytes, (d) reduces timeout from 10s to 5s.
4. **Per-programme cost cap.** `MAX_COST_PER_PROGRAM_USD` (default
   $1.50). Aborts the current programme on overrun without throwing
   so a multi-programme batch keeps moving.
5. **Auto-recheck `blocker_domains`.** New `blocker-recheck`
   Trigger.dev cron at `0 4 * * 1`. Pre-recheck DELETE so the
   cascade runs without Wayback-first interference; re-insert on
   failed recheck; `BLOCKER_CLEARED` log line on success. Safety-net
   re-insert on mid-loop exception.
6. **/review keyboard navigation + SLA timer.** J/K navigate, O/Enter
   open, ?/Esc help/clear. Per-row `data-sla-tier` (`green` <7d,
   `orange` 7–13d, `red` ≥14d) with a coloured dot in the Age column.

## Consequences

### Positive

- Cohort dry-run now starts from a reliable foundation: every Phase
  3.9 mechanism is exercised by both `canary-run.ts` and the
  Trigger.dev twin, registered in admin UI, observable in Cloud
  Logging, cost-capped per-programme, and triageable via /review
  keyboard nav.
- Repo surface area is materially smaller — 25 scripts vs 43,
  consolidated subcommand runners replace 14 ad-hoc one-shots.
- Quality gates stack: cross-check disagreement vetoes auto-
  approve; derive-LLM mismatch annotates the row; HEAD-check
  rejects blocker URLs pre-merge.
- `blocker_domains` registry no longer grows unbounded — the
  weekly recheck cron clears stale flags as sites fix their walls.
- Reviewer throughput will scale: keyboard nav + SLA dots make a
  ≥1500-row queue tractable.

### Negative / accepted trade-offs

- Cross-check costs $0.02–$0.04 per programme even when every row
  agrees. Acceptable: one auto-approved hallucination caught is
  worth thousands of cross-checks.
- Per-programme cost cap is upfront-only (projection-based) for
  now; runtime / actuals tracking is deferred until per-LLM-call
  cost instrumentation lands. The upfront guard catches the
  common case (Stage 0 returned 50 URLs and projection blows up).
- The blocker-recheck cron is racy by construction: it deletes the
  row pre-recheck and re-inserts on failure. Adequate for a
  once-weekly job; the safety-net re-insert covers mid-loop
  exceptions.
- Curated `programs.launch_year` values for some long-running
  programmes (e.g. NAM Immigration Control Act 1993, USA H-1B 1990) are intentionally older than the 20-year cap; the
  `deriveE13` cap-at-20 is the right compression. Best-evidence
  dates from published sources; re-check cadence: annual.
- The /review SLA thresholds (7d orange, 14d red) are guesses
  until cohort throughput data lands. Chosen because they match
  industry "two-sprint" review rhythms.

## Validation

- 953 tests pass across all packages (storage 22, scoring 255,
  extraction 353, apps/web 323).
- Workspace typecheck clean across all 8 packages.
- Workspace lint clean.
- 15 commits shipped to `main` across Sessions 18–19; CI green
  on every commit.
- `programs.launch_year` populated 91/91 (was 2/91 entering 3.10).

## Files

- Migrations applied: none new (existing 00001–00017 still authoritative).
- New helpers in `@gtmi/extraction`: cross-check threading,
  derive-LLM mismatch detection in `publish.ts`, parallel
  `_verifyOneUrl` in `discover.ts`, `MAX_COST_PER_PROGRAM_USD`
  cost-cap branch in `canary-run.ts`.
- New jobs: `jobs/src/jobs/blocker-recheck.ts`.
- New web routes: `apps/web/(internal)/admin/blockers/`.
- New scripts: `scripts/check.ts`, `scripts/purge.ts`,
  `scripts/seed-launch-years.ts`.
- New web components: `<ReviewQueueKeyboard>` + `<SlaDot>` in
  `apps/web/components/gtmi/review-queue-table.tsx`.

Phase 3.10b (8 follow-ups) and Phase 3.10c (10 forward-pulls from
Phase 5/6/7) extend this ADR's scope; tracked inline in
`IMPLEMENTATION_PLAN.md`.
