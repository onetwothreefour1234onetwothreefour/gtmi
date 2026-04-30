-- 00014_phase_3_9_archive_attempts_prompts.sql
--
-- Phase 3.9 — permanent scrape archive + extraction history + prompt
-- versioning. Foundation for the coverage workstreams (PR B/C/D/E):
-- self-improving URL ranking, surgical re-runs, archive-first re-runs,
-- provenance fallback.
--
-- This migration is SCHEMA-ONLY plus a one-shot prompt-v1 backfill. It
-- does not move any field_values data — a separate script
-- (scripts/backfill-extraction-attempts.ts) replays existing winners
-- into the new extraction_attempts table and is run AFTER deploy.
--
-- (a) ALTER scrape_history: extend the existing (currently unused)
--     table with the columns the archive writer needs. The original
--     `raw_markdown_storage_path` column stays for backward compat;
--     `storage_path` is the canonical column going forward.
--
-- (b) ALTER field_values: add `archive_path` so /review and the
--     public detail drawer can link to the GCS snapshot if the live
--     URL goes dark (W7 provenance fallback).
--
-- (c) CREATE extraction_models: small registry of model_id ↔ version_tag
--     so attempts can be tagged with the model that produced them.
--     Backfilled with claude-sonnet-4-6 + the synthetic markers used
--     by direct-API and derive paths.
--
-- (d) CREATE extraction_prompts: versioned prompt content per
--     field_definition. Each insert hashes prompt_md so duplicate
--     content does not create a new version row.
--
-- (e) ALTER field_definitions: add `current_prompt_id` FK so
--     extract.ts can look up the active prompt without a string
--     comparison. Backfilled in step (h).
--
-- (f) CREATE extraction_attempts: append-only history of every
--     extraction attempt, every (program × field × URL × run × prompt)
--     tuple. Never overwritten by re-runs. The current field_values
--     row's "winning" attempt is identified by was_published = true.
--
-- (g) CREATE MATERIALIZED VIEW field_url_yield: aggregated yield
--     statistics per (URL, field) for self-improving URL ranking
--     (W10). Distinct from the existing `field_url_index` view from
--     migration 00012 (which projects only the current published
--     winner; this view aggregates ALL historical attempts).
--
-- (h) BACKFILL: insert one prompt-v1 row per field_definition with
--     the current extraction_prompt_md content; set current_prompt_id
--     on each field_definition row.
--
-- RLS: every new table gets a "team can write" + (where read access is
-- needed publicly) a "public read" policy mirroring the existing
-- patterns in schema.ts. extraction_attempts is service-role only —
-- public reads happen via field_values (its winning row) or via the
-- field_url_yield materialized view.
--
-- Reversible:
--   DROP MATERIALIZED VIEW field_url_yield;
--   DROP TABLE extraction_attempts;
--   ALTER TABLE field_definitions DROP COLUMN current_prompt_id;
--   DROP TABLE extraction_prompts;
--   DROP TABLE extraction_models;
--   ALTER TABLE field_values DROP COLUMN archive_path;
--   ALTER TABLE scrape_history DROP COLUMN ...

-- pgcrypto provides digest() for the prompt-v1 backfill. Supabase
-- enables it by default but the explicit CREATE EXTENSION makes the
-- migration self-contained on a fresh Postgres.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

-- (a) scrape_history columns
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "storage_path" TEXT;
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "byte_size" INTEGER;
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(100);
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "language_detected" VARCHAR(8);
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "translation_path" TEXT;
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "translation_version" VARCHAR(32);
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "extractor_version" VARCHAR(32);
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "fields_extracted" JSONB;
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "needs_reextraction" BOOLEAN NOT NULL DEFAULT FALSE;
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "superseded_by" UUID REFERENCES "scrape_history"("id");
--> statement-breakpoint
ALTER TABLE "scrape_history" ADD COLUMN IF NOT EXISTS "request_headers" JSONB;
--> statement-breakpoint

-- Index for "latest archive entry by URL" lookup. We need source_id
-- + scraped_at DESC because reextract-actions resolves URL → source_id
-- → newest archive row.
CREATE INDEX IF NOT EXISTS "idx_scrape_history_source_scraped_storage" ON "scrape_history" ("source_id", "scraped_at" DESC) WHERE "storage_path" IS NOT NULL;
--> statement-breakpoint

-- Optional FTS index on extracted markdown when present in storage_path.
-- We do not store the markdown in the row (storage is GCS) so the FTS
-- column is not auto-generated; PR B/C add a tsvector column populated
-- from the extracted markdown when a copy is materialized for search.

-- (b) field_values.archive_path
ALTER TABLE "field_values" ADD COLUMN IF NOT EXISTS "archive_path" TEXT;
--> statement-breakpoint

-- (c) extraction_models registry
CREATE TABLE IF NOT EXISTS "extraction_models" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "model_id" TEXT NOT NULL,
  "version_tag" VARCHAR(50) NOT NULL,
  "registered_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "retired_at" TIMESTAMPTZ NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_extraction_models_model_version" ON "extraction_models" ("model_id", "version_tag");
--> statement-breakpoint

ALTER TABLE "extraction_models" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write extraction_models" ON "extraction_models" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read extraction_models" ON "extraction_models" AS PERMISSIVE FOR SELECT TO public USING (true);
--> statement-breakpoint

-- Seed the registry with the models currently used by the pipeline.
INSERT INTO "extraction_models" ("model_id", "version_tag")
VALUES
  ('claude-sonnet-4-6', 'v1'),
  ('world-bank-api-direct', 'v1'),
  ('v-dem-api-direct', 'v1'),
  ('country-substitute-regional', 'v1'),
  ('derived-computation', 'v1'),
  ('derived-knowledge', 'v1')
ON CONFLICT ("model_id", "version_tag") DO NOTHING;
--> statement-breakpoint

-- (d) extraction_prompts
CREATE TABLE IF NOT EXISTS "extraction_prompts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "field_definition_id" UUID NOT NULL REFERENCES "field_definitions"("id"),
  "version_tag" VARCHAR(50) NOT NULL,
  "prompt_md" TEXT NOT NULL,
  "prompt_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "replaced_at" TIMESTAMPTZ NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_extraction_prompts_field_hash" ON "extraction_prompts" ("field_definition_id", "prompt_hash");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_extraction_prompts_field_created" ON "extraction_prompts" ("field_definition_id", "created_at" DESC);
--> statement-breakpoint

ALTER TABLE "extraction_prompts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write extraction_prompts" ON "extraction_prompts" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read extraction_prompts" ON "extraction_prompts" AS PERMISSIVE FOR SELECT TO public USING (true);
--> statement-breakpoint

-- (e) field_definitions.current_prompt_id
ALTER TABLE "field_definitions" ADD COLUMN IF NOT EXISTS "current_prompt_id" UUID REFERENCES "extraction_prompts"("id");
--> statement-breakpoint

-- (f) extraction_attempts
CREATE TABLE IF NOT EXISTS "extraction_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "programs"("id"),
  "field_definition_id" UUID NOT NULL REFERENCES "field_definitions"("id"),
  "source_url" TEXT NOT NULL,
  "scrape_history_id" UUID NULL REFERENCES "scrape_history"("id"),
  "content_hash" TEXT,
  "attempted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "value_raw" TEXT NULL,
  "source_sentence" TEXT NULL,
  "character_offsets" JSONB NULL,
  "extraction_model" TEXT NOT NULL,
  "extraction_prompt_id" UUID NULL REFERENCES "extraction_prompts"("id"),
  "extraction_confidence" DECIMAL(3,2) NULL,
  "validation_confidence" DECIMAL(3,2) NULL,
  "was_published" BOOLEAN NOT NULL DEFAULT FALSE,
  "superseded_by" UUID NULL REFERENCES "extraction_attempts"("id"),
  "gate_verdict" VARCHAR(64) NULL,
  "reextract_reject_reason" TEXT NULL,
  "notes" JSONB NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_extraction_attempts_prog_field_attempted" ON "extraction_attempts" ("program_id", "field_definition_id", "attempted_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_extraction_attempts_url_field" ON "extraction_attempts" ("source_url", "field_definition_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_extraction_attempts_published" ON "extraction_attempts" ("program_id", "field_definition_id") WHERE "was_published" = TRUE;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_extraction_attempts_scrape_history" ON "extraction_attempts" ("scrape_history_id") WHERE "scrape_history_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "extraction_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write extraction_attempts" ON "extraction_attempts" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

-- (g) field_url_yield materialized view
-- Aggregates ALL historical extraction attempts per (source_url, field_definition_id).
-- Differs from `field_url_index` (migration 00012) which projects only
-- the currently published winner from `field_values`.
CREATE MATERIALIZED VIEW IF NOT EXISTS "field_url_yield" AS
SELECT
  ea.source_url,
  ea.field_definition_id,
  fd.key AS field_key,
  COUNT(*)::int AS attempts_total,
  COUNT(*) FILTER (WHERE ea.value_raw IS NOT NULL AND ea.value_raw <> '')::int AS attempts_yielded,
  COUNT(*) FILTER (WHERE ea.was_published = TRUE)::int AS attempts_published,
  AVG(ea.extraction_confidence) FILTER (WHERE ea.value_raw IS NOT NULL AND ea.value_raw <> '') AS mean_confidence,
  MAX(ea.attempted_at) AS last_attempted_at,
  bool_or(ea.was_published) AS ever_published,
  bool_or(ea.gate_verdict IS NULL OR ea.gate_verdict = 'passed') AS ever_passed_gate
FROM "extraction_attempts" ea
JOIN "field_definitions" fd ON fd.id = ea.field_definition_id
GROUP BY ea.source_url, ea.field_definition_id, fd.key;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_field_url_yield_url_field" ON "field_url_yield" ("source_url", "field_definition_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_field_url_yield_field_yield" ON "field_url_yield" ("field_definition_id", "attempts_yielded" DESC);
--> statement-breakpoint

COMMENT ON MATERIALIZED VIEW "field_url_yield" IS 'Phase 3.9 — aggregated yield statistics per (URL, field) for self-improving URL ranking. REFRESH after each canary completion.';
--> statement-breakpoint

-- (h) Backfill: prompt-v1 row per field_definition + current_prompt_id wire
WITH inserted AS (
  INSERT INTO "extraction_prompts" ("field_definition_id", "version_tag", "prompt_md", "prompt_hash")
  SELECT
    fd.id,
    'v1',
    fd.extraction_prompt_md,
    encode(digest(fd.extraction_prompt_md, 'sha256'), 'hex')
  FROM "field_definitions" fd
  WHERE fd.extraction_prompt_md IS NOT NULL AND fd.extraction_prompt_md <> ''
  ON CONFLICT ("field_definition_id", "prompt_hash") DO NOTHING
  RETURNING "id", "field_definition_id"
)
UPDATE "field_definitions" fd
SET "current_prompt_id" = inserted.id
FROM inserted
WHERE fd.id = inserted.field_definition_id
  AND fd.current_prompt_id IS NULL;
--> statement-breakpoint

-- For any field_definition where the backfill INSERT collided with an
-- existing row (re-runs), still set current_prompt_id to the existing
-- prompt-v1 row.
UPDATE "field_definitions" fd
SET "current_prompt_id" = ep.id
FROM "extraction_prompts" ep
WHERE ep.field_definition_id = fd.id
  AND ep.version_tag = 'v1'
  AND fd.current_prompt_id IS NULL;
