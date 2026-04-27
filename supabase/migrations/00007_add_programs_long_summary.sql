-- 00007_add_programs_long_summary.sql
--
-- Phase 4.3: editorial "What this means" panel on the program detail page.
-- Adds three nullable columns to `programs` per ADR-010 (columns over a
-- separate program_narratives table for Phase 4):
--
--   long_summary_md          text     — body copy, markdown, 200–300 words
--   long_summary_updated_at  timestamp — when the latest body was written/edited
--   long_summary_reviewer    uuid     — auth.users id of the human who approved
--
-- Reviewer FK: targets auth.users (the same Supabase-managed table the
-- existing `field_values.reviewed_by` column references implicitly through
-- the review flow). Kept nullable so seeded programs without summaries
-- don't violate the constraint.
--
-- RLS unchanged: the existing public-read policy on `programs` covers the
-- new columns automatically. No separate grant required.

ALTER TABLE "programs"
  ADD COLUMN "long_summary_md" text;

--> statement-breakpoint

ALTER TABLE "programs"
  ADD COLUMN "long_summary_updated_at" timestamp;

--> statement-breakpoint

ALTER TABLE "programs"
  ADD COLUMN "long_summary_reviewer" uuid REFERENCES auth.users(id);
