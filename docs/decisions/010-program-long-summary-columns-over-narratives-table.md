# 010: Editorial "What this means" summary on the programs table, not a separate program_narratives table

**Status:** Accepted
**Date:** 2026-04-27

## Context

The Phase 4.3 program detail page surfaces an editorial "What this
means" panel beside the indicator drilldown. The text is a 200–300 word
analyst-written body — not a marketing blurb, not auto-generated copy
— that contextualises a program's score for a sovereign-client reader.

Two storage shapes were considered:

1. **Columns on `programs`** (this ADR):
   - `long_summary_md text`
   - `long_summary_updated_at timestamp`
   - `long_summary_reviewer uuid` → `auth.users(id)`

2. **A separate `program_narratives` table**:
   - `(program_id, language, body_md, version, reviewed_by, reviewed_at)`
   - Compound key on `(program_id, language, version)` so the same
     program can carry English / Mandarin / Arabic summaries side by
     side and a published narrative can be versioned.

## Decision

Go with shape (1) — three columns directly on `programs`. Migration
shipped as `supabase/migrations/00007_add_programs_long_summary.sql`.

## Consequences

**Upside:**

- Zero new join. The program detail query already SELECTs from
  `programs` for name/category/status/description; the summary fields
  arrive in the same row at no measurable cost. Phase 4.3
  `lib/queries/program-detail.ts` is simpler — no second LATERAL or
  conditional JOIN.
- RLS inherits. `programs` already has a public-read policy that the
  Phase 2 review UI relies on; the three new columns are covered
  automatically without a separate grant.
- The "Summary forthcoming" placeholder is data-driven — when
  `long_summary_md IS NULL` or contains only whitespace, the panel
  renders the placeholder. No application-state distinction between
  "not yet written" and "not yet seeded".
- Editorial workflow is straightforward — Szabi writes the AUS and
  SGP narratives during Phase 4.3 / 4.5, Ayush or another reviewer
  sets `long_summary_reviewer` to their `auth.users.id` on approve,
  and `long_summary_updated_at` is bumped on every edit.

**Downside / risks accepted:**

- **No multilingual support today.** A future "translate the AUS
  narrative to Mandarin for the Singapore-based audience" requirement
  would need a schema change. Acceptable for Phase 4 — the editorial
  audience is English-speaking institutional readers.
- **No published-version history.** When an analyst edits the
  narrative, the previous body is overwritten. If we ever need
  diff-able narrative history (for example to compare what we said
  about a program before and after a policy change), this shape
  cannot serve it; we'd need to either move to (2) or layer an
  audit-log table on top.
- **Reviewer column duplicates a pattern.** `field_values.reviewed_by`
  also references `auth.users(id)`; we now have two columns on two
  tables doing the same thing. Tolerable today; if it becomes three
  or more we should extract a generic "approved-by" pattern.

## Promotion conditions to a `program_narratives` table

A future ADR should promote to shape (2) if any of these fire:

- A second language ships (or is committed to ship within the next
  release cycle).
- We start tracking narrative versions for the public methodology
  page or a "what changed in this analyst's view" feature.
- More than one team member writes narratives concurrently and edit
  conflicts become a coordination cost.
- We begin storing narratives outside the program scope (e.g. country
  narratives, methodology narratives) — at that point a polymorphic
  narratives table becomes the obvious shape.

Until any of those fires, the columns on `programs` carry the
feature.

## Related

- ADR-001 — RLS v1 placeholder auth (the public-read policy on
  `programs` covers these new columns by extension).
- ADR-007 — provenance record extended (the editorial summary is
  out-of-band from indicator provenance — reviewer + updated_at
  timestamp are the only "provenance" tracked here).
- ADR-012 — drizzle-kit migration mismatch (migration 00007 is
  applied via `scripts/apply-migration.ts`, not `drizzle-kit
migrate`).
