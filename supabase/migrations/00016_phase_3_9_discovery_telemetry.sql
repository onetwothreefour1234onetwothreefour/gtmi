-- 00016_phase_3_9_discovery_telemetry.sql
--
-- Phase 3.9 / W8 — discovery telemetry. Stage 0 marginal-yield
-- measurement so we can answer:
--   "When does Perplexity discovery stop adding new URLs to the
--    registry, and where can we cut its budget?"
--
-- The W0+W6+W11 archive system is designed so Stage 0 becomes less
-- load-bearing as the cohort matures. Without measurement, we keep
-- paying Perplexity forever even when it's adding nothing.
--
-- Each row records one Stage 0 invocation:
--   - urls_discovered:    fresh result count from Perplexity
--   - urls_already_in_registry:  of those, how many were already in
--     sources for this program (i.e. Perplexity rediscovered)
--   - urls_already_in_archive_for_country: of those, how many already
--     have a successful scrape_history row anywhere in the same
--     country (cross-program signal of cohort archive coverage)
--   - urls_new_to_archive: URLs the country has never scraped before
--   - marginal_yield_pct: urls_new_to_archive / urls_discovered
--
-- Materialised as a regular table (not a view) so Stage 0 latency
-- isn't blocked on a join during the discovery call. Queries from
-- the cost dashboard read it directly; weekly aggregations are
-- cheap (one row per program-run, ~100 rows/week post-cohort).
--
-- Reversible: DROP TABLE discovery_telemetry.

CREATE TABLE IF NOT EXISTS "discovery_telemetry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "programs"("id"),
  "country_iso" VARCHAR(3) NOT NULL,
  "discovered_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "urls_discovered" INTEGER NOT NULL,
  "urls_already_in_registry" INTEGER NOT NULL,
  "urls_already_in_archive_for_country" INTEGER NOT NULL,
  "urls_new_to_archive" INTEGER NOT NULL,
  "marginal_yield_pct" NUMERIC(5, 2) NOT NULL,
  "cache_hit" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes" JSONB
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_discovery_telemetry_program_at" ON "discovery_telemetry" ("program_id", "discovered_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_discovery_telemetry_country_at" ON "discovery_telemetry" ("country_iso", "discovered_at" DESC);
--> statement-breakpoint

ALTER TABLE "discovery_telemetry" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write discovery_telemetry" ON "discovery_telemetry" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read discovery_telemetry" ON "discovery_telemetry" AS PERMISSIVE FOR SELECT TO public USING (true);
--> statement-breakpoint

COMMENT ON TABLE "discovery_telemetry" IS 'Phase 3.9 / W8 — Stage 0 marginal-yield measurement. One row per discovery invocation. Powers the "when can we stop paying Perplexity" decision.';
