-- 00023_methodology_calibrated_params.sql
--
-- Phase 3.10d / B.1 — calibrated normalization params persisted on
-- methodology_versions.
--
-- Phase 2 / 3 used PHASE2_PLACEHOLDER_PARAMS in @gtmi/scoring with
-- engineer-chosen ranges; every score carried metadata.phase2Placeholder
-- = true. Phase 5's calibration step computes p10/p90 per min_max
-- field from the cohort's approved values; this column persists the
-- result so scoreProgramFromDb can read calibrated params at runtime
-- and clear the placeholder flag.
--
-- JSONB shape mirrors the NormalizationParams type:
--   {
--     "A.1.2": { "min": 0.5, "max": 2.5 },
--     "A.1.1": { "mean": 65000, "stddev": 35000 },
--     ...
--   }

ALTER TABLE "methodology_versions" ADD COLUMN IF NOT EXISTS "calibrated_params" JSONB;
--> statement-breakpoint

ALTER TABLE "methodology_versions"
  ADD COLUMN IF NOT EXISTS "calibrated_at" TIMESTAMPTZ;
--> statement-breakpoint

ALTER TABLE "methodology_versions"
  ADD COLUMN IF NOT EXISTS "calibrated_n_programs" INTEGER;
--> statement-breakpoint

COMMENT ON COLUMN "methodology_versions"."calibrated_params" IS
  'NormalizationParams object computed by scripts/compute-normalization-params.ts --persist. NULL when calibration has not run for this methodology version (placeholder params apply).';
--> statement-breakpoint

COMMENT ON COLUMN "methodology_versions"."calibrated_n_programs" IS
  'Number of distinct scored programmes the calibration was computed against. Cleared whenever calibrated_params is overwritten.';
