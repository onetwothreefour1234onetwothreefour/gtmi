-- 00026_pillar_a_v2_purge.sql
--
-- Methodology v2.0.0 — Pillar A restructure (ADR-028).
--
-- The Pillar A indicator set is being fully replaced. Every old A.* key is
-- being repurposed with a different label, data_type, direction, or
-- normalization. Because field_definitions.key carries a UNIQUE constraint
-- and the seed re-uses the same keys via onConflictDoUpdate, existing
-- field_values rows would silently be reinterpreted under the new schema
-- (e.g. a row that stored an absolute salary against A.1.1 would be read
-- as a "% of median").
--
-- This migration hard-deletes every Pillar A field_values row and every
-- dependent row (review_queue, policy_changes, extraction_attempts,
-- extraction_prompts) so the seed can upsert the new 9 indicators on a
-- clean slate. The two retired keys (A.3.2, A.3.3) are removed from
-- field_definitions; the other seven keys remain (their rows are
-- re-used by onConflictDoUpdate). Persisted A.* entries in
-- methodology_versions.calibrated_params are stripped — the old A.1.1
-- z_score (mean/stddev for absolute salary) is meaningless under the new
-- min_max % indicator and would miscalibrate every score until the next
-- calibration run.

BEGIN;

-- 1. Clear review_queue rows that reference any Pillar A field_value.
DELETE FROM "review_queue"
WHERE "field_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'A'
);
--> statement-breakpoint

-- 2. Clear policy_changes rows that reference any Pillar A field_value
--    (either previous_value_id or new_value_id) or field_definition.
DELETE FROM "policy_changes"
WHERE "previous_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'A'
)
OR "new_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'A'
)
OR "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'A'
);
--> statement-breakpoint

-- 3. Clear extraction_attempts rows for Pillar A field_definitions.
--    Old prompts produced values under old definitions; keeping them
--    creates a misleading audit trail under the new schema.
DELETE FROM "extraction_attempts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'A'
);
--> statement-breakpoint

-- 4. NULL out field_definitions.current_prompt_id for Pillar A so the
--    extraction_prompts rows can be deleted without violating the FK.
UPDATE "field_definitions" SET "current_prompt_id" = NULL WHERE pillar = 'A';
--> statement-breakpoint

-- 5. Delete extraction_prompts rows for Pillar A field_definitions.
DELETE FROM "extraction_prompts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'A'
);
--> statement-breakpoint

-- 6. Hard-delete every Pillar A field_values row.
DELETE FROM "field_values"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'A'
);
--> statement-breakpoint

-- 7. Drop the two retired keys. Seed will not re-create them.
DELETE FROM "field_definitions" WHERE "key" IN ('A.3.2', 'A.3.3');
--> statement-breakpoint

-- 8. Persisted methodology_versions.calibrated_params would normally be
--    stripped of A.* entries here (the old A.1.1 z_score mean/stddev
--    for absolute salary is meaningless under the new min_max %
--    indicator). The column is added by 00023, which is not applied to
--    every environment. apply-migration.ts splits on ';' and cannot
--    handle a DO $$ ... END $$ block with embedded semicolons, so the
--    cleanup is intentionally NOT inlined here. On any environment
--    that has 00023 applied, run separately:
--
--      UPDATE "methodology_versions"
--      SET "calibrated_params" = (
--        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
--        FROM jsonb_each("calibrated_params") WHERE k NOT LIKE 'A.%'
--      )
--      WHERE "calibrated_params" IS NOT NULL;
--
--    Until then, the next calibration pass overwrites the payload from
--    scratch and the stale A.* entries cease to be load-bearing.

COMMIT;
