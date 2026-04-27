-- 00006_add_programs_fts.sql
--
-- Phase 4.2: full-text search on programs.
-- Adds a generated tsvector column over name + description_md and a GIN
-- index. Replaces a future external search service (Algolia/Typesense)
-- — see ADR-011 for the rationale.
--
-- Drizzle does not yet support GENERATED ALWAYS columns or tsvector via
-- its DSL, so this migration is hand-authored SQL rather than emitted
-- from `drizzle-kit generate`. The Drizzle schema in
-- `packages/db/src/schema.ts` exposes the column as a read-only `text`
-- field for query construction; runtime never writes to it.

-- Generated column: lexemes for name (weight A) and description_md (weight B).
-- COALESCE on description_md so rows with NULL descriptions still index name only.
ALTER TABLE "programs"
  ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description_md", '')), 'B')
  ) STORED;

--> statement-breakpoint

-- GIN index on the generated column.
CREATE INDEX IF NOT EXISTS "idx_programs_search_tsv"
  ON "programs" USING GIN ("search_tsv");
