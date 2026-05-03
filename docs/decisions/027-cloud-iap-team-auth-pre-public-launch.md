# 027: Pre-public-launch team auth via Cloud IAP, with Firebase Auth as the public-launch path

**Status:** Proposed
**Date:** 2026-04-30
**Phase:** 3.10d / G.3 (planning only — no code yet)

## Context

Several team-only surfaces have shipped without an authentication boundary:

- `/review` — editorial review queue (approve / reject / bulk-approve / re-score)
- `/admin/blockers` — anti-bot blocker registry editor
- `/admin/methodology` — methodology version viewer + change-notes editor (3.10d / D.4)
- `/admin/methodology/compare` — two-version diff (3.10d / E.3)
- `/admin/programs`, `/admin/programs/[id]` — programme registry editor (3.10d / D.5)

Inside each of these, RLS policies on the underlying tables (`field_values`, `review_queue`, `methodology_versions`, `programs`, `blocker_domains`) carry a comment marker:

```sql
to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
```

i.e. RLS currently treats every authenticated Supabase user as a team member. The Cloud Run service that hosts `apps/web` is unauthenticated — anyone with the URL can hit `/review` and bulk-approve every pending row. Today this is mitigated by the URL being unpublished and rate-limited at the load balancer, not by an actual auth boundary.

Three forces are now converging:

1. **Public launch is the next phase boundary.** Once the rankings dashboard goes public, the `/review` and `/admin/*` surfaces must NOT be reachable by the public Cloud Run URL. Anything weaker than a real auth gate is a one-tweet incident waiting to happen.
2. **Reviewer attribution is a stub.** The `assignReviewer` action (3.10b.7 + 3.10d / D.3) reads the reviewer UUID from `?reviewer=…` query params — pre-auth, hand-pasted. Approve/reject record `reviewedBy: null`. Both are flagged for "post-auth, swap for the real Supabase user id".
3. **Per-tenant Resend recipients (G.4) need an org/tenant concept.** The current `RESEND_RECIPIENTS` is a single comma-separated env var; tenanting it requires an authenticated org boundary that doesn't exist today.

The user has explicitly requested everything stay on Google Cloud (memory: `feedback_gcp_preference.md`). Supabase remains acceptable for Postgres + RLS, but the auth provider should not be Supabase Auth — that adds a second SaaS dependency on the auth-critical path.

## Options

### Option A — Cloud IAP gate around the entire `apps/web` service

Identity-Aware Proxy in front of the Cloud Run service. IAP authenticates Google Workspace identities at the load-balancer; only allowlisted emails reach the Next.js app. The signed `x-goog-iap-jwt-assertion` header proves identity to downstream code.

- **Pros:** No code change required for the gate itself; lights up in hours, not days. Native to GCP. Audit logs land in Cloud Audit Logs automatically. Integrates with Cloud Run's HTTPS load balancer without an SDK.
- **Cons:** Workspace-only (no external collaborators without a Workspace seat). The whole service is gated — can't selectively expose `/`, `/programs`, `/methodology` to the public while keeping `/review` private. So we'd need to split the service: a public `gtmi-web` and an internal `gtmi-internal` deployed separately, each with its own load balancer.

### Option B — Cloud IAP gate around a split internal-only Cloud Run service

Same IAP, but only on the `/review` + `/admin/*` paths via a second Cloud Run service. The public `apps/web` stays open.

- **Pros:** Same IAP simplicity, no Workspace-vs-public collision. Reviewers + analysts authenticate once via Google. Most defensible boundary for pre-launch.
- **Cons:** Requires splitting the Next.js app into two services (or using load-balancer path routing into one). Doubles the deploy surface. Adds CI complexity.

### Option C — Firebase Authentication

Firebase Auth as a Next.js auth provider; authenticated state stored in a session cookie, RLS policies tightened to use the Supabase JWT mapped from a Firebase ID token, OR a Cloud Run middleware that verifies Firebase tokens before invoking the route handler.

- **Pros:** Public-friendly. Supports email/password, magic link, Google sign-in, custom claims (which we'd use to encode "team" / "reviewer" / "admin" roles). Free tier covers the team's volume forever.
- **Cons:** More code. Adds a Firebase project to the GCP footprint. Bridging Firebase ID tokens into Supabase RLS requires either custom JWT signing (so RLS policies can read `auth.uid()`) or moving the access control fully into Next.js middleware. Either path is a multi-day build.

### Option D — Defer all of it; ship pre-launch with a shared password

Cloud Run rewrite middleware that requires an `HTTP_BASIC_AUTH_PASSWORD`-matching header; rotate quarterly.

- **Pros:** Zero infra, half a day of work, no new dependencies.
- **Cons:** No identity, so reviewer attribution stays broken. No org/tenant concept, so G.4 stays blocked. Indistinguishable in audit logs from a credential leak. Terrible long-term answer.

## Decision

We have not chosen yet. This ADR proposes the following two-step sequencing:

**Step 1 — pre-public-launch (immediate, before the public dashboard ships):**

Adopt **Option B** (Cloud IAP on a split internal-only Cloud Run service). The internal service hosts `/review`, `/review/*`, `/admin/*`, and the existing `(internal)` route group. IAP allowlists the team's Workspace emails. The public Cloud Run service hosts everything outside `(internal)`.

Concretely:

1. Add a new Cloud Run service `gtmi-internal` that runs the same `apps/web` build but with a `INTERNAL_ONLY=true` env var that triggers a 404 on every non-internal route (defense in depth — even if IAP is misconfigured, the public surface doesn't leak via the internal URL).
2. Place an HTTPS load balancer in front of the existing Cloud Run service with a single backend; attach IAP with the team Workspace as the IdP.
3. Replace the `?reviewer=<uuid>` URL stub with a server-side read of the `x-goog-iap-jwt-assertion` header → email → reviewer UUID lookup. Persist the lookup map in a new `team_members` table (email PRIMARY KEY, reviewer_uuid).
4. Tighten RLS policies on `field_values`, `review_queue`, `methodology_versions`, `programs`, `blocker_domains` to require a JWT claim that IAP doesn't grant by default — leave them at `authenticated` for now and rely on the network-level IAP boundary; the migration to claim-checked policies can land in step 2.

Reversal cost: low. IAP can be disabled from the GCP console; the split service can be merged back; the `team_members` lookup is a single table.

**Step 2 — public-launch (deferred to post-public-launch):**

Adopt **Option C** (Firebase Auth) for the broader auth story:

- Public users get optional accounts (saved-comparisons, alerts, advisor-mode preferences).
- Team members migrate from IAP-Workspace → Firebase Auth with a `team` custom claim, which the Next.js middleware reads.
- RLS policies tighten to check the `team` claim from the Supabase JWT (signed by the same Firebase project's signing key — Supabase supports custom JWT verification).
- Per-tenant Resend recipients (G.4) read the recipient list from a `tenant_recipients` table keyed on the authenticated user's tenant id.

Step 2 deliberately has NO code in this commit. It's the destination, not the route. Step 1's IAP boundary is the pre-launch quick win; step 2 is the durable answer once we know whether GTMI ever gets public-account features.

## Consequences

**Upside (step 1):**

- The "one-tweet incident" risk goes away the day Cloud Run + IAP land. Total work: ~2 days.
- Reviewer attribution becomes real without changing the application code substantially — the only swap is reading `x-goog-iap-jwt-assertion` instead of `?reviewer=<uuid>`.
- Cloud Audit Logs give us a free who-touched-what trail.

**Downside / risks accepted (step 1):**

- External collaborators (e.g. an analyst contracted for a single cohort run) need a Workspace seat or a guest-IAM grant. We don't have many of those, but it's friction.
- The split internal service is a new deploy target; the CI pipeline gains a second `gcloud run deploy` step.
- RLS policies stay at `authenticated` — the GCP-level IAP boundary protects them, but a hypothetical auth-bypass anywhere upstream would have nothing left to enforce. Step 2 fixes this.

**Upside (step 2 / Firebase Auth):**

- Public account features unlock without an additional auth provider.
- RLS policies become defense-in-depth: even with a badly-configured Cloud Run service, the database itself enforces the team boundary via JWT claims.
- Per-tenant Resend recipients (G.4) becomes a clean SQL join.

**Downside / risks accepted (step 2):**

- Firebase Auth is a separate project in the GCP console (low cognitive cost, but it's a new piece of infra).
- Bridging Firebase ID tokens to Supabase RLS requires a small custom JWT signer (~1 day of work). Documented but not trivial.

## Related ADRs

- ADR-007 — Provenance record. The `reviewer` field on the provenance JSONB is currently `null`; step 1 populates it from the IAP-derived email.
- ADR-017 — Bidirectional review actions. The `reviewedBy: null` placeholder in `apps/web/app/(internal)/review/actions.ts` becomes the resolved reviewer UUID once step 1 is in place.

## Open questions

- Do we want to keep IAP forever (option B as the durable answer), and only add Firebase Auth for public account features (running them side-by-side)? That's actually a sensible middle path and worth considering before we commit to step 2 fully.
- Does the per-tenant Resend recipient story (G.4) require any tenant concept that IAP-only doesn't naturally provide? If so, step 2 is non-deferable; if not, IAP could be the long-term answer for team auth and Firebase only lights up if/when public accounts ship.
