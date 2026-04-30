# ADR-021 — Composite-score refresh in the rescore button

**Status:** Implemented (Phase 3.8 — review-tab improvements II, follow-up to ADR-020).
**Date:** 2026-04-30
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

ADR-020 shipped two re-score scopes — single row, single programme,
cohort. All three rewrote `field_values.value_indicator_score` only.
The `scores` table (composite + PAQ + CME + per-pillar +
sub-factor) was explicitly out of scope, with a callout to re-run
`scripts/run-paq-score.ts` per country to refresh it.

Live verification on 2026-04-30 surfaced the gap: after the analyst
clicked "Re-score cohort", the public dashboard kept rendering the
pre-edit composite (S Pass `19.92`, pillars B = `0.00`, D = `0.00`)
because the `scores` row hadn't been touched. The deferral was the
wrong call — the analyst expects the button to refresh everything
the dashboard reads from.

---

## Decision

Wire the existing scoring orchestration (today inlined in
`scripts/run-paq-score.ts`) into the rescore actions so the
programme- and cohort-level buttons refresh both per-row scores AND
the `scores` row in a single click.

### `apps/web/lib/score-program.ts` — new server-side orchestrator

`scoreProgramFromDb(programId, options?)` runs the full scoring
pipeline for one programme:

1. Resolve programme + country.
2. Pick the current methodology version (first row — same heuristic
   the legacy CLI uses).
3. Read CME from `countries.imdAppealScoreCmeNormalized` (default 0
   when missing — matches CLI behaviour).
4. Load every approved `field_values` row for the programme.
5. Load every `field_definitions` row.
6. Build a `ScoringInput` with `PHASE2_PLACEHOLDER_PARAMS` and
   `ACTIVE_FIELD_CODES` (both promoted to `@gtmi/scoring` in the
   prior commit).
7. Call `runScoringEngine`.
8. Upsert into `scores` (`onConflictDoUpdate` keyed on
   `programId × methodologyVersionId`).

Returns the engine output + the upserted row id. Throws when the
programme has no approved rows (caller decides whether that's
recoverable).

### `rescoreProgram` and `rescoreCohort` wiring

`rescoreProgram(programId)` now calls `scoreProgramFromDb` after the
per-row score refresh. The composite call is wrapped in a try/catch
so a programme without approved rows still gets per-row writes.
Returns a new `composite` block on the result so the UI / logs can
confirm the composite landed.

`rescoreCohort()` tracks `compositesRefreshed` independently from
`programsRescored` so the analyst can verify both planes were
refreshed. Per-programme isolation is preserved — a single
composite-write failure doesn't block the rest.

### Dialog copy update

`<RescoreCohortDialog>` description loses the now-untrue caveat
about composite scores not being touched. Replaced with explicit
confirmation that the composite + per-pillar refresh use the same
`runScoringEngine` path the CLI uses, plus the Cloud-Run-timeout
fallback note.

### Cache busting

`revalidatePath` calls cover `/`, `/programs/[id]`,
`/countries/[iso]`, and `/review` so the leaderboard, programme
detail, country radar, and review queue all re-render with the new
numbers on the next request.

---

## Trade-off — `scripts/run-paq-score.ts` not refactored

The plan originally proposed dedup'ing the orchestration so the CLI
would delegate to `scoreProgramFromDb`. Implementing that requires
the helper to be importable from the `scripts/` workspace, which has
two paths:

1. Move the helper into `@gtmi/scoring` and add a `@gtmi/db` import
   there. Breaks the package's purity contract — every consumer of
   `@gtmi/scoring` would suddenly carry a transitive Drizzle / pg
   dep, including any future client-side bundle that imports the
   pure scoring functions.
2. Create a new package (`@gtmi/orchestration`?) for the single
   helper. Overkill for ~80 lines.

Both costs outweigh the benefit. Decision: **keep the helper in
`apps/web/lib/score-program.ts`, leave `scripts/run-paq-score.ts`
inlined.** The CLI and the web button share the actual scoring
logic (`runScoringEngine` + `PHASE2_PLACEHOLDER_PARAMS`); the
duplicated piece is just the DB I/O around it. If a third caller
ever needs the same orchestration, that's the moment to revisit
the package split.

---

## Consequences

**Pros**

- One click on `/review` now refreshes everything the public
  dashboard reads from, in the order the analyst expects.
- The composite refresh adds `~one upsert + a pure-arithmetic engine
call per programme`; well inside the Cloud Run 60s budget at
  30-country scale.
- `scoreProgramFromDb` is a single source of truth for "score one
  programme" inside the web app — `editApprovedFieldValue` can
  optionally invoke it on each edit in a future commit if that
  becomes desirable.

**Cons**

- Orchestration logic exists in two places (`scoreProgramFromDb` +
  `run-paq-score.ts`'s inline version). If methodology-version
  resolution or CME lookup ever changes, both places need the edit.
  Mitigated by tagging the trade-off explicitly in the helper's
  module comment.

---

## Out of scope (deferred)

- Trigger.dev fallback for `rescoreCohort` (still in-process; only
  promote when cohort growth threatens the 60s timeout).
- Programme-level re-score button on `/review/[id]`. Today the
  per-row button refreshes one row + the cohort button refreshes
  everything; "just this programme" sits between them. Add when
  analyst friction surfaces.
- `methodologyVersionId` resolution (currently picks the first row).
  Add a `current_methodology_version` flag if multiple versions
  ever land.
