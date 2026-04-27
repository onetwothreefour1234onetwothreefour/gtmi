-- 00009_methodology_v2.sql
--
-- Phase 3.5 / ADR-014: insert methodology_versions row for v2.0.0.
--
-- Five indicators restructured (data-type / normalization changes only;
-- weights unchanged):
--
--   B.2.3 — numeric (z_score)            → boolean_with_annotation
--   B.2.4 — numeric (z_score)            → boolean_with_annotation
--   D.1.3 — numeric (min_max)            → boolean_with_annotation
--   D.1.4 — numeric (min_max)            → boolean_with_annotation
--   C.3.2 — categorical                  → country_substitute_regional
--
-- All other JSON columns (framework_structure, pillar_weights,
-- sub_factor_weights, indicator_weights, cme_paq_split, rubric_versions)
-- are copied verbatim from the v1 row. Only `normalization_choices`
-- has five keys overridden, derived in-SQL via jsonb_set.
--
-- v1 scores remain in `scores` tagged with the v1 methodology_version_id.
-- Per dispatch §14, v1 scores are NOT recomputed under v2 — each score
-- carries its own version stamp.
--
-- Reversible: DELETE FROM methodology_versions WHERE version_tag = '2.0.0'.

INSERT INTO "methodology_versions" (
  "version_tag",
  "published_at",
  "framework_structure",
  "pillar_weights",
  "sub_factor_weights",
  "indicator_weights",
  "normalization_choices",
  "rubric_versions",
  "cme_paq_split",
  "change_notes"
)
SELECT
  '2.0.0',
  now(),
  "framework_structure",
  "pillar_weights",
  "sub_factor_weights",
  "indicator_weights",
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            "normalization_choices",
            '{B.2.3}', '"boolean_with_annotation"'::jsonb
          ),
          '{B.2.4}', '"boolean_with_annotation"'::jsonb
        ),
        '{D.1.3}', '"boolean_with_annotation"'::jsonb
      ),
      '{D.1.4}', '"boolean_with_annotation"'::jsonb
    ),
    '{C.3.2}', '"country_substitute_regional"'::jsonb
  ),
  "rubric_versions",
  "cme_paq_split",
  'Phase 3.5 / ADR-014 — 5 indicators restructured (B.2.3, B.2.4, D.1.3, D.1.4 to boolean_with_annotation, C.3.2 to country_substitute_regional). Weights unchanged. v1 scores not recomputed.'
FROM "methodology_versions"
WHERE "version_tag" = '1.0.0'
ON CONFLICT DO NOTHING;
