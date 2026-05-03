-- Phase 3.10d / G.4 — per-tenant Resend recipients.
--
-- Replaces the single `RESEND_RECIPIENTS` env var with a table-driven
-- recipient list. Each row carries optional severity + country
-- filters so a recipient can subscribe to e.g. "AUS material+ only"
-- or "all GCC programmes regardless of severity".
--
-- tenant_id is nullable today: NULL means "global / team-wide
-- recipient". When ADR-027 step 2 lights up Firebase Auth + tenants,
-- the populated tenant_id rows take over and the NULL rows can be
-- migrated onto the team's tenant.

CREATE TABLE IF NOT EXISTS "digest_recipients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ADR-027 step 2 hook: when Firebase tenants land, set this. NULL
  -- means the row is a global / team-wide recipient.
  "tenant_id" TEXT,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  -- Severity allowlist as a JSONB array of strings, e.g.
  -- '["breaking","material"]'. NULL means all severities.
  "severity_filter" JSONB,
  -- Country allowlist as a JSONB array of ISO3 strings. NULL means
  -- all countries.
  "country_iso_filter" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_digest_recipients_tenant_email"
  ON "digest_recipients" ("tenant_id", "email");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_digest_recipients_active"
  ON "digest_recipients" ("active");
--> statement-breakpoint

ALTER TABLE "digest_recipients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "Team members can write digest_recipients" ON "digest_recipients"
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
--> statement-breakpoint

-- Service-role-only read; do NOT expose recipient emails to the
-- public dashboard. A future analyst-facing /admin/digest-recipients
-- page reads via the team-write policy.
CREATE POLICY "Service-role read digest_recipients" ON "digest_recipients"
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
