# ADR-022 — Auto-rescore after canary + helper consolidation

**Status:** Implemented (Phase 3.8 — review-tab improvements III, follow-up to ADR-020 / ADR-021).
**Date:** 2026-04-30
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

ADR-020 added the rescore buttons. ADR-021 wired composite-score
refresh into the buttons (per-row, per-programme, cohort). Together
they cover the analyst's manual workflow.

Live observation on 2026-04-30 surfaced the next gap: a fresh canary
run scrapes + extracts + publishes new field values, but the public
dashboard keeps serving stale composites until the analyst remembers
to click "Re-score cohort". The canary should be self-sufficient — a
new scrape should automatically refresh everything the dashboard
reads from.

---

## Decision

Auto-rescore at the end of every canary run, both the local CLI and
its Trigger.dev twin.

### Step 1 — consolidate the helper into `@gtmi/extraction`

ADR-021 left `scoreProgramFromDb` in `apps/web/lib/score-program.ts`,
explicitly noting that adding a third caller (the canary) would force
a different home. The third caller is now real, so the trade-off
flips:

- Move `apps/web/lib/score-program.ts` →
  `packages/extraction/src/utils/score-program.ts`. Identical code;
  just relocated.
- Re-export `scoreProgramFromDb` + `ScoreProgramOptions` +
  `ScoreProgramResult` from `@gtmi/extraction`.
- Update `apps/web/app/(internal)/review/rescore-actions.ts` to
  import from `@gtmi/extraction` instead of `@/lib/score-program`.
  Add `@gtmi/extraction` as a workspace dep on `@gtmi/web`.

`@gtmi/extraction` is the right home because the package already
depends on both `@gtmi/db` and `@gtmi/scoring`; placing the
orchestrator here is purely additive — no new dep direction. It also
sits next to `PublishStageImpl`, which already calls
`scoreSingleIndicator` at publish time — the per-programme score is
the natural next abstraction in the same package.

Other options considered and rejected:

- **Promote into `@gtmi/scoring`** — would make the package impure
  (gain `@gtmi/db` dep), losing the property that pure scoring
  functions could theoretically be bundled client-side later.
- **New `@gtmi/scoring-runtime` package** — overkill for ~200 lines
  of orchestration. Right answer if/when more "runtime" helpers (e.g.
  Trigger.dev wrappers) appear.

### Step 2 — `scripts/run-paq-score.ts` delegates

Closes the trade-off ADR-021 documented as accepted technical debt.
The CLI shrinks from ~270 lines to ~115; the deleted ~155 lines were
a verbatim duplicate of the helper's body. CLI argument parsing,
country-keyword fallback, and the console output shape (PAQ / CME /
Composite / coverage bars / pillar scores / Phase-2-placeholder
warning) all stay so existing analyst muscle memory + log-grep
recipes keep working. The `scores` row written is byte-identical.

### Step 3 — auto-rescore at end of canary

In `scripts/canary-run.ts`, after the per-target program loop's
summary table prints, the canary calls `scoreProgramFromDb(programId)`
inside a try/catch. On success an `[Auto-rescore]` log line records
the new composite / PAQ / CME / coverage / flagged-disclosure values.
On failure (typically: programme has zero approved rows after the
canary because every value queued for review) a warning logs and the
canary completes regardless.

`jobs/src/jobs/extract-single-program.ts` (the Trigger.dev twin) gets
the same call. Its `PipelineResult` interface gains a
`composite: {...} | null` field so consumers can read the new numbers
off the job result.

### Step 4 — cache busting

Not needed from the script callers. Every public route under
`apps/web/app/(public)/` already declares
`export const dynamic = 'force-dynamic'` (commit `bfe263c`), so each
request reads fresh from the DB once the canary's upsert lands.

The web button path (`rescoreProgram` / `rescoreCohort`) keeps its
explicit `revalidatePath('/')`, `/programs/[id]`, `/countries/[iso]`,
`/review` calls — those are needed because the web action runs inside
a Next.js request handler with its own ISR cache.

---

## Consequences

**Pros**

- Canary is now self-sufficient: scrape → extract → publish → score
  → done. Public dashboard reflects every fresh canary on the next
  page load, no analyst action required.
- One source of truth for "score one programme" across three callers
  (canary, manual button, calibration CLI). ADR-021's two-copy
  trade-off becomes one-copy.
- Trigger.dev parity preserved — the production pipeline behaves
  identically to the local CLI.

**Cons**

- Canary's wall-clock extends by ~50–100ms per programme (one engine
  call + one upsert). Negligible vs. the ~30s LLM extraction phase.
- If `runScoringEngine` ever throws on bad data shape mid-canary, the
  catch swallows it — analyst won't see the failure unless they read
  the log. Mitigation: the warn line is loud enough; if mis-tuning
  becomes a real problem, surface in the canary summary table.

---

## What stays in the analyst's hands

- The on-demand re-score buttons. They're the path for: (a)
  post-calibration param swaps that don't trigger a fresh canary,
  (b) edits via `editApprovedFieldValue` (already auto-rescores per
  Phase 3.7 / Step 4), (c) recovery when the canary's auto-rescore
  fails.
- `scripts/run-paq-score.ts` CLI — still useful for ad-hoc scoring of
  a single programme without a full canary scrape.

---

## Out of scope (deferred)

- Trigger.dev fallback for `rescoreCohort` (still in-process; only
  promote when cohort growth threatens the 60s timeout).
- Programme-level re-score button on `/review/[id]` (today the
  per-row button is one row, the cohort button is everything; "just
  this programme" sits between them).
- `methodologyVersionId` resolution (currently picks the first row).
  Add a `current_methodology_version` flag if multiple versions ever
  land.
