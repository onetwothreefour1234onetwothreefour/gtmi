# 011: Postgres FTS over an external search service for the Phase 4 dashboard

**Status:** Accepted
**Date:** 2026-04-27

## Context

The Phase 4 public dashboard (`apps/web`) needs free-text search over the program catalogue: a user lands on `/` or `/programs` and types "Australia 482" or "digital nomad" or "S Pass" into the filter bar, and the rankings table narrows accordingly. The corpus is small — 85 programs at full Phase 6 scale, 25 in the Phase 3 pilot — and changes infrequently (program additions are weeks-apart events; description edits are rarer still).

Three search backends were considered:

1. **Postgres full-text search via a generated `tsvector` column + GIN index** (this ADR).
2. **Algolia** — managed search-as-a-service, in-memory, very low query latency, generous free tier.
3. **Typesense** — open-source alternative, self-hostable on Cloud Run.

## Decision

Use Postgres FTS for Phase 4. Implementation: a `search_tsv` `tsvector` column on `programs`, generated at write time from `setweight(to_tsvector('english', name), 'A') || setweight(to_tsvector('english', description_md), 'B')`, indexed with GIN. Migration ships as `supabase/migrations/00006_add_programs_fts.sql`.

The query layer (`apps/web/lib/queries/search.ts`) issues `to_tsquery`/`plainto_tsquery` calls against the generated column and ranks with `ts_rank`.

## Consequences

**Upside:**

- Zero external dependency — no Algolia API key, no Typesense container, no GCS asset workflow, no provider-specific SDK to bundle into the Cloud Run image.
- The corpus is small enough that GIN-indexed FTS over 85 rows will round-trip in single-digit milliseconds. Postgres search latency only becomes a concern in the tens-of-thousands-of-rows range that we are years away from.
- Same RLS policy boundary as the rest of the schema. Search results inherit the public-read policy on `programs` — no separate authorisation surface to maintain.
- Updates are atomic. The `STORED` generated column updates inside the same write transaction as the row, so there is no eventual-consistency window where the search index disagrees with the canonical row. Algolia and Typesense both impose async-index latency on writes.
- Cost: free. Algolia's free tier (10k records / 10k searches per month) would cover the pilot but creates a billing-tier cliff at the 85-program / public-launch milestone.

**Downside / risks accepted:**

- We give up Algolia's typo tolerance, synonyms, prefix-search-with-highlights, and analytics dashboard. For Phase 4 these are nice-to-haves, not requirements — the editorial design language explicitly avoids "type-ahead" UX in favour of explicit filters.
- Rank quality is good but not state-of-the-art. `ts_rank` weighting via `setweight` (name = A, description_md = B) is sufficient for an 85-program list where exact name match is the common case.
- If we later want fuzzy matching (e.g. "Sing apore" → Singapore) we will need to add `pg_trgm` or revisit the decision. The migration is self-contained — adding `pg_trgm` later is additive, not breaking.
- Drizzle does not yet support `GENERATED ALWAYS` columns or `tsvector` through its DSL. The migration is hand-authored SQL, and the Drizzle schema exposes the column as a read-only `text` field. Runtime never writes to it; the database does.

## Revisit conditions

- Corpus crosses ~10k programs (improbable; we cap at 85 through Phase 6).
- Phase 5+ adds long-form policy-change content that benefits from typo tolerance or fuzzy matching at scale.
- A user research finding indicates that explicit filters + Postgres FTS produces an unacceptably narrow result set for the editorial use case.

If any of those triggers fire, raise a follow-on ADR proposing the migration target.
