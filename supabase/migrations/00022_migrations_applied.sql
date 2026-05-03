-- 00022_migrations_applied.sql
--
-- Long-standing tech debt cleanup: ADR-012 documented that
-- drizzle-kit migrate is not the canonical runner here, and the
-- drizzle.__drizzle_migrations journal does not exist. Migrations
-- are applied via scripts/apply-migration.ts. This migration adds a
-- lightweight `migrations_applied` table that apply-migration.ts
-- writes to on every successful apply, giving us a real audit trail
-- of what's been applied vs what's on disk.
--
-- Deliberately NOT named `__drizzle_migrations` — that namespace
-- belongs to drizzle-kit and we don't want to confuse a future
-- maintainer who tries to run `drizzle-kit migrate` and discovers
-- a journal that wasn't built by the tool.

CREATE TABLE IF NOT EXISTS "migrations_applied" (
  "filename" TEXT PRIMARY KEY,
  "applied_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "applied_by" TEXT,
  "checksum_sha256" TEXT
);
--> statement-breakpoint

COMMENT ON COLUMN "migrations_applied"."applied_by" IS
  'Free-form identity of the operator who applied the migration. Populated from $USER (or git config user.email when available) by apply-migration.ts.';
--> statement-breakpoint

COMMENT ON COLUMN "migrations_applied"."checksum_sha256" IS
  'SHA-256 of the SQL file contents at apply time. Lets future tooling detect drift between the journaled apply and the on-disk file.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_migrations_applied_at" ON "migrations_applied" ("applied_at" DESC);
--> statement-breakpoint

ALTER TABLE "migrations_applied" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write migrations_applied" ON "migrations_applied" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read migrations_applied" ON "migrations_applied" AS PERMISSIVE FOR SELECT TO public USING (true);

-- Phase 3.10d.A.1 — backfill rows for every migration committed
-- to supabase/migrations through 00022 itself. The applied_at is
-- set to NOW() on backfill (we don't have the historical apply time).
-- The checksum is left NULL — it will be recomputed by
-- apply-migration.ts on the next live apply if a re-apply ever
-- happens.

INSERT INTO "migrations_applied" ("filename", "applied_at", "applied_by") VALUES
  ('00001_core_schema.sql', NOW(), 'backfill'),
  ('00002_add_news_sources.sql', NOW(), 'backfill'),
  ('00003_update_imd_appeal_scores.sql', NOW(), 'backfill'),
  ('00004_extraction_caches.sql', NOW(), 'backfill'),
  ('00005_extraction_models.sql', NOW(), 'backfill'),
  ('00006_add_programs_fts.sql', NOW(), 'backfill'),
  ('00007_add_programs_long_summary.sql', NOW(), 'backfill'),
  ('00008_add_validation_cache.sql', NOW(), 'backfill'),
  ('00009_add_methodology_v2.sql', NOW(), 'backfill'),
  ('00010_phase_3_6_methodology_v2.sql', NOW(), 'backfill'),
  ('00011_add_crosscheck_cache.sql', NOW(), 'backfill'),
  ('00012_field_url_index_view.sql', NOW(), 'backfill'),
  ('00013_phase_3_8_value_indicator_score_default.sql', NOW(), 'backfill'),
  ('00014_phase_3_9_archive_attempts_prompts.sql', NOW(), 'backfill'),
  ('00015_phase_3_9_translation_cache.sql', NOW(), 'backfill'),
  ('00016_phase_3_9_discovery_telemetry.sql', NOW(), 'backfill'),
  ('00017_phase_3_9_blocker_domains.sql', NOW(), 'backfill'),
  ('00018_sensitivity_runs.sql', NOW(), 'backfill'),
  ('00019_score_history.sql', NOW(), 'backfill'),
  ('00020_review_assigned_at.sql', NOW(), 'backfill'),
  ('00021_news_signals_phase_3_10c5.sql', NOW(), 'backfill'),
  ('00022_migrations_applied.sql', NOW(), 'backfill')
ON CONFLICT (filename) DO NOTHING;
