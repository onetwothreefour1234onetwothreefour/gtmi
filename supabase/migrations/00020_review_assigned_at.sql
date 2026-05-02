-- 00020_review_assigned_at.sql
--
-- Phase 3.10b.7 — reviewer-assignment timestamp.
--
-- review_queue.assigned_to (UUID) was added to the original Phase 1
-- schema but never wired up. The /review queue table currently
-- hardcodes "Unassigned" in the Reviewer column. Cohort triage will
-- queue ≥1500 rows; per-row assignment is the throughput unblocker.
--
-- This migration adds assigned_at so the UI can show "Assigned 2d ago"
-- and the analyst-throughput dashboard can compute time-to-resolution.

ALTER TABLE "review_queue" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ;
--> statement-breakpoint

COMMENT ON COLUMN "review_queue"."assigned_at" IS
  'When assigned_to was set. NULL when assigned_to is NULL. Bumped on re-assignment.';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_review_queue_assigned_to" ON "review_queue" ("assigned_to") WHERE "assigned_to" IS NOT NULL;
