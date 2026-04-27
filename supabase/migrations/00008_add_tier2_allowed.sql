-- 00008_add_tier2_allowed.sql
--
-- Phase 3.4 / ADR-013: gate Tier 2 backfill at the indicator level.
--
-- Adds:
--   tier2_allowed  boolean  NOT NULL  DEFAULT false
--
-- Default `false` → every existing indicator remains Tier-1-only.
-- The Phase 3.4 seed sets this to true for B.3.3, C.2.4, and D.2.3
-- (the ADR-013 allowlist). The extraction stage will read this column
-- before falling through to a Tier 2 source — that pipeline change is
-- NOT in this migration; it ships separately at re-canary time so the
-- Tier 2 prompt template can be reviewed independently.
--
-- Reversible: a single `DROP COLUMN tier2_allowed`. Existing field_values
-- rows are unaffected because the column lives on field_definitions.

ALTER TABLE "field_definitions"
  ADD COLUMN "tier2_allowed" boolean NOT NULL DEFAULT false;
