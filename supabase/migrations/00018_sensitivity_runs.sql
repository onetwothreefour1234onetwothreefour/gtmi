-- 00018_sensitivity_runs.sql
--
-- Phase 3.10c.1 — extend the existing sensitivity_runs table for
-- per-perturbation rows.
--
-- The sensitivity_runs table already exists from the Phase 1 core
-- schema (id, methodology_version_id, run_type, run_at, results JSONB).
-- Phase 5 closes on six sensitivity analyses (BRIEF.md §4 / METHODOLOGY.md
-- §8) and the runner in scripts/sensitivity.ts (Phase 3.10b.5) needs
-- to write one row per perturbation rather than one row per run.
--
-- Strategy: ADD the new per-perturbation columns and leave the legacy
-- run_type / results columns in place (NULLABLE). New rows from the
-- runner use the new columns; any existing legacy rows survive.

ALTER TABLE "sensitivity_runs"
  ADD COLUMN IF NOT EXISTS "run_id" UUID,
  ADD COLUMN IF NOT EXISTS "analysis_type" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "perturbation_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "baseline_ranking_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "perturbed_ranking_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "spearman_rho" NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS "top10_shift" INTEGER,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
--> statement-breakpoint

-- Make methodology_version_id nullable so the new runner can ship rows
-- before a methodology version pin is enforced. The legacy run_type /
-- results columns are also non-NOT-NULL by ALTER below.
ALTER TABLE "sensitivity_runs" ALTER COLUMN "methodology_version_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sensitivity_runs" ALTER COLUMN "run_type" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sensitivity_runs" ALTER COLUMN "results" DROP NOT NULL;
--> statement-breakpoint

COMMENT ON COLUMN "sensitivity_runs"."analysis_type" IS
  'One of: weight_monte_carlo (BRIEF.md §4 #1), normalization (#2), aggregation (#3), cme_paq_split (#4), indicator_dropout (#5), correlation (#6).';
--> statement-breakpoint

COMMENT ON COLUMN "sensitivity_runs"."run_id" IS
  'Groups rows that came from the same scripts/sensitivity.ts invocation. Multiple perturbations per run.';
--> statement-breakpoint

COMMENT ON COLUMN "sensitivity_runs"."perturbation_jsonb" IS
  'The exact perturbation applied — e.g. {"pillar": "A", "weight_delta": 0.05} for weight_monte_carlo.';
--> statement-breakpoint

COMMENT ON COLUMN "sensitivity_runs"."top10_shift" IS
  'Number of programmes whose ranking shifted by >=1 position within the top 10 under the perturbed config.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sensitivity_runs_run_id" ON "sensitivity_runs" ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sensitivity_runs_analysis_type" ON "sensitivity_runs" ("analysis_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sensitivity_runs_ran_at" ON "sensitivity_runs" ("run_at" DESC);
