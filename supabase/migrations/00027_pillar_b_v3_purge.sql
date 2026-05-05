-- 00027_pillar_b_v3_purge.sql
--
-- Methodology v3.0.0 — Pillar B restructure (ADR-029).
--
-- Pillar B drops from 10 indicators (3 sub-factors) to 7 indicators
-- (4 sub-factors). The new sub-factors are B.1 Speed, B.2 Process
-- Complexity, B.3 Total Cost, B.4 Transparency. Five v1 keys are
-- retired (B.1.3, B.2.3, B.2.4, B.3.2, B.3.3); four surviving keys
-- (B.1.1, B.1.2, B.2.1, B.2.2, B.3.1) are repurposed with different
-- meanings, data types, or normalizations.
--
-- Because the seed re-uses keys via onConflictDoUpdate, existing
-- field_values rows would silently be reinterpreted under the new
-- schema (e.g. a row that stored a USD fee against B.2.1 would be
-- read as a step count). This migration hard-deletes every Pillar B
-- field_values row (including B.1.1 — confirmed re-extract path) and
-- every dependent row (review_queue, policy_changes,
-- extraction_attempts, extraction_prompts), then drops the five
-- retired field_definitions. The seed will upsert the seven new
-- indicators on a clean slate.

BEGIN;

-- 1. Clear review_queue rows that reference any Pillar B field_value.
DELETE FROM "review_queue"
WHERE "field_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'B'
);
--> statement-breakpoint

-- 2. Clear policy_changes rows that reference any Pillar B field_value
--    (either previous_value_id or new_value_id) or field_definition.
DELETE FROM "policy_changes"
WHERE "previous_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'B'
)
OR "new_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'B'
)
OR "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'B'
);
--> statement-breakpoint

-- 3. Clear extraction_attempts rows for Pillar B field_definitions.
DELETE FROM "extraction_attempts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'B'
);
--> statement-breakpoint

-- 4. NULL out field_definitions.current_prompt_id for Pillar B so the
--    extraction_prompts rows can be deleted without violating the FK.
UPDATE "field_definitions" SET "current_prompt_id" = NULL WHERE pillar = 'B';
--> statement-breakpoint

-- 5. Delete extraction_prompts rows for Pillar B field_definitions.
DELETE FROM "extraction_prompts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'B'
);
--> statement-breakpoint

-- 6. Hard-delete every Pillar B field_values row. Includes B.1.1
--    (numeric SLA days) per analyst direction — re-extract under the
--    new prompt so range/midpoint conversions are applied uniformly.
DELETE FROM "field_values"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'B'
);
--> statement-breakpoint

-- 7. Drop the five retired keys. Seed will not re-create them.
DELETE FROM "field_definitions" WHERE "key" IN ('B.1.3', 'B.2.3', 'B.2.4', 'B.3.2', 'B.3.3');
--> statement-breakpoint

-- 8. Persisted methodology_versions.calibrated_params B.* entries should
--    be stripped here (old B.2.1 z_score fee mean/stddev no longer
--    applies under the new min_max step-count). The column is added
--    by 00023, which is not applied to every environment.
--    apply-migration.ts splits on ';' and cannot handle a DO $$ ... END $$
--    block with embedded semicolons, so the cleanup is intentionally
--    NOT inlined here. On any environment that has 00023 applied, run
--    separately:
--
--      UPDATE "methodology_versions"
--      SET "calibrated_params" = (
--        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
--        FROM jsonb_each("calibrated_params") WHERE k NOT LIKE 'B.%'
--      )
--      WHERE "calibrated_params" IS NOT NULL;
--
--    Until then, the next calibration pass overwrites the payload from
--    scratch and the stale B.* entries cease to be load-bearing.

COMMIT;
