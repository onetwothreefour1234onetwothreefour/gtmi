# ADR-020 — Bulk-approve-all + on-demand re-score buttons

**Status:** Implemented (Phase 3.8 — review-tab improvements II).
**Date:** 2026-04-30
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

Two analyst pain-points after Phase 3.7 shipped:

1. **`bulkApproveHighConfidence`** filters by extractionConfidence ≥ 0.85
   AND validationConfidence ≥ 0.85 AND the ADR-019 categorical-rubric
   gate. Useful for the easy 80%, but borderline rows the analyst has
   already eyeballed have to be approved one at a time.
2. **`value_indicator_score`** is set at publish time (Phase 3.7 / Step 2)
   and recomputed on `editApprovedFieldValue`, but there is no in-app
   way to refresh it after a calibration commit changes the
   normalisation parameters. The only path was the standalone
   `scripts/backfill-value-indicator-scores.ts` script.

---

## Decision

Two new server actions and three UI buttons. All gated behind
confirmation dialogs that surface exactly what's being relaxed
(bulk-approve-all) or what's being recomputed (re-score).

### 1. `bulkApproveAllPending` server action + `<BulkApproveAllDialog>`

`apps/web/app/(internal)/review/actions.ts` — new exported function
that mirrors `bulkApproveHighConfidence` minus the confidence /
isValid filters. The categorical-rubric `EXISTS` clause stays; methodology
integrity is non-negotiable. Wrapped in a single transaction
(field_values + review_queue updates).

`<BulkApproveAllDialog>` — distinct trigger ("Approve ALL pending"),
amber `--warning` styling so it doesn't read like the existing high-
confidence button. Confirmation copy explicitly names the gate that's
being skipped and confirms the rubric gate stays on.

### 2. `rescoreFieldValue` + per-row button

`apps/web/app/(internal)/review/rescore-actions.ts` — new file
(separate from `actions.ts` so the file's purpose stays clear:
rescore-only, no status mutations).

`rescoreFieldValue(id)` reads the row's `value_normalized` + the field
definition, calls `scoreSingleIndicator` with current
`PHASE2_PLACEHOLDER_PARAMS`, persists the result. Returns
`{ score: number | null }`. Failures are non-fatal — log + persist
NULL.

UI: a paper-2 strip below the decision section on `/review/[id]` with
an eyebrow ("Re-score this row") and a short explanation of WHEN to
use it (post-calibration, or to refresh a stale display).

### 3. `rescoreProgram` + `rescoreCohort` + `<RescoreCohortDialog>`

`rescoreProgram(programId)` reads every approved + pending row in one
programme and rewrites their scores in a single transaction. Returns
`{ rowsRescored, rowsSkipped, programName }`. Rows with `value_normalized = NULL`
(legitimate FIX-1 not-applicable derives) are correctly skipped.

`rescoreCohort()` iterates `rescoreProgram` per programme so each
programme commits independently — a single failure doesn't roll back
the rest. Logs per-programme counts. ~30-60s in steady state at 30-
country scale.

`<RescoreCohortDialog>` — wired into the queue header. The dialog
warns about the duration, clarifies that programme-level composite
scores in the `scores` table are NOT touched (that still requires
`run-paq-score.ts` per country), and shows a `Re-scoring…` pending
state on the confirm button to mitigate double-clicks during the
in-flight wait.

### Out of scope (deferred)

- **Programme-level composite refresh.** The new re-score actions
  rewrite `field_values.value_indicator_score` only. The `scores`
  table refresh still requires `scripts/run-paq-score.ts`. Splitting
  the two concerns keeps the in-Cloud-Run request inside the 60s
  timeout budget; the composite refresh becomes a separate Trigger.dev
  job if/when daily refresh is wanted.
- **Trigger.dev fallback for `rescoreCohort`.** First implementation
  is in-process. Promote when cohort size makes the in-process
  variant unsafe; today's ~30 programmes × <50ms each = ~1.5s steady
  state, well inside the timeout.
- **By-country / by-programme filters on bulk-approve-all.** Could
  add a dropdown for "approve all pending in CAN" later. Not blocking;
  the analyst can already filter the queue by URL state and approve
  per-row.

---

## Consequences

**Pros**

- Analysts can clear borderline rows after spot-checking without
  approving one row at a time.
- Score column stays trustworthy across calibration commits — one
  click refreshes every row.
- All three re-score scopes share `scoreSingleIndicator` and
  `PHASE2_PLACEHOLDER_PARAMS`, so behaviour is identical to publish-
  time scoring (no semantic drift).

**Cons**

- Bulk-approve-all could approve garbage at scale. Mitigated by the
  amber warning button + confirmation dialog + the surviving rubric
  gate + ADR-017 `editApprovedFieldValue`/`unapproveFieldValue`
  recovery paths.
- `rescoreCohort` runs synchronously within a Cloud Run request
  (60s timeout). Acceptable today; flagged for follow-up if breached.

---

## Test coverage

- 4 new `<BulkApproveAllDialog>` tests (trigger / disabled / cancel /
  confirm).
- 3 new `<RescoreCohortDialog>` tests (trigger + dialog content /
  cancel / confirm).
- `scoreSingleIndicator` already covered by 13 tests in Phase 3.7
  Step 0; the re-score actions wrap it without changing semantics.
- `rescoreFieldValue` and `rescoreProgram` are integration-only
  (live DB); manual smoke from `/review/[id]` and the cohort
  dialog will validate at deploy time.

295 web tests + 224 extraction tests + 9 scoring test files green;
7/7 typecheck targets pass.
