# 008: Defer Wayback Machine archival from Phase 2 to Phase 5

**Status:** Accepted
**Date:** 2026-04-26

## Context

The Phase 2 plan (`docs/IMPLEMENTATION_PLAN.md`) listed "Archive source pages to Wayback Machine Save Page Now API" under Stage 1 — Scrape, alongside other in-flight scrape concerns (cache, guards, failure handling). The intent was to snapshot every scraped Tier-1 page at extraction time so the exact source the LLM read can be reproduced years later, even if the live URL has drifted or been removed.

While building out Phase 2, three observations changed the cost/benefit calculation:

1. **Archival has no consumer in Phase 2.** Nothing in the canary, scoring engine, review UI, or audit-phase2 script reads `archived_url`. The first consumer is the Phase 4 dashboard (provenance click-through to a Wayback snapshot when the live URL has changed since extraction) and the Phase 5 living-index pipeline (snapshotting the _changed_ page on diff detection so the before/after pair is preserved). There is no Phase 2 use case that makes archival immediately load-bearing.

2. **Save Page Now is slow and rate-limited.** Save Page Now responses routinely take 30–60s and the public endpoint imposes a soft per-IP rate limit. Calling it inline from the scrape stage adds noticeable latency to every canary URL; calling it fire-and-forget defers the latency cost but introduces an unmonitored failure path that we'd then need observability to track. Either pattern adds infra surface in Phase 2 with no Phase 2 payoff.

3. **Archiving every canary scrape pollutes the long-term archive.** Phase 2 includes throwaway runs against staging — bad URLs, near-empty pages, debugging iterations. Each archive request creates a permanent public snapshot at archive.org. Doing this only on the _first_ canonical scrape of a real source — which is the Phase 5 living-index moment — gives a cleaner archive history than a long tail of Phase 2 retry artifacts.

## Decision

Move the Wayback Machine Save Page Now integration out of Phase 2 (Stage 1 scrape) and into Phase 5, co-located with the living-index re-scrape and policy-change detection logic.

Concretely:

- The TODO at `packages/extraction/src/stages/scrape.ts:123` is no longer a Phase 2 deliverable.
- The Phase 2 line-item in `docs/IMPLEMENTATION_PLAN.md` is marked moved (🚚) rather than open (⬜).
- The new owner is the Phase 5 work: the same component that performs hash-diff detection on a re-scrape will, on detected change, archive the _new_ version of the page so the change diff is permanently preserved. The _previous_ version remains preserved by whichever earlier snapshot we made on the prior detected change (and the very first time, by the Phase 4 dashboard's first-publish hook — see below).
- For Phase 4 dashboard provenance click-through: until Phase 5 lands, "view archived version" links resolve to the existing live URL with a note. Once Phase 5 archival is in place, the dashboard switches to the archived URL stored on the most recent matching `scrape_history` row.

## Consequences

**Upside:**

- Phase 2 can close without taking on a slow, rate-limited external dependency that has no Phase 2 reader.
- Archival happens in the right architectural neighbourhood — alongside re-scrape diff and policy-change events — where the snapshot has both a producer and a consumer in the same execution path.
- Archive history is cleaner: snapshots correlate with policy-relevant change events rather than canary debugging churn.

**Downside / risks accepted:**

- Field values published in Phase 2 / Phase 3 lack a contemporaneous Wayback snapshot. If a Tier-1 source URL goes 404 between Phase 2 publication and Phase 5 archival, the source sentence in `provenance.sourceSentence` is the only surviving evidence — the URL itself becomes unverifiable. This is judged acceptable because (a) `sourceSentence` plus `contentHash` is sufficient for human re-verification when the URL still resolves, and (b) the Phase 2 cohort is small enough that re-scraping a handful of broken sources by hand during the Phase 4 cutover is tractable.
- Anyone reading the `IMPLEMENTATION_PLAN.md` Phase 2 list expecting Wayback archival to be live will be surprised. The Phase 2 line-item is changed from ⬜ to 🚚 with a pointer to this ADR to make the deferral explicit.

**Reversal cost:**

- Re-introducing Wayback archival in Phase 2 if priorities change is one new file (`packages/extraction/src/clients/wayback.ts`) plus a fire-and-forget call from `scrape.ts`. No data migration is required — the `scrape_history.archived_url` / `scrape_history.archived_at` columns can be added when needed.

## Related ADRs

- ADR-007 — Provenance record extended. The provenance JSONB shape does not depend on archival; deferring Wayback does not invalidate any field already published.
