-- 00019_score_history.sql
--
-- Phase 3.10b.4 — composite-score history table.
--
-- The `scores` table stores ONE row per programme; every rescore
-- overwrites it. Phase 5 calibration + the public dashboard's "score
-- over time" panel both want the history. This is the foundation.
--
-- score_history grows append-only: scoreProgramFromDb writes a row
-- here on every successful run, in addition to upserting `scores`.

CREATE TABLE IF NOT EXISTS "score_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "programs"("id"),
  "scored_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "methodology_version_id" UUID REFERENCES "methodology_versions"("id"),
  "composite_score" NUMERIC(6, 2),
  "paq_score" NUMERIC(6, 2),
  "cme_score" NUMERIC(6, 2),
  "coverage_populated" INTEGER,
  "coverage_total" INTEGER,
  "flagged_insufficient_disclosure" BOOLEAN,
  "metadata" JSONB
);
--> statement-breakpoint

COMMENT ON COLUMN "score_history"."metadata" IS
  'Free-form JSONB payload mirroring scores.metadata at the time of write — phase2Placeholder flag, normalization params version, flags, etc.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_score_history_program_id" ON "score_history" ("program_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_history_scored_at" ON "score_history" ("scored_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_history_program_scored_at" ON "score_history" ("program_id", "scored_at" DESC);
--> statement-breakpoint

ALTER TABLE "score_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write score_history" ON "score_history" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read score_history" ON "score_history" AS PERMISSIVE FOR SELECT TO public USING (true);
