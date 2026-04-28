-- 00012_field_url_index_view.sql
--
-- Phase 3.6.2 / ITEM 6 — `field_url_index` view.
--
-- Purpose: a denormalised, query-friendly view that joins `field_values`
-- (with provenance) to `field_definitions` (key, label, pillar) so that
-- the weekly maintenance scrape job, the dashboard's "stale source"
-- panel, and any future broken-URL audit can answer the question
--   "which approved values currently depend on this URL?"
-- without having to JSON-traverse `field_values.provenance` from each
-- consumer.
--
-- Source rows are limited to status IN ('approved', 'pending_review')
-- because pending_review rows still represent the system's current
-- understanding of the program (they're the rows the dashboard renders
-- with a "review" badge). `superseded` and `archived` rows are
-- intentionally excluded — they no longer back any indicator value.
--
-- The view is read-only and is recreated atomically; safe to re-apply.
--
-- The `policy_changes.severity` column already accepts arbitrary
-- short strings (varchar(20), no CHECK constraint), so adding the
-- `'url_broken'` severity is a code-side change only — no DDL needed.

CREATE OR REPLACE VIEW "field_url_index" AS
SELECT
  fv.program_id                                  AS "program_id",
  p.country_iso                                  AS "country_iso",
  p.name                                         AS "program_name",
  fd.key                                         AS "field_key",
  fd.label                                       AS "field_label",
  fd.pillar                                      AS "field_pillar",
  fv.id                                          AS "field_value_id",
  fv.status                                      AS "field_value_status",
  (fv.provenance->>'sourceUrl')                  AS "source_url",
  (fv.provenance->>'sourceTier')::int            AS "source_tier",
  (fv.provenance->>'extractionModel')            AS "extraction_model",
  (fv.provenance->>'scrapeTimestamp')            AS "scrape_timestamp",
  fv.extracted_at                                AS "extracted_at",
  fv.reviewed_at                                 AS "reviewed_at"
FROM "field_values" fv
JOIN "field_definitions" fd ON fd.id = fv.field_definition_id
JOIN "programs"          p  ON p.id  = fv.program_id
WHERE fv.status IN ('approved', 'pending_review')
  AND fv.provenance ? 'sourceUrl'
  AND (fv.provenance->>'sourceUrl') IS NOT NULL;

COMMENT ON VIEW "field_url_index" IS
  'Phase 3.6.2 / ITEM 6 — projection of field_values + provenance for URL-centric queries (weekly maintenance scrape, broken-URL audit, "values backed by this source" lookup).';
