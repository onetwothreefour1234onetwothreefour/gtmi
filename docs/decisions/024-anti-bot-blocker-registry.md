# ADR-024 — Anti-bot blocker registry + Wayback-first routing + URL-merge filter

**Status:** ACCEPTED — 2026-04-30 (W15+W16); extended 2026-05-02 (W22).
**Supersedes:** none. Extends ADR-002 (Stage 0 URL discovery), ADR-015
(self-improving sources registry), ADR-008 (Wayback deferral — partially
walked back: Wayback is now used as a per-domain fallback, not yet as
the canonical archive).

## Context

The 2026-04-30 NLD HSM and JPN HSP canary re-runs exposed two
country-agnostic anti-bot patterns in cohort government domains:

1. **ISA** (`www.isa.go.jp`) serves the **same** 1595-char Japanese
   interstitial across every URL it owns — `/en/...`, `/jp/...`, HTML,
   PDF. The full HTML cascade (Playwright → curl_cffi → Jina → Wayback)
   returned identical bytes on every attempt. The W2 translation stage
   then translated the blocker text 8 times across 8 URLs. Coverage
   for JPN HSP came in at 18/48.
2. **IND** (`ind.nl`) serves the main HSM landing page as a thin SPA
   shell (~1k chars; the policy detail loads via JS the headless
   browser does not execute). Sub-pages on the same domain (`/forms`,
   `/normbedragen`) are mixed: some load thin, others are real.

These are not edge cases — every cohort run is one new
ISA/IND-style host away from a coverage cliff. We need a country-
agnostic mechanism to:

- detect anti-bot walls without baking domain knowledge into code,
- route around them on the current run,
- persist the detection so future runs (any country, any program) don't
  burn cost re-confirming what we already learned, and
- _stop_ the registry of past-good URLs from replaying blocked URLs
  back into the merged scrape set on every re-run.

## Decision

A three-part mechanism: **detect** (W15), **route around** (W16), and
**filter the registry** (W22). Country-agnostic by construction — the
domain hostname is the only input. Per-country data lives in the
auto-populated `blocker_domains` table.

### W15 — detect

`packages/extraction/src/utils/blocker-detect.ts` — `RunBlockerState`
class. Three OR'd signals over the per-run scrape history of a single
domain:

1. **`hash_equality`** — ≥2 distinct paths returning identical
   `content_hash`. Catches ISA-class blockers that serve the same
   bytes everywhere.
2. **`thin_fanout`** — ≥2 distinct paths returning thin content
   (< `MIN_VISIBLE_TEXT_LENGTH`) when the response was 200 OK.
   Catches IND-class SPA-shell blockers where each path renders a
   different but uniformly empty body.
3. **`challenge_fanout`** — ≥2 distinct paths hitting the existing
   `is_challenge_body` / `SCRAPE_THIN_CONTENT` marker. Catches
   Cloudflare-style cohort blockers.

All three signals share the SAME mechanism — they are different
observable manifestations of "this domain is hostile to headless
scraping." Country-agnostic by construction: the domain name and the
path-count are the only inputs; no per-country data.

The detector is stateful per-run (a new `RunBlockerState` is built per
canary; it never leaks across runs of different programs). On the
threshold-crossing observation, the canary writes a row to
`blocker_domains` and switches the rest of the same-domain URLs to the
Wayback layer.

### W16 — route around

`packages/extraction/src/stages/scrape.ts` — at the top of
`execute()`'s per-URL loop, the scraper checks
`isKnownBlocker(url)` against the registered blocker registry (cached
once per run). Hits route through `scrapeWaybackFirst()` instead of the
standard cascade. When Wayback returns empty (no useful snapshot), the
scraper falls back to the cascade — the registry never _prevents_ a
scrape, it only re-orders the cascade.

### W22 — filter the URL merger

`packages/extraction/src/utils/url-merge.ts` — `mergeDiscoveredUrls`
gains an optional `blockerDomains: ReadonlySet<string>` argument. When
non-empty, every entry whose hostname matches a flagged domain is
dropped **before** tier bucketing. Applies uniformly across registry /
proven / fresh / fieldProven origins. Country-agnostic; the hostname
is the only input.

Without W22, registry entries from a prior run on a now-known blocker
domain replay back into every merged URL set forever — they took up
9 of the 20 merged-URL slots on the second JPN run, displacing fresh
non-blocked URLs the new discovery hint had surfaced.

`scripts/canary-run.ts` loads `SELECT domain FROM blocker_domains` once
per run, lowercases into a `Set<string>`, and threads through to the
merger. A one-line `[Discovery merge] filtered against N blocker
domain(s)` log records the filter scope for audit.

### Persistent registry

Migration `00017_phase_3_9_blocker_domains.sql` creates the
`blocker_domains` table:

| column                    | type             | notes                                                                           |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------- |
| `domain`                  | TEXT PRIMARY KEY | lowercased hostname                                                             |
| `first_detected_at`       | TIMESTAMPTZ      | for audit                                                                       |
| `last_seen_at`            | TIMESTAMPTZ      | bumped on every re-detection via ON CONFLICT                                    |
| `detection_signal`        | VARCHAR(40)      | one of `hash_equality` / `thin_fanout` / `challenge_fanout` / `manual_override` |
| `detected_for_program_id` | UUID             | first program that triggered detection                                          |
| `notes`                   | JSONB            | path samples and content_hash at detection time                                 |

RLS: team write, public read — same shape as `sources`,
`scrape_history`, `discovery_telemetry`. **Empty seed by design.** The
table grows organically. An analyst can pre-emptively flag a domain
via `INSERT ... detection_signal = 'manual_override'`.

## Consequences

### Positive

- One execution of the JPN HSP canary auto-flagged `www.isa.go.jp` —
  zero analyst intervention. The detection is repeatable.
- Country-agnostic: the same code that flagged ISA today will flag any
  future hostile domain on first encounter, regardless of TLD or
  country context.
- W22 unblocks the merger: future re-runs spend their merged-URL
  budget on candidates that can actually produce content.
- The registry is auditable: every flag carries the program that
  triggered it and the signal that fired.

### Negative / accepted trade-offs

- A domain flagged once stays flagged forever (no auto-clearing). If a
  site fixes its anti-bot wall, an analyst must `DELETE` the row.
  Acceptable: false-positive cost is two slow Wayback fetches, while
  false-negative cost is full-cascade-failures-per-URL.
- Two distinct paths required to fire a signal. Single-page programmes
  with one URL would never trigger. Acceptable: those programmes are
  caught by the existing thin-content retry path (Fix C).
- Wayback may have no snapshots for the blocked URL. Mitigation: W16
  falls through to the cascade rather than failing hard, so the URL
  gets a chance even when Wayback is empty.
- The W22 filter applies uniformly to all origins; a fieldProven URL
  on a blocker domain is dropped despite having historically produced
  values for this exact field. Acceptable: if the domain became
  hostile, the prior values are now stale anyway.

## Validation

- `packages/extraction/src/__tests__/blocker-detect.test.ts` — 12
  cases covering all 3 signals + idempotency + country-agnostic
  verification across `.jp`/`.uk`/`.au` TLDs.
- `packages/extraction/src/__tests__/url-merge.test.ts` (W22 block)
  — 6 cases covering registry-origin drop, fresh-origin drop,
  passthrough on absent/empty set, case-insensitive hostname match,
  and substring-isolation (`isa.go.jp.example.com` is _not_ blocked
  when `www.isa.go.jp` is).
- 2026-05-01 production canary: `www.isa.go.jp` was added to
  `blocker_domains` with `detection_signal = hash_equality`. Second
  JPN canary on the same day logged `[Scrape] Known blocker domain —
routing https://www.isa.go.jp/... to Wayback first` for every ISA
  URL.

## Files

- `supabase/migrations/00017_phase_3_9_blocker_domains.sql`
- `packages/db/src/schema.ts` — `blockerDomains` table definition
- `packages/extraction/src/utils/blocker-detect.ts`
- `packages/extraction/src/stages/scrape.ts` — `isKnownBlocker`,
  `scrapeWaybackFirst`, `observeForBlocker`
- `packages/extraction/src/utils/url-merge.ts` — `blockerDomains`
  filter step
- `scripts/canary-run.ts` — registry load + merger threading
