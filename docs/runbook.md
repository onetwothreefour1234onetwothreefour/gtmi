# Runbook

Operational procedures for GTMI. Keep entries short and action-oriented.
When something here drifts from reality, update this file in the same PR
that changes the underlying behaviour.

---

## Deploying `apps/web` to Cloud Run

### Default path: push to `main` (auto-deploy)

A Cloud Build trigger named **`gtmi-web-main`** in project `gtmi-494008`,
region `europe-west1`, watches `^main$`. Any push that touches one of the
included paths (see below) fires a build → push → deploy pipeline against
the `gtmi-web` Cloud Run service.

You don't need to do anything other than `git push origin main`. Within
~1 minute Cloud Build picks the commit up; build + deploy takes ~6–7
minutes end to end.

**Watch progress**:
[Cloud Build → History](https://console.cloud.google.com/cloud-build/builds?project=gtmi-494008)
filtered to region `europe-west1`. The deploy step ends with a
`Service URL: https://gtmi-web-<hash>-ew.a.run.app` line.

**Verify it landed**:

```sh
# get the live service URL
gcloud run services describe gtmi-web \
  --region=europe-west1 --project=gtmi-494008 \
  --format='value(status.url)'

# hit a few public routes
curl -sI https://<service-url>/methodology   # expect 200
curl -sI https://<service-url>/programs      # expect 200
curl -sI https://<service-url>/sitemap.xml   # expect 200, includes per-program rows
```

### Trigger configuration (reproducible)

Configured via Cloud Console → Cloud Build → Triggers. If the trigger ever
needs to be recreated:

| Field                                   | Value                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Name                                    | `gtmi-web-main`                                                           |
| Region                                  | `europe-west1`                                                            |
| Description                             | `Deploy apps/web to Cloud Run on push to main`                            |
| Event                                   | Push to a branch                                                          |
| Source                                  | 2nd gen                                                                   |
| Repository                              | `onetwothreefour1234onetwothreefour/gtmi`                                 |
| Branch (regex)                          | `^main$`                                                                  |
| Configuration                           | Cloud Build configuration file (yaml or json)                             |
| Location                                | Repository                                                                |
| Cloud Build configuration file location | `apps/web/cloudbuild.yaml`                                                |
| Service account                         | Default Cloud Build SA (`<projectNumber>@cloudbuild.gserviceaccount.com`) |

**Included files filter** (paste into the trigger's "Included files filter"
field, one per line — this prevents a docs-only commit from firing a 6-min
Docker rebuild):

```
apps/web/**
packages/db/**
packages/scoring/**
packages/extraction/**
packages/shared/**
pnpm-lock.yaml
pnpm-workspace.yaml
package.json
.npmrc
```

These are exactly the paths the `apps/web/Dockerfile` reads in its `COPY`
steps, plus the lockfile.

### Service-account permissions

The default Cloud Build SA `<projectNumber>@cloudbuild.gserviceaccount.com`
needs:

- **Cloud Build Service Account** (default)
- **Cloud Run Admin** — to update the service in the deploy step
- **Service Account User** — to act-as the runtime SA during deploy
- **Artifact Registry Writer** — to push the image to
  `europe-west1-docker.pkg.dev/gtmi-494008/gtmi`
- **Secret Manager Secret Accessor** on the three build-time secrets
  (`gtmi-web-public-supabase-url`, `gtmi-web-public-supabase-anon-key`,
  `gtmi-web-public-app-url`)

The runtime SA `<projectNumber>-compute@developer.gserviceaccount.com`
needs **Secret Manager Secret Accessor** on the three runtime secrets
(`gtmi-web-database-url`, `gtmi-web-supabase-url`,
`gtmi-web-supabase-service-role-key`).

`apps/web/deploy.cmd` lines 18–30 grant these idempotently. If the trigger
fails with a permission error after a Cloud Console change, run
`apps\web\deploy.cmd` once locally to rebind.

### Fallback path: manual deploy

When the trigger is unavailable (GitHub App connection broken, Cloud
Console outage, urgent hotfix from a developer machine), use the manual
script:

```cmd
:: Windows, gcloud authenticated to gtmi-494008
apps\web\deploy.cmd
```

The script:

1. Verifies all 6 Secret Manager secrets exist.
2. Grants IAM bindings (idempotent).
3. Runs `gcloud builds submit --config apps\web\cloudbuild.yaml .` from
   the repo root, building **the working tree on this machine** (NOT
   `main` on GitHub). Useful for testing a branch without pushing first.
4. Prints the deployed service URL.

Same `cloudbuild.yaml`, same end state — just bypasses the trigger.

### Why every public DB-touching page is `dynamic = 'force-dynamic'`

`DATABASE_URL` is a **runtime-only** secret, mounted via `--set-secrets`
on the Cloud Run service. The build container never has it. This means
`next build → Generating static pages` cannot prerender any page that
runs a server query.

Every public page that touches the DB sets `export const dynamic =
'force-dynamic'` to skip build-time prerender. Cross-request caching is
preserved by `unstable_cache` wrappers inside `apps/web/lib/queries/*`
(1h TTL on programs/countries/methodology, 10min on policy-changes).

Routes that don't touch DB stay statically generated: `/about`,
`/preview-gallery`, `/robots.txt`, the default `(public)/opengraph-image.tsx`.

If a future commit adds a new server query to a static-by-default page,
add `export const dynamic = 'force-dynamic'` to that page or the build
will fail at the prerender step.

---

## Applying database migrations

GTMI's migration system is **not** `drizzle-kit migrate`. Per
[ADR-012](decisions/012-drizzle-kit-migration-mismatch.md), use the
formalised one-shot applier:

```sh
pnpm --filter @gtmi/scripts exec tsx apply-migration.ts <filename>

# example: apply 00007 from supabase/migrations/
pnpm --filter @gtmi/scripts exec tsx apply-migration.ts 00007_add_programs_long_summary
```

Requires `DIRECT_URL` (port 5432) in `.env` to bypass the Supabase
transaction pooler that silently blocks DDL. `DATABASE_URL` (port 6543)
is for runtime DML only.

After applying, verify the schema change with the appropriate diagnostic:

```sh
# new column on a table?
pnpm --filter @gtmi/scripts exec tsx check-programs-columns.ts

# new index, or specific column existence?
pnpm --filter @gtmi/scripts exec tsx check-fts-column.ts

# what migration tracking state is the live DB in?
pnpm --filter @gtmi/scripts exec tsx check-drizzle-state.ts
```

Migrations are applied to **staging only** by this script; there is no
production DB yet. Apply migrations before deploying code that depends on
the schema change.

---

## Reading scored programs / cohort sanity check

```sh
pnpm --filter @gtmi/scripts exec tsx check-scored-programs.ts
```

Prints a markdown table of every scored programme: country, name,
coverage, auto-approved + queued counts, PAQ / CME / Composite,
placeholder flag. Use to verify a canary run landed correctly or to
populate retrospective tables in the implementation plan.

---

## Verifying provenance integrity

```sh
pnpm --filter @gtmi/scripts exec tsx verify-provenance.ts
```

Read-only check that every approved `field_values` row carries the
13 always-required + 3 approved-only ProvenanceRecord keys per ADR-007.
Exits 1 on any miss — suitable for CI gating once we choose to wire it.

---

## Common operational scripts

| Script                                                                     | What it does                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/apply-migration.ts <filename>`                                    | Apply one SQL migration via DIRECT_URL with transaction.                                                                                                                                                                                                                         |
| `scripts/check-fts-column.ts`                                              | Verify migration 00006 (programs FTS) landed.                                                                                                                                                                                                                                    |
| `scripts/check-programs-columns.ts`                                        | List every column on `programs`.                                                                                                                                                                                                                                                 |
| `scripts/check-drizzle-state.ts`                                           | Inspect drizzle migration tracking state.                                                                                                                                                                                                                                        |
| `scripts/check-scored-programs.ts`                                         | Print scored-cohort table.                                                                                                                                                                                                                                                       |
| `scripts/check-programs-by-state.ts`                                       | Sample one program per state (scored / placeholder / unscored).                                                                                                                                                                                                                  |
| `scripts/verify-provenance.ts`                                             | ADR-007 provenance verifier (CI-friendly).                                                                                                                                                                                                                                       |
| `scripts/canary-run.ts --country <ISO3> [--programId <uuid>] [--mode <m>]` | Full 7-stage extraction canary. `--mode` ∈ `{full, discover-only, narrow, gate-failed, rubric-changed, field, archive-first, archive-only}` (W12). `--estimate-only` short-circuits before any LLM call. `--confirm-cost` overrides the `MAX_RERUN_COST_USD` guard (default $5). |
| `scripts/run-paq-score.ts --country <ISO3>`                                | Recompute and write a `scores` row.                                                                                                                                                                                                                                              |
| `scripts/compute-normalization-params.ts`                                  | Calibration helper (Phase 5 prereq).                                                                                                                                                                                                                                             |
| `apps/web/deploy.cmd`                                                      | Manual Cloud Run deploy fallback.                                                                                                                                                                                                                                                |

### Phase 3.10 operational paths

- **`/admin/blockers`** — internal-auth-gated route showing the live `blocker_domains` registry with manual-override insert + per-row clear. Requires Supabase magic-link login. Triggering programme links out to `/programs/[id]`.
- **Inspect blocker registry from CLI:** `pnpm --filter @gtmi/scripts exec tsx check.ts scored` (covers programme state, not blockers); raw access via `SELECT domain, detection_signal, last_seen_at FROM blocker_domains ORDER BY last_seen_at DESC;`.
- **Per-programme cost guard:** `MAX_COST_PER_PROGRAM_USD` (default 1.50). Aborts current programme on overrun without throwing; multi-programme batches keep moving. Override with `--confirm-cost`.
- **Backfill `programs.launch_year`:** `pnpm tsx scripts/seed-launch-years.ts --execute` (idempotent; default dry-run).
- **Manual `blocker-recheck` trigger:** Trigger.dev dashboard → tasks → `blocker-recheck` → "Test run". Dry-runs against the live registry; safety-net re-insert prevents registry loss on mid-run exception.

### Phase 3.9 operational paths

- **Inspect the blocker registry:** `SELECT domain, detection_signal, last_seen_at FROM blocker_domains ORDER BY last_seen_at DESC;`
- **Manual blocker override:** `INSERT INTO blocker_domains (domain, detection_signal) VALUES ('hostname', 'manual_override');` (lowercased hostname; `ON CONFLICT` updates `last_seen_at`).
- **Clear a blocker** (after a site fixed its anti-bot wall): `DELETE FROM blocker_domains WHERE domain = 'hostname';`
- **Estimate canary cost without burning tokens:** `pnpm tsx scripts/canary-run.ts --country JPN --programId <uuid> --estimate-only`. Reads the URL set, the active field set, and per-call cost from `cost-estimate.ts`; prints the projected total.
- **Re-extract from archive without re-scraping** (e.g. after a prompt edit): `pnpm tsx scripts/canary-run.ts --country JPN --programId <uuid> --mode archive-first` (or `archive-only` for strict — no live fallback).
- **Narrow re-run for the missing-fields set:** `pnpm tsx scripts/canary-run.ts --country JPN --programId <uuid> --mode narrow`.
- **Backfill `programs.launch_year`** (E.1.3 derive depends on it): `UPDATE programs SET launch_year = 2015 WHERE id = '...';`
- **Add a `program_policy_history` entry** for E.1.1 derive: edit `packages/extraction/src/data/program-policy-history.ts`, add events with severity buckets, commit. The derive picks it up on next canary.

---

## Coverage strategy in one paragraph

GTMI does not target 100% indicator coverage as a quality metric. The
realistic per-programme ceiling, post Phase 3.9, is now visibly bimodal:
programmes whose authority publishes substantively reachable content
(e.g. NLD HSM at 44/48) vs. programmes whose authority is captured by
the W15 anti-bot detector (e.g. JPN HSP at 23/48 — ISA's all-paths
wall). Of the 12 derived indicators, 9 publish without LLM extraction
on every cohort programme; the remaining 36 indicators carry the LLM
extraction risk. The credibility play is "publish only what we can
defensibly source, surface what's missing per programme, let the
reader apply their own credibility weighting" — not 100% coverage
with fudged values. The `insufficient_disclosure` flag (programs <70%
pillar coverage withheld from public ranking) is the safety net. Full
framing in [METHODOLOGY.md §7.5.1](METHODOLOGY.md). The Phase 3.10
wiring + readiness pass is sequenced in
[IMPLEMENTATION_PLAN.md §Phase 3.10](IMPLEMENTATION_PLAN.md) before
any mass-cohort scrape runs.

---

## Linked documentation

- [BRIEF.md](BRIEF.md) — canonical product specification
- [METHODOLOGY.md](METHODOLOGY.md) — scoring methodology
- [architecture.md](architecture.md) — current technical state
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — phase status
- [decisions/](decisions/) — ADRs, numbered
- [conventions/server-helpers.md](conventions/server-helpers.md) — the
  `'server-only'` + `-helpers.ts` extraction pattern
