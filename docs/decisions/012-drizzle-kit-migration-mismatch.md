# 012: drizzle-kit migration mismatch and the apply-migration.ts pattern

**Status:** Accepted (acknowledged technical debt)
**Date:** 2026-04-27

## Context

While applying migration `00006_add_programs_fts.sql` for the Phase 4.2
full-text-search column, two intersecting failures surfaced.

**Failure 1 — DDL silently blocked on the transaction pooler.**
`DATABASE_URL` in `.env` points at the Supabase **transaction pooler**
on port 6543 (PgBouncer mode `transaction`). The pooler does not support
session-level state and silently misbehaves on DDL — `CREATE INDEX`,
`ALTER TABLE … ADD COLUMN`, and similar statements either hang or
no-op without surfacing an error. The original instruction to apply
the migration via `pnpm exec drizzle-kit migrate` (or via the older
`scripts/run-migration.ts`, which also reads `DATABASE_URL`) hangs
indefinitely against this URL.

**Fix:** introduce `DIRECT_URL` (port 5432, same host and credentials)
as the canonical channel for DDL. Both `packages/db/drizzle.config.ts`
and `scripts/apply-migration.ts` prefer `DIRECT_URL` and fall back to
`DATABASE_URL`. Cloud Run runtime still uses `DATABASE_URL` because
runtime queries are DML, not DDL.

**Failure 2 — drizzle-kit migrate is not the project's migration runner.**
Investigating the apparent hang revealed a deeper mismatch:

- `supabase/migrations/meta/_journal.json` lists exactly two entries
  (`0000_groovy_clea`, `0001_lyrical_dakota_north`) — auto-generated
  drizzle-kit names that do not correspond to any file currently on
  disk. The actual SQL files are `00001_core_schema.sql` through
  `00006_add_programs_fts.sql` — hand-numbered, hand-authored.
- `drizzle.__drizzle_migrations` does not exist on the live Supabase
  database. `scripts/check-drizzle-state.ts` confirms this: the only
  migration tables present are Supabase's own `auth.schema_migrations`,
  `realtime.schema_migrations`, and `storage.migrations`.
- This means `drizzle-kit migrate` has **never** successfully run
  against this database. The existing migrations were applied through
  ad-hoc means: most likely a mix of the Supabase web SQL editor,
  `scripts/run-migration.ts` (used `DATABASE_URL` and presumably worked
  when DDL through the pooler still went through, before the project
  switched pooler modes or hit the limit threshold), and direct `psql`
  against the project URL.

The journal file in this repository is therefore non-authoritative.
Running `drizzle-kit migrate` today either no-ops (nothing in the
journal matches files on disk, nothing applied) or, in a worst case,
tries to apply `0000_groovy_clea` against a database that already has
the schema and produces a confusing failure.

## Decision

For Phase 4 and the immediate term, **migrations are applied via
`scripts/apply-migration.ts`**. The `drizzle-kit migrate` command is
**not** used.

Concretely:

- `scripts/apply-migration.ts` reads a single migration filename as a
  CLI argument (omit or include the `.sql` extension), connects via
  `DIRECT_URL` (warning if it falls back to the 6543 pooler), executes
  the SQL inside a single `postgres.begin()` transaction, and prints
  per-statement progress plus a final commit/rollback line. Statement
  parsing matches `scripts/run-migration.ts` (split on `;`, drop comment
  - `statement-breakpoint` lines) so existing migration files are
    byte-compatible with both runners.
- `scripts/check-fts-column.ts` and `scripts/check-drizzle-state.ts`
  serve as read-only verifiers — applied any time a migration touches
  schema-visible state, called out in commit messages as the proof.
- `scripts/run-migration.ts` (older, uses `DATABASE_URL`) is left
  in place but should be considered **deprecated**. It still works
  for the historical multi-file "run all" flow that existed before
  this ADR but new migrations should be applied one-by-one via
  `apply-migration.ts`.
- The drizzle journal at `supabase/migrations/meta/_journal.json` is
  **not maintained** for now. Future `drizzle-kit generate` runs may
  rewrite it; that is fine — the journal is no longer load-bearing.

## Consequences

**Upside:**

- Migrations are reliably applied today, with transactional rollback
  semantics, port-aware connection routing (5432 for DDL, 6543 for
  runtime), and a verifier script per migration that proves the
  schema change landed.
- The team no longer needs to know about Supabase pooler internals or
  drizzle-kit internals to ship a migration — one CLI invocation does
  it.
- The diagnostic scripts make it trivially debuggable when something
  doesn't apply: `check-drizzle-state.ts` shows tracking state,
  `check-fts-column.ts` (or its analogue) shows the actual schema.

**Downside / risks accepted:**

- **No automated migration tracking.** The team must remember to run
  `apply-migration.ts` against staging and production before deploying
  code that depends on the schema change. There is no `drizzle-kit
migrate`-style "apply every pending migration" guarantee. The
  per-deploy checklist must include this step.
- **CI does not yet apply migrations automatically.** Phase 4 CI runs
  `pnpm test` + `pnpm typecheck`; it does not run `apply-migration.ts`
  against any database. Schema drift between code and DB will surface
  at runtime (e.g. the `column does not exist` error we hit on
  `?q=482` before applying 00006).
- **Re-applying a migration is not idempotent across the board.** The
  apply script wraps in a transaction but does not consult any
  `__migrations` table. Running the same migration twice on the same
  DB will fail (the second `ALTER TABLE … ADD COLUMN` will throw),
  which is a fail-loud behaviour but requires a human to recognise it.

## Remediation (tracked separately, not blocking Phase 4)

A future session should pick one of:

1. **Re-adopt `drizzle-kit migrate` as the canonical runner.** Requires
   regenerating the migration files via `drizzle-kit generate` to
   match the journal naming convention, or rewriting the journal to
   reference the existing hand-numbered files. Either path is
   non-trivial because the existing files contain RLS + GENERATED
   COLUMN constructs that drizzle-kit has historically had trouble
   with (the original reason `scripts/run-migration.ts` exists,
   per its header comment).

2. **Formalise `scripts/apply-migration.ts` with a custom tracking
   table** — e.g. `gtmi_migrations(filename, applied_at, applied_by,
sha256)`. The script consults it before running and refuses to
   re-apply a file with the same SHA. This is a small lift (~2h)
   and gives drizzle-kit-equivalent guarantees without the
   journal-mismatch problem.

3. **Keep the manual flow indefinitely** if the migration cadence
   stays low enough that operational discipline beats tooling.
   Acceptable for a 6-developer team applying ~1 migration per
   month; not acceptable once the team grows or the cadence
   accelerates.

This ADR does not pick between these — it acknowledges the debt and
formalises the current pattern. A follow-up ADR raised when the
remediation is scheduled should record the choice.

## Related

- ADR-001 — RLS v1 placeholder auth (uses `authenticated` role; the
  hand-numbered migrations encode this).
- ADR-011 — Postgres FTS over external search service (this is the
  ADR whose migration tripped over the issue documented here).
- `scripts/run-migration.ts` — the older, deprecated runner.
- `scripts/apply-migration.ts` — the formalised runner this ADR
  introduces.
- `scripts/check-fts-column.ts` and `scripts/check-drizzle-state.ts`
  — read-only verifiers.
