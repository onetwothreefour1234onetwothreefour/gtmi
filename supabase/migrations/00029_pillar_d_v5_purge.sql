-- 00029_pillar_d_v5_purge.sql
--
-- Methodology v5.0.0 — Pillar D restructure (ADR-031).
--
-- Pillar D drops from 11 indicators / 3 sub-factors to 5 indicators /
-- 2 sub-factors. Six v4 keys are retired (D.1.3 PR-accrual presence,
-- D.1.4 PR retention, D.2.4 civic test burden, D.3.1 tax-residency
-- trigger, D.3.2 special tax regime, D.3.3 territorial vs worldwide).
-- The five surviving keys (D.1.1, D.1.2, D.2.1, D.2.2, D.2.3) keep
-- the same data types and directions but acquire new semantics:
--   - D.1.2 / D.2.2 score conditionally on D.1.1 / D.2.1 (parent
--     boolean = false → child scores 0, not null), implemented in the
--     scoring engine via the new SCORE_DEPENDENCIES map.
--   - D.1.2 / D.2.2 / D.2.3 are LLM-extracted (was country-derived
--     via Stage 6.5; the eight Pillar D deriveDxx functions are
--     deleted in this PR).
--
-- All Pillar D field_values rows are hard-deleted to force re-extraction
-- under the new prompts (the new D.1.2 / D.2.2 prompts include the
-- "not_applicable" token vocabulary that old extractions don't follow).

BEGIN;

-- 1. Clear review_queue rows that reference any Pillar D field_value.
DELETE FROM "review_queue"
WHERE "field_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'D'
);
--> statement-breakpoint

-- 2. Clear policy_changes rows that reference any Pillar D field_value
--    (either previous_value_id or new_value_id) or field_definition.
DELETE FROM "policy_changes"
WHERE "previous_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'D'
)
OR "new_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'D'
)
OR "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'D'
);
--> statement-breakpoint

-- 3. Clear extraction_attempts rows for Pillar D field_definitions.
DELETE FROM "extraction_attempts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'D'
);
--> statement-breakpoint

-- 4. NULL out field_definitions.current_prompt_id for Pillar D so the
--    extraction_prompts rows can be deleted without violating the FK.
UPDATE "field_definitions" SET "current_prompt_id" = NULL WHERE pillar = 'D';
--> statement-breakpoint

-- 5. Delete extraction_prompts rows for Pillar D field_definitions.
DELETE FROM "extraction_prompts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'D'
);
--> statement-breakpoint

-- 6. Hard-delete every Pillar D field_values row. Includes D.1.1 /
--    D.2.1 / D.2.3 boolean rows (definition-compatible but re-extract
--    for prompt-language uniformity) and D.1.2 / D.2.2 numeric rows
--    (definition-compatible but re-extract because the new prompts
--    introduce the "not_applicable" token).
DELETE FROM "field_values"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'D'
);
--> statement-breakpoint

-- 7. Drop the six retired keys. Seed will not re-create them.
DELETE FROM "field_definitions"
WHERE "key" IN ('D.1.3', 'D.1.4', 'D.2.4', 'D.3.1', 'D.3.2', 'D.3.3');
--> statement-breakpoint

-- 8. Persisted methodology_versions.calibrated_params D.* entries should
--    be stripped here. The column is added by 00023, which is not
--    applied to every environment. apply-migration.ts splits on ';'
--    and cannot handle a DO $$ ... END $$ block with embedded
--    semicolons, so the cleanup is intentionally NOT inlined here.
--    On any environment that has 00023 applied, run separately:
--
--      UPDATE "methodology_versions"
--      SET "calibrated_params" = (
--        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
--        FROM jsonb_each("calibrated_params") WHERE k NOT LIKE 'D.%'
--      )
--      WHERE "calibrated_params" IS NOT NULL;
--
--    Until then, the next calibration pass overwrites the payload from
--    scratch and the stale D.* entries cease to be load-bearing.

COMMIT;
