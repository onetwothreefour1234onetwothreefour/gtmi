-- 00021_news_signals_phase_3_10c5.sql
--
-- Phase 3.10c.5 — extend news_signals for the Phase 6 Exa ingest job.
--
-- The Phase 1 schema has news_signals with (source_url, publication,
-- detected_at, matched_programs JSONB, summary, triggered_review_queue_id).
-- The Phase 6 ingest job needs more structure:
--   - country_iso so the dashboard can scope by country
--   - headline so the /changes timeline can render the signal compactly
--   - published_at for the news article's actual date (vs detected_at
--     which is when our cron picked it up)
--   - ai_summary for the LLM's "what changed" precis (separate from
--     the existing free-form summary)
--   - severity_hint for the LLM's "this looks Material/Breaking/Minor"
--     pre-tag; analyst confirms in /review
--
-- ALTER ADD; existing rows survive with NULL in the new columns.

ALTER TABLE "news_signals"
  ADD COLUMN IF NOT EXISTS "country_iso" VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "headline" TEXT,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ai_summary" TEXT,
  ADD COLUMN IF NOT EXISTS "severity_hint" VARCHAR(20);
--> statement-breakpoint

COMMENT ON COLUMN "news_signals"."severity_hint" IS
  'LLM pre-tag: breaking | material | minor | unknown. Analyst confirms via /review.';
--> statement-breakpoint

COMMENT ON COLUMN "news_signals"."country_iso" IS
  'Inferred country scope when the article matches a single cohort country. NULL for cross-country news.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_news_signals_country_iso" ON "news_signals" ("country_iso");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_signals_detected_at" ON "news_signals" ("detected_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_signals_severity" ON "news_signals" ("severity_hint") WHERE "severity_hint" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "news_signals_source_url_unique" ON "news_signals" ("source_url");
--> statement-breakpoint

ALTER TABLE "news_signals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Public read news_signals" ON "news_signals" AS PERMISSIVE FOR SELECT TO public USING (true);
