-- 00010_self_improving_sources_and_methodology_v2_reconciliation.sql
--
-- Phase 3.6 — bundles three concerns approved together (one migration per
-- ADR-012 single-file convention). All three changes are country-agnostic
-- and operate at schema or methodology level only; no per-country values.
--
-- (a) Sources schema additions for the self-improving discovery pattern
--     (ADR-015, drafted in commit 8). Stage 0 will write every verified
--     discovered URL back to `sources` so the registry grows monotonically
--     across runs. Three new columns + a uniqueness change:
--
--       last_seen_at      TIMESTAMPTZ DEFAULT NOW()  — bumped on every
--                                                     Stage 0 write-back
--       discovered_by     VARCHAR(50) DEFAULT 'seed' — provenance for the
--                                                     registry row
--                                                     ('seed' | 'stage-0-perplexity' | 'manual')
--       geographic_level  VARCHAR(20)                — global | continental
--                                                     | national | regional
--                                                     (matches ADR-003;
--                                                     was in the BRIEF but
--                                                     not in the live schema)
--
--     Uniqueness: drop UNIQUE(url) and replace with UNIQUE(program_id, url)
--     per analyst Q1 decision. Two programmes can now share a source URL
--     row (one row per programme-URL pair). Existing rows are preserved
--     because no current row violates the new constraint (each pre-seeded
--     row has a unique URL anyway). Going forward, ATO tax-residency or
--     similar shared sources will appear once per programme.
--
-- (b) Methodology v2 column reconciliation for `field_definitions`.
--     Migration 00009 updated `methodology_versions.normalization_choices`
--     JSONB but did NOT update the `field_definitions.normalization_fn`
--     column. The pipeline (`canary-run.ts`, `extract-single-program.ts`)
--     reads `def.normalizationFn` directly off the column, so the Phase 3.5
--     methodology v2 changes were silently inactive at runtime. This
--     migration aligns the column with the v2 spec for the five fields:
--
--       C.3.2  normalization_fn = 'country_substitute_regional'
--              data_type        = 'categorical'  (unchanged; explicit for clarity)
--       B.2.3  normalization_fn = 'boolean_with_annotation'
--              data_type        = 'json'
--       B.2.4  normalization_fn = 'boolean_with_annotation'
--              data_type        = 'json'
--       D.1.3  normalization_fn = 'boolean_with_annotation'
--              data_type        = 'json'
--       D.1.4  normalization_fn = 'boolean_with_annotation'
--              data_type        = 'json'
--
--     v1 scores tagged `methodology_version_id = v1` are NOT recomputed
--     under v2 (per dispatch §14). They remain on disk with their v1 stamp.
--
-- (c) Tier 2 allowlist expansion (ADR-013 amendment). Three additional
--     fields meet ADR-013's "Tier 1 structurally silent, Tier 2 reliably
--     covers, indicator outside scoring core OR confidence-capped" test:
--
--       B.2.3  Employer-borne levies & skill charges  (now boolean_with_annotation)
--       B.2.4  Mandatory non-government costs         (now boolean_with_annotation)
--       D.2.4  Civic / language / integration test burden
--
--     C.2.1 was considered and EXCLUDED per analyst Q2 decision: ADR-013's
--     exclusion of scoring-core Pillar C fields stands. C.2.1 will be
--     addressed via prompt restructure in a future phase.
--
--     The Tier 2 fallback path in extract.ts already enforces a 0.85
--     confidence cap on every Tier 2 row, so all of these route to /review
--     and never auto-approve.
--
-- Reversible:
--   (a) DROP COLUMN last_seen_at, discovered_by, geographic_level;
--       restore UNIQUE(url) by dropping the (program_id, url) constraint
--       and adding back sources_url_unique. Will fail if any duplicate
--       URLs were inserted in the meantime.
--   (b) UPDATE field_definitions SET normalization_fn = 'categorical',
--       data_type = 'categorical' WHERE key = 'C.3.2'; UPDATE
--       field_definitions SET normalization_fn = '<original>',
--       data_type = '<original>' WHERE key IN ('B.2.3','B.2.4','D.1.3','D.1.4').
--   (c) UPDATE field_definitions SET tier2_allowed = false
--       WHERE key IN ('B.2.3','B.2.4','D.2.4');

-- (a) Sources self-improving schema additions.
ALTER TABLE "sources"
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ DEFAULT NOW();
--> statement-breakpoint
ALTER TABLE "sources"
  ADD COLUMN IF NOT EXISTS "discovered_by" VARCHAR(50) DEFAULT 'seed';
--> statement-breakpoint
ALTER TABLE "sources"
  ADD COLUMN IF NOT EXISTS "geographic_level" VARCHAR(20);
--> statement-breakpoint

-- Backfill last_seen_at for existing seed rows so the 90-day "active
-- registry" window in the merge utility includes them on first run.
UPDATE "sources" SET "last_seen_at" = NOW() WHERE "last_seen_at" IS NULL;
--> statement-breakpoint

-- Uniqueness change: drop UNIQUE(url) and replace with UNIQUE(program_id, url).
-- Done in two steps so the new constraint is in place before we drop the old one.
ALTER TABLE "sources"
  ADD CONSTRAINT "sources_program_id_url_unique" UNIQUE ("program_id", "url");
--> statement-breakpoint
ALTER TABLE "sources"
  DROP CONSTRAINT IF EXISTS "sources_url_unique";
--> statement-breakpoint

-- (b) Methodology v2 column reconciliation.
UPDATE "field_definitions"
  SET "normalization_fn" = 'country_substitute_regional',
      "data_type"        = 'categorical'
  WHERE "key" = 'C.3.2';
--> statement-breakpoint
UPDATE "field_definitions"
  SET "normalization_fn" = 'boolean_with_annotation',
      "data_type"        = 'json'
  WHERE "key" IN ('B.2.3', 'B.2.4', 'D.1.3', 'D.1.4');
--> statement-breakpoint

-- (c) Tier 2 allowlist expansion (ADR-013 amendment).
UPDATE "field_definitions"
  SET "tier2_allowed" = true
  WHERE "key" IN ('B.2.3', 'B.2.4', 'D.2.4');
