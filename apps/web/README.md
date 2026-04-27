# @gtmi/web

Next.js 15 app for the Global Talent Mobility Index. Two surfaces:

- **Public dashboard** under `app/(public)/*` — `/`, `/programs`,
  `/programs/[id]`, `/methodology`, `/countries/[iso]`, `/changes`,
  `/about`. Renders against the live Supabase DB at request time
  (cross-request caching via `unstable_cache`).
- **Internal review queue** under `app/(internal)/review/*` —
  Supabase magic-link auth, gated by `middleware.ts`.

## Local development

```sh
# from the monorepo root
pnpm --filter @gtmi/web dev
```

Open <http://localhost:3000>. `DATABASE_URL` is loaded from the monorepo
root `.env`; copy `.env.example` and fill it in if you haven't already.

## Test, typecheck, lint

```sh
pnpm test         # all packages — vitest
pnpm typecheck    # all packages
pnpm lint         # all packages
```

Web-only:

```sh
pnpm --filter @gtmi/web test
pnpm --filter @gtmi/web typecheck
```

## Deployment

GitHub push to `main` → Cloud Build trigger `gtmi-web-main` →
Cloud Run `gtmi-web` (project `gtmi-494008`, region `europe-west1`).
See [`docs/runbook.md`](../../docs/runbook.md) for the full deploy
workflow, the trigger configuration, and the manual `apps/web/deploy.cmd`
fallback.

## Conventions

- All public-facing copy in `apps/web/content/*.md` — never hardcoded in
  components.
- Server queries that need unit testing extract pure helpers into a
  sibling `*-helpers.ts` file (see
  [`docs/conventions/server-helpers.md`](../../docs/conventions/server-helpers.md)).
- Pages that touch the DB declare `export const dynamic = 'force-dynamic'`
  because `DATABASE_URL` is a runtime-only secret in Cloud Run; the
  build container does not have it. See `app/(public)/page.tsx` for the
  reference comment.
- Every numeric data point on the public dashboard renders through a
  `<ProvenanceTrigger>` so users can see source URL + sentence + scrape
  time + confidence on hover.
- Pre-calibration scores carry a `<PreCalibrationChip>` on every score
  display — the chip is mandatory wherever a placeholder score appears.
