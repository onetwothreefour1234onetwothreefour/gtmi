-- Phase 3.10d / C.3 — Wayback archival on content drift.
--
-- Stores the Save Page Now archive URL on a scrape_history row when the
-- content_hash drifted from the prior archived hash for the same source.
-- The Phase 5 policy_changes emitter will copy this onto the matching
-- policy_changes.wayback_url so the audit trail survives URL drift.

ALTER TABLE scrape_history
  ADD COLUMN IF NOT EXISTS wayback_url TEXT,
  ADD COLUMN IF NOT EXISTS wayback_captured_at TIMESTAMPTZ;
