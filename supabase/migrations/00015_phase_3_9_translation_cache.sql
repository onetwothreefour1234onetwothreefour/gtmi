-- 00015_phase_3_9_translation_cache.sql
--
-- Phase 3.9 / W2 — translation cache for non-English source pages.
--
-- Government policy pages on JPN (NTA, MOJ), NLD (Belastingdienst,
-- DUO), DEU (BMF), FRA (Service-Public), and the GCC Arabic-side
-- portals are routinely served in their native language even when an
-- English landing page exists. The HTML cascade returns native-language
-- text; the LLM extractor reads English-labelled fields. translate.ts
-- bridges the gap by translating the markdown to English (Claude
-- Sonnet, "preserve numbers/currency/dates verbatim") before extraction.
--
-- This table memoises per-content-hash translations so re-running the
-- same scrape (or re-extracting from archive) doesn't pay the
-- translation LLM cost twice. Cache key is sha256(content_hash +
-- source_language + translation_version) so a translation_version bump
-- (model upgrade, prompt change) cleanly invalidates without a DROP.
--
-- Reversible: DROP TABLE translation_cache.

CREATE TABLE IF NOT EXISTS "translation_cache" (
  "cache_key" TEXT PRIMARY KEY,
  "source_language" VARCHAR(8) NOT NULL,
  "translation_version" VARCHAR(32) NOT NULL,
  "source_content_hash" TEXT NOT NULL,
  "translated_text" TEXT NOT NULL,
  "translated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_translation_cache_source_hash" ON "translation_cache" ("source_content_hash");
--> statement-breakpoint

ALTER TABLE "translation_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write translation_cache" ON "translation_cache" AS PERMISSIVE FOR ALL TO authenticated USING (true);
