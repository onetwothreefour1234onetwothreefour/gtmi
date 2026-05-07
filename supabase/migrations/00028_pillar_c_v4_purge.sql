-- 00028_pillar_c_v4_purge.sql
--
-- Methodology v4.0.0 — Pillar C restructure + 999 sentinel hardening (ADR-030).
--
-- Pillar C ("Rights" in v3, renamed to "Benefits" in v4) drops from 10
-- indicators / 3 sub-factors to 8 indicators / 3 sub-factors. Three v3
-- keys are retired (C.1.4 labor market test, C.2.4 same-sex partner
-- recognition, plus the conceptual loss of v3 C.1.1 "employer
-- sponsorship requirement" — the C.1.1 key is repurposed). All eight
-- surviving Pillar C keys are repurposed with different vocabularies;
-- C.1.3 is net-new in concept (visa duration & renewability).
--
-- Because the seed re-uses keys via onConflictDoUpdate, existing
-- field_values rows would silently be reinterpreted under the new
-- schema (e.g. an old C.1.1 categorical value of 'required_throughout'
-- — about employer sponsorship — would not match the new C.1.1 rubric
-- about employer switching). This migration hard-deletes every Pillar
-- C field_values row and every dependent row (review_queue,
-- policy_changes, extraction_attempts, extraction_prompts), then drops
-- the two retired field_definitions (C.1.4, C.2.4).
--
-- The 999 integer sentinel for "no cap" is hardened out of the
-- numeric sanity ranges (0..100 instead of 0..999 for A.1.5 / C.2.2).
-- This migration includes a defensive data fix for any A.1.5
-- field_values row whose value_raw is the literal '999' or whose
-- value_normalized is the bare numeric 999 — converted to the
-- canonical no_cap token + structured marker. Pillar C C.2.2 rows are
-- already deleted earlier in this migration, so the fix only touches
-- A.1.5 in practice.

BEGIN;

-- 1. Clear review_queue rows that reference any Pillar C field_value.
DELETE FROM "review_queue"
WHERE "field_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'C'
);
--> statement-breakpoint

-- 2. Clear policy_changes rows that reference any Pillar C field_value
--    (either previous_value_id or new_value_id) or field_definition.
DELETE FROM "policy_changes"
WHERE "previous_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'C'
)
OR "new_value_id" IN (
  SELECT fv.id FROM "field_values" fv
  JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
  WHERE fd.pillar = 'C'
)
OR "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'C'
);
--> statement-breakpoint

-- 3. Clear extraction_attempts rows for Pillar C field_definitions.
DELETE FROM "extraction_attempts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'C'
);
--> statement-breakpoint

-- 4. NULL out field_definitions.current_prompt_id for Pillar C so the
--    extraction_prompts rows can be deleted without violating the FK.
UPDATE "field_definitions" SET "current_prompt_id" = NULL WHERE pillar = 'C';
--> statement-breakpoint

-- 5. Delete extraction_prompts rows for Pillar C field_definitions.
DELETE FROM "extraction_prompts"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'C'
);
--> statement-breakpoint

-- 6. Hard-delete every Pillar C field_values row.
DELETE FROM "field_values"
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE pillar = 'C'
);
--> statement-breakpoint

-- 7. Drop the two retired keys. Seed will not re-create them.
DELETE FROM "field_definitions" WHERE "key" IN ('C.1.4', 'C.2.4');
--> statement-breakpoint

-- 8. Sentinel hardening: convert any A.1.5 field_values row whose
--    value_raw is the literal '999' to the canonical 'no_cap' token +
--    {"__noLimit": true} structured marker. Defensive — the structured
--    normalizer landed in Phase 3.6.3, so most rows should already be
--    marker-shaped, but pre-3.6.3 rows could still carry a literal 999.
UPDATE "field_values"
SET "value_raw" = 'no_cap',
    "value_normalized" = '{"__noLimit": true}'::jsonb
WHERE "field_definition_id" IN (
  SELECT id FROM "field_definitions" WHERE "key" = 'A.1.5'
)
AND "value_raw" = '999';
--> statement-breakpoint

-- 9. Persisted methodology_versions.calibrated_params C.* entries should
--    be stripped here. The column is added by 00023, which is not
--    applied to every environment. apply-migration.ts splits on ';' and
--    cannot handle a DO $$ ... END $$ block with embedded semicolons,
--    so the cleanup is intentionally NOT inlined here. On any
--    environment that has 00023 applied, run separately:
--
--      UPDATE "methodology_versions"
--      SET "calibrated_params" = (
--        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
--        FROM jsonb_each("calibrated_params") WHERE k NOT LIKE 'C.%'
--      )
--      WHERE "calibrated_params" IS NOT NULL;
--
--    Until then, the next calibration pass overwrites the payload from
--    scratch and the stale C.* entries cease to be load-bearing.

COMMIT;
