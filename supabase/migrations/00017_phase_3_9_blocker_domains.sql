-- 00017_phase_3_9_blocker_domains.sql
--
-- Phase 3.9 / PR G / W15+W16 — domain-level blocker registry.
--
-- The 2026-04-30 NLD/JPN canary re-runs surfaced two anti-bot
-- patterns in cohort government domains:
--
--   1. ISA (isa.go.jp) serves the same 1595-char Japanese
--      interstitial across every path — both /en/ and /jp/, both
--      HTML and PDF. The HTML cascade (Playwright → curl_cffi →
--      Jina → Wayback) all returned the SAME bytes; W2 translation
--      uselessly translated the blocker text 8 times.
--   2. IND (ind.nl) serves the main HSM page as thin SPA-shell
--      content under headless scraping; alternative IND paths
--      (forms, normbedragen) are mixed.
--
-- This table is the country-agnostic mechanism for routing around
-- anti-bot walls without baking domain knowledge into code:
--
--   - Empty seed. The detector in scrape.ts (W15) auto-populates
--     when it observes hash-equality / thin-fanout / challenge-
--     fanout signals across ≥2 paths from one domain in a single run.
--   - Subsequent runs (any country, any program) read the table on
--     start; matching domains route directly to Wayback (or other
--     fallback layers) instead of the standard cascade.
--   - Manual override path: an analyst can pre-emptively flag a
--     domain via INSERT.
--
-- Same shape as ADR-015's self-improving sources registry: empty
-- seed, organic growth, audit trail.

CREATE TABLE IF NOT EXISTS "blocker_domains" (
  "domain" TEXT PRIMARY KEY,
  "first_detected_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "last_seen_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "detection_signal" VARCHAR(40) NOT NULL,
  "detected_for_program_id" UUID REFERENCES "programs"("id"),
  "notes" JSONB
);
--> statement-breakpoint

COMMENT ON COLUMN "blocker_domains"."detection_signal" IS
  'One of: hash_equality (W15.1), thin_fanout (W15.2), challenge_fanout (W15.3), manual_override.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_blocker_domains_last_seen" ON "blocker_domains" ("last_seen_at" DESC);
--> statement-breakpoint

ALTER TABLE "blocker_domains" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write blocker_domains" ON "blocker_domains" AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "Public read blocker_domains" ON "blocker_domains" AS PERMISSIVE FOR SELECT TO public USING (true);
