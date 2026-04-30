# ADR-023 — Weekly maintenance scrape, archive-first design

**Status:** Accepted, 2026-04-30
**Phase:** 3.9 / PR D
**Supersedes:** the "Phase 3.6.2 / ITEM 6 (paused scaffold)" stub in `jobs/src/jobs/weekly-maintenance-scrape.ts`. Activates the loop now that the W0 archive + W11 hash short-circuit + W7 archive-snapshot fallback are in place.

## Context

`field_url_index` (migration 00012) gave us a query-friendly projection of every URL backing an approved or pending `field_value` row. The weekly maintenance loop was scaffolded against that view but left paused because:

1. There was no permanent record of what the previous scrape returned, so we couldn't tell "page hasn't changed" from "page changed and we need to re-extract." Every re-scrape would have triggered a full LLM batch.
2. There was no archived snapshot to fall back to when the live URL went dark, so a 404 could destroy provenance with no recovery path.
3. There was no per-attempt history (`extraction_attempts`) to record the maintenance check itself, so the audit trail would have been the field_values.extracted_at timestamp drifting on every rerun even when content was identical.

Phase 3.9 (PRs A–C) closed all three gaps. This ADR documents the resulting design and turns the job on.

## Decision

### Schedule

`schedules.task` with cron `0 3 * * 1` — every Monday at 03:00 UTC. Single weekly run is enough because:

- Government policy pages typically change in cycles measured in months, not days.
- More frequent re-checks would hit Stage 2 only on the rare changed page anyway (W11 short-circuit), so the marginal value is low and the extraction-cost variance is high.
- A single weekly run keeps the W8 telemetry clean (one row per URL per week) and prevents duplicate `policy_changes` entries.

The cron is set in code (not Trigger.dev dashboard) so changes flow through PR review.

### Loop body

```
for each (program_id, source_url) in field_url_index:
  - skip synthetic URLs (derived:, internal:, country-substitute:, world bank api)
  - resolve tier + geographic_level from sources
  - call scrape.execute([discoveredUrl], {programId, countryIso})
    - scrape.ts (PR A commit 3) writes archive + scrape_history
    - if content_hash matches last archived → result.unchanged = true
    - if 404 / connection error → result.contentMarkdown = ''
  - branch:
    - empty content → URL is broken; insert policy_changes row
      (severity='url_broken', previous_value_id=field_values.id) for /review.
    - unchanged → log + continue (W11 short-circuited LLM extraction).
    - changed → log + continue. Re-extraction is DEFERRED to a
      separate Trigger.dev job (extract-single-program in narrow
      mode for this URL's field set) so the maintenance loop's
      runtime stays bounded at HTTP fetch time.
```

### Cost shape (steady-state cohort, ~85 programmes × ~12 URLs = ~1000 URLs)

- ~95% unchanged (per typical government-page change rate): one HEAD + body fetch + hash compare + scrape_history insert. **~$0 LLM cost.**
- ~4% changed: archive write + scrape_history row. Re-extraction deferred to a follow-up job; **maintenance loop itself spends $0.**
- ~1% broken: same as unchanged but inserts a `policy_changes` row. **$0.**

Total maintenance run: ~$0 LLM + ~$1–2 in scraper Cloud Run minutes per week. Compares to ~$60–80/week if we full-canaried every URL.

### Why we DON'T re-extract changed pages inside the loop

Two reasons:

1. **Bounded runtime.** A Trigger.dev task with `maxDuration: 1800` (30 min) can comfortably do 1000 HTTP fetches. Adding even 10% re-extractions (100 × ~30s each) would blow the budget.
2. **Cost guard separation.** PR D commit 2 added `MAX_RERUN_COST_USD` to `canary-run.ts`. The maintenance loop should NOT inherit that guard implicitly — re-extraction is a deliberate analyst decision, surfaced via the `policy_changes` row + the `--mode narrow` canary the analyst kicks off after reviewing the change.

### Why severity is `'url_broken'` not `'breaking'`

`policy_changes.severity` is varchar(20) without a CHECK constraint. The `'url_broken'` literal is reserved for link-rot signal — distinct from `'breaking'` (a real policy change with material impact on score). UI surfaces them differently: `url_broken` is an analyst task ("find the new canonical URL"), `breaking` is a public-dashboard alert.

## Alternatives considered

- **Daily cadence.** Rejected — most pages change less than monthly; daily noise dilutes the signal and the LLM extraction cost on the rare actual change is the same regardless of detection latency.
- **Re-extract changed pages inline.** Rejected — see above; runtime + cost-control separation.
- **Use Wayback as the diff baseline instead of our own archive.** Rejected — Wayback Save Page Now is rate-limited and unreliable; our W0 archive is single-purpose, fast, and idempotent.

## Consequences

- The `'url_broken'` severity now flows through to `/changes` and (when surfaced) `/review`. Both already render policy_changes; no UI work needed.
- Trigger.dev project `proj_wqkutxouuojvjdzsqopp` will start logging weekly runs. First run on the next Monday after deploy.
- Extraction cost accounting needs a per-job-id breakdown when this ramps; not yet built. Tracked as a Phase 5 cost-dashboard item.
- If the Trigger.dev project ever exceeds its quota, the cron just stops firing — no cascading failure. The next manual canary picks up wherever the maintenance loop left off via the existing W11 short-circuit.

## References

- `jobs/src/jobs/weekly-maintenance-scrape.ts` — implementation
- `supabase/migrations/00012_field_url_index_view.sql` — input view
- `supabase/migrations/00014_phase_3_9_archive_attempts_prompts.sql` — archive + extraction_attempts schema
- ADR-007 — provenance shape backing the field_url_index projection
- ADR-008 — Wayback deferral rationale (kept; this loop replaces the active-archival role Wayback would have played)
