-- 00030_pillar_e_v6_purge.sql
--
-- Methodology v6.0.0 — Pillar E restructure (ADR-032).
--
-- Pillar E drops from 8 indicators / 3 sub-factors to 4 indicators /
-- 2 sub-factors. Sub-factor E.3 (Institutional Quality) retired entirely,
-- killing the World Bank WGI / V-Dem external-index ingestion path.
-- Four v5 keys are retired (E.1.3 program age — semantics moved to new
-- E.1.1; E.2.3 public guidance docs; E.3.1 rule of law; E.3.2 government
-- effectiveness). Four v5 keys are RETAINED in-place but with new
-- semantics, so the seed UPDATEs them rather than recreating:
--   - E.1.1: was severity-weighted policy changes (z_score, lower_is_better);
--            now program age (min_max, higher_is_better, ceiling 20).
--   - E.1.2: was forward-announced pipeline changes (boolean);
--            now cumulative approvals or active visa holders
--            (numeric_or_categorical dual-format, higher_is_better).
--   - E.2.1: was published approval rate (boolean);
--            now severity-weighted policy-change count
--            (min_max, lower_is_better — moved from old E.1.1, normFn changed
--            from z_score to min_max for direct piecewise calibration).
--   - E.2.2: was published quota / cap categorical;
--            now program suspension or abrupt closure history
--            (boolean, lower_is_better).
--
-- All Pillar E field_values rows are hard-deleted to force re-extraction
-- under the new prompts and normalization. The four retained-key
-- field_definitions rows survive (preserving id lineage); the seed UPDATEs
-- their label / prompt / normFn / direction / rubric / weight.
--
-- E.1.2 introduces a new normalizationFn 'numeric_or_categorical' which
-- the engine handles via piecewise rubric-anchored interpolation
-- (numeric value → bucket-anchor score; string value → rubric lookup).

BEGIN;

-- 1. Clear review_queue rows that reference any Pillar E field_value.
DELETE FROM "review_queue"
WHERE "field_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'E'
);
--> statement-breakpoint

-- 2. Clear policy_changes rows that reference any Pillar E field_value
--    (either previous_value_id or new_value_id) or field_definition.
--    Includes the imd-appeal-refresh synthetic-FK rows that previously
--    pinned to E.3.2; ADR-032 repoints those to A.1.1.
DELETE FROM "policy_changes"
WHERE "previous_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'E'
)
OR "new_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'E'
)
OR "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'E'
);
--> statement-breakpoint

-- 3. Clear extraction_attempts rows for Pillar E field_definitions.
DELETE FROM "extraction_attempts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'E'
);
--> statement-breakpoint

-- 4. NULL out field_definitions.current_prompt_id for Pillar E so the
--    extraction_prompts rows can be deleted without violating the FK.
UPDATE "field_definitions" SET "current_prompt_id" = NULL WHERE pillar = 'E';
--> statement-breakpoint

-- 5. Delete extraction_prompts rows for Pillar E field_definitions.
DELETE FROM "extraction_prompts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'E'
);
--> statement-breakpoint

-- 6. Hard-delete every Pillar E field_values row. Includes the four
--    retained keys (E.1.1 / E.1.2 / E.2.1 / E.2.2) — their definitions
--    are being UPDATEd rather than recreated, but the prompts and
--    normFns differ enough that legacy values are unscoreable under v6.
DELETE FROM "field_values"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'E'
);
--> statement-breakpoint

-- 7. Drop only the FOUR retired keys. The seed will UPDATE the four
--    surviving keys (E.1.1, E.1.2, E.2.1, E.2.2) into their v6 shape via
--    the existing onConflictDoUpdate(target=key) pattern, preserving
--    field_definitions.id lineage.
DELETE FROM "field_definitions"
WHERE "key" IN ('E.1.3', 'E.2.3', 'E.3.1', 'E.3.2');
--> statement-breakpoint

-- 8. Persisted methodology_versions.calibrated_params E.* entries should
--    be stripped here. The column is added by 00023, which is not
--    applied to every environment. apply-migration.ts splits on ';'
--    and cannot handle a DO $$ ... END $$ block with embedded
--    semicolons, so the cleanup is intentionally NOT inlined here.
--    On any environment that has 00023 applied, run separately:
--
--      UPDATE "methodology_versions"
--      SET "calibrated_params" = (
--        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
--        FROM jsonb_each("calibrated_params") WHERE k NOT LIKE 'E.%'
--      )
--      WHERE "calibrated_params" IS NOT NULL;
--
--    Until then, the next calibration pass overwrites the payload from
--    scratch and the stale E.* entries cease to be load-bearing.

COMMIT;
