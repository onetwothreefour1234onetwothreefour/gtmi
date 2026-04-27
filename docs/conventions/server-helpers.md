# Convention: Server queries and the helpers extraction

**Status:** Convention adopted Phase 4.3, formalised here Phase 4.5.

## Problem

Server-side query modules in `apps/web/lib/queries/*` declare
`'server-only'` at the top of the file so that any accidental import
from a client component fails the build loudly rather than silently
shipping the database client into the browser bundle. Next.js, Drizzle,
and pino all play well with this pattern.

vitest (which runs in the Node test environment but resolves through
the same module graph) does **not** play well with `'server-only'`.
Importing a `'server-only'`-tagged module from a `*.test.ts` file
makes Vite's import-analysis plugin reject the import outright:

```
Failed to resolve import "server-only" from "lib/queries/foo.ts".
```

The result is that we cannot directly unit-test server query modules.

## Convention

Any server query module that needs unit-test coverage extracts its
**pure helpers** into a sibling `*-helpers.ts` file with no
`'server-only'` import. The query module then re-imports (and, where
useful, re-exports) those helpers; the test imports the helpers
directly.

### File layout

```
apps/web/lib/queries/
├── program-detail.ts            ← 'server-only', the query
├── program-detail-helpers.ts    ← pure helpers, no 'server-only'
├── program-detail-types.ts      ← shared types
└── program-detail.test.ts       ← imports from -helpers, never from the query
```

### What goes in `-helpers.ts`

Anything that does not touch the database client, environment
variables, the file system, or other side-effecting modules. In
practice this is:

- Pure data transforms (median, weighted sum, bucket aggregation,
  pillar grouping).
- Pure validators (status-shape checks, range clamps).
- Pure formatters that don't reach into request context.

### What stays in the query module

- `db.execute(sql\`...\`)` calls.
- `unstable_cache` wrappers.
- Anything reading `process.env`.
- The exported async `getX(...)` function the page consumes.

The query module imports the helpers and uses them inline; the test
imports the helpers directly and exercises them with synthetic input.

## Canonical example

`apps/web/lib/queries/program-detail-helpers.ts` is the pattern
reference:

```ts
// program-detail-helpers.ts — no 'server-only'
export function computeMedianPillarScores(cohort: PillarScores[]): PillarScores | null {
  /* … */
}

export function pillarContribution(pillarScore: number, pillarWeightWithinPaq: number): number {
  /* … */
}
```

```ts
// program-detail.ts — 'server-only'
import 'server-only';
import { computeMedianPillarScores } from './program-detail-helpers';
// re-export for callers that want to grep for the symbol in one place
export { computeMedianPillarScores } from './program-detail-helpers';
// …
```

```ts
// program-detail.test.ts — Node test env, no 'server-only' allowed
import { computeMedianPillarScores } from './program-detail-helpers';
// 11 tests run cleanly in vitest.
```

## Cross-references

The same pattern is in use across:

- `country-detail.ts` ↔ `country-detail-helpers.ts` (tax-treatment
  aggregation).
- `methodology-current.ts` ↔ `methodology-current-helpers.ts` (pillar
  grouping).
- `program-detail.ts` ↔ `program-detail-helpers.ts` (median +
  contribution).

`policy-changes.ts` does not yet have a `-helpers.ts` sibling because
its WHERE-clause builder is exercised in tests by re-deriving the same
shape inline. If the policy-change shape stabilises and we want
authoritative coverage, we should move the WHERE builder into a helper
file at that point.

## Why a lint rule is not (yet) appropriate

A `no-server-only-import` lint rule on `*.test.ts` would catch
violations after the fact but would not direct the author toward the
fix. The convention is small and easy to follow once known; a
`docs/conventions/` entry is the more useful onboarding surface.

If the rule becomes load-bearing at scale, a custom ESLint plugin can
flag `import 'server-only'` chains reaching `*.test.ts` files. Tracked
informally; not blocking any phase.
