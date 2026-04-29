# GTMI Implementation Plan

> **Last updated:** Session 12 — 28 Apr 2026. **Phase 3.6 closed (8 commits, branch `phase-3-recanary-prep`).** Self-improving sources table (ADR-015), V-Dem direct-API for E.3.1 (Fix A), C.3.2 country-substitute wiring (Fix B), scrape thin-content threshold + Jina escalation (Fix C), derived fields A.1.2 + D.2.2 (ADR-016 / Fix D), Tier 2 allowlist expansion to B.2.3 / B.2.4 / D.2.4 (Fix E). 401 tests passing across 28 test files; live-DB integration test for ADR-015 verified against staging. Re-canary pending (commit 8 is the documentation close-out; user signs off before push). **Phase 2 closed** — Session 9 close-out shipped: field-aware content windowing (utils/window.ts), Wave 2 enabled (ACTIVE_FIELD_CODES drives all consumers), HumanReviewStage provenance shape fixed, /review reject flow patched, ADR-008 (Wayback deferral to Phase 6). Session 10 polish: stale Tier-1 URLs refreshed, ATO sources added for AUS tax fields, 6 LLM_MISS prompts tuned. Both AUS and SGP canaries scored deterministically with `phase2Placeholder: true`. **Plan restructured:** Coverage maximization pulled forward as Phase 3 (before the 5-country pilot); 5-country pilot moves to Phase 5; Living Index becomes Phase 6; Scale and Enrichment becomes Phase 7.
> This document tracks the full build sequence for the Global Talent Mobility Index, combining the phase roadmap with methodology deliverables. Status is updated as work completes.

---

## Status key

| Symbol | Meaning     |
| ------ | ----------- |
| ✅     | Complete    |
| 🔄     | In progress |
| ⬜     | Not started |

---

## Phase 1 — Foundation

**Goal:** Establish the full monorepo, database schema, seed data, and pipeline scaffolding. Nothing runs end-to-end yet, but every interface and table exists.

### Infrastructure

- ✅ Monorepo scaffolded with pnpm workspaces and Turborepo
- ✅ TypeScript strict mode across all packages
- ✅ ESLint, Prettier, Husky pre-commit hooks configured
- ✅ Changesets configured for versioning
- ✅ Line endings enforced (LF via `.gitattributes`)
- ✅ Turborepo v2 upgrade and build fix
- ✅ GitHub Actions CI workflow (lint, typecheck, test on push/PR to main)
- ✅ `packages/db/drizzle.config.ts` connected to `DATABASE_URL` via `.env` (dotenv)
- ✅ `jobs/trigger.config.ts` connected to real project (`proj_wqkutxouuojvjdzsqopp`); `maxDuration: 900`; build config set

### Database

- ✅ Supabase staging project created (`gtmi-staging`, AWS ap-southeast-1)
- ✅ Supabase production project created (`gtmi-production`, AWS ap-northeast-2)
- ✅ All 13 core tables created with migrations
- ✅ Row Level Security (RLS) policies in place from day one
- ✅ Drizzle ORM schema covering all tables

### Seed data

- ✅ 30 countries seeded from IMD World Talent Ranking Top 30
- ✅ 85 programs seeded across 30 countries
- ✅ 85 Tier 1 government sources seeded
- ✅ 10 Tier 3 news signal sources seeded
- ✅ 48 field definitions seeded with weights and normalization functions
- ✅ Methodology unit test passing (weights sum to 1.0 at every level)

### Methodology baseline

- ✅ `METHODOLOGY.md` committed as canonical v1 specification
- ✅ `BRIEF.md` committed as canonical build specification v3
- ✅ D.3.4 Exit Tax Exposure dropped; weights redistributed (D.3.1 +6%, D.3.2 +4%)
- ✅ Final indicator count confirmed: 48

### Extraction package scaffold

- ✅ Anthropic client factory (`clients/anthropic.ts`)
- ✅ Firecrawl client factory (`clients/firecrawl.ts`)
- ✅ All 7 pipeline stage interfaces defined (`types/pipeline.ts`) — including `ScrapeStage` added in Phase 2
- ✅ Extraction, provenance, and pipeline types defined
- ✅ Trigger.dev stub job (`extract-single-program`) created

### Application scaffold

- ✅ Next.js 15 app scaffolding (Commit 5 — Szabi)
- ✅ `docs/architecture.md` with Mermaid diagrams (Szabi)
- ✅ CI green: lint, typecheck, migration dry-run (Szabi)

---

## Phase 2 — Extraction Canary — ✅ COMPLETE (tag `phase-2-complete`)

**Goal:** One program end-to-end. Australia Skills in Demand 482 Core Skills Stream through all pipeline stages, producing provenance records and a deterministic PAQ score. **Closed out across both AUS and SGP**, both scored deterministically with `phase2Placeholder: true`.

### Extraction prompts

- ✅ Write all 48 LLM extraction prompts (one per indicator, mapped to `field_definitions`)
- ✅ Each prompt must include: "If the page does not explicitly state this information, return an empty string. Do not infer, do not bridge from related fields, do not use general knowledge."
- ✅ Prompts committed to `field_definitions.extraction_prompt_md` in the database

### Stage 0 — URL Discovery [NEW]

- ✅ `GeographicLevel` type added (`global | continental | national | regional`)
- ✅ `DiscoveredUrl` type added (url, tier, geographicLevel, reason, isOfficial)
- ✅ `DiscoveryResult` type added (programId, programName, country, discoveredUrls, discoveredAt)
- ✅ `DiscoverStage` interface added to pipeline
- ✅ `ExtractionPipeline` updated to include `discover` as Stage 0
- ✅ `MODEL_DISCOVERY = 'claude-sonnet-4-6'` added as dedicated model constant
- ✅ All new types exported from package root
- ✅ Typecheck passing with zero errors
- ✅ Implement `packages/extraction/src/stages/discover.ts` — working Stage 0 code
- ✅ Wire Stage 0 into Trigger.dev job (`extract-single-program`)
- ✅ Discovery cap increased from 5 to 10 URLs per program (`.slice(0, 10)`)
- ✅ Discovery prompt extended: official-listing-page-first instruction, country-specific URL patterns (AU, UK, CA, SG, HK)
- ✅ Web search tool (`web_search_20250305`) enabled for Stage 0 — discovers via live search, not training knowledge
- ✅ URL verification: HEAD request for each discovered URL; 404 or 410 responses discarded before scraping begins
- ✅ Two-phase discovery: country-level sources pre-loaded from `scripts/country-sources.ts` before program-specific discovery
- ✅ Discovery prompt updated: prioritises field-data pages (salary, fees, occupation lists, processing times, family rights, PR pathways); deprioritises employer sponsorship, test provider, news, and consultation pages; results ranked by relevance with field-data reason
- ✅ Stage 0 source mix expanded to five named categories: (1) official govt/intergovernmental (up to 5, Tier 1), (2) global institutional (Tier 1), (3) immigration law/advisory firms (Tier 2), (4) independent visa/residency research publishers (Tier 2), (5) specialist immigration news/intelligence (Tier 2); tier rule (4) updated; explicit EXCLUSIONS block added
- ✅ Stage 0 switched from Claude (`web_search_20250305`) to **Perplexity API (`sonar` model, `PERPLEXITY_API_KEY`)**: `discover.ts` fully rewritten; identical prompt and five-category source mix; `MODEL_DISCOVERY` constant retained in `anthropic.ts` but unused by `discover.ts`

### Wave 1 field filter

- ✅ `scripts/wave-config.ts` created: `WAVE_1_ENABLED = true`, `WAVE_1_FIELD_CODES` (27 sub-factor codes: A.1.1, A.2.1, A.2.2, A.2.3, A.3.1, A.3.2, B.1.1, B.1.2, B.1.3, B.2.1, B.2.2, C.1.1, C.1.2, C.1.4, C.2.1, C.2.2, C.2.3, C.3.1, C.3.2, D.1.1, D.1.2, D.2.1, D.2.2, E.1.1, E.1.3, E.2.2, E.3.2)
- ✅ Canary run and Trigger.dev job both respect `WAVE_1_ENABLED` flag; rollback = one flag change

### Country-level source registry

- ✅ `scripts/country-sources.ts` created: 4 global sources (World Bank WGI, OECD Migration Outlook, IMD World Talent Ranking, Migration Policy Institute)
- ✅ `getCountryLevelSources(fieldKey)` helper filters sources by field key
- ✅ Country-level sources scraped once per country run and reused across all programs in that country

### Stage 1 — Scrape

- ✅ Implement Firecrawl scrape stage for each discovered URL ~~[replaced in Session 8]~~
- ✅ **Switched to custom Python/Playwright scraper service**: `scrape.ts` rewritten to call FastAPI service at `SCRAPER_URL` (default `http://localhost:8765`); `scraper/` directory created with `main.py`, `requirements.txt`, `README.md`; start with `uvicorn main:app --host 0.0.0.0 --port 8765`
- ✅ Store `ScrapeResult` per URL (content, SHA-256 hash, HTTP status, timestamp)
- ✅ Handle scrape failures loudly — Tier 1 throws, Tier 2/3 logs and returns empty result
- ✅ Scrape cache (`scrape_cache` table, 24h TTL, dedup by URL hash) — implemented in `packages/extraction/src/stages/scrape.ts`
- ✅ Scrape guards (`scrape-guards.ts`) — reject empty/HTML-error/anti-bot responses before they enter extraction
- 🚚 **Wayback Machine archival → moved to Phase 6** (co-located with re-scrape diff detection; archival of every canary scrape would pollute history)

### Stage 2 — Extract

- ✅ Implement `claude-sonnet-4-6` extraction for each field per scraped URL
- ✅ Output: `ExtractionOutput` per field (value, source sentence, character offsets, confidence)
- ✅ Model: `claude-sonnet-4-6` (via `MODEL_EXTRACTION` constant)
- ✅ Multi-URL merge logic: `executeMulti` runs sequentially across all Tier 1 scrapes (5000ms inter-scrape delay — increased from 2000ms); returns highest-confidence result with its source URL
- ✅ Extraction system prompt extended: handles bullet-point eligibility lists, condition blocks, numbered requirement lists, and table rows as explicit statements (not treated as missing)
- ✅ Extraction system prompt strict output format rules: numeric → base value only (min of range); categorical → 1–5 word label; text → 20-word max summary; count → integer only
- ✅ Rate-limit retry: 3 attempts on HTTP 429 with exponential back-off (60s × attempt); throws after 3 failures
- ✅ `stripJsonFences` improvement: fallback extracts first `{...}` JSON object if no code fences (handles model preamble text)
- ✅ Batch extraction: `executeBatch` extracts all fields for a single scrape in one LLM call (8K max-tokens, JSON array response); `executeAllFields` iterates batches across URLs and merges by highest confidence per field
- ✅ Extraction cache (`extraction_cache` table, keyed by sha256(contentHash + fieldKey + promptHash)); cache hits skip the LLM call entirely
- ✅ Early exit: `executeAllFields` stops scraping more URLs once every field is at confidence ≥ 0.9
- ✅ Inter-batch delay: 30s between URL batches (replaces old 25s per-field delay; sized for 8K-token batched calls)
- ✅ Coverage-gap sentinels: LLM-returned `not_found` / `not_addressed` for categorical fields are skipped at publish so absence is honest in scoring coverage math (`publish.ts:62-71`)
- ✅ Field-aware content-window selection — `packages/extraction/src/utils/window.ts` selects relevance-scored 2K chunks (200-char overlap, 1500/800-char baseline prefix/suffix) keyed on per-field labels within a 30K budget. Cache key carries `WINDOW_VERSION` for clean invalidation. Replaces `slice(0, 30000)` in both single + batch paths; redundant 30K cap in `scrape.ts` removed. 10 unit tests; post-fix TRUNCATION = 0 in `diag-empty-fields.ts`.

### Stage 3 — Validate

- ✅ Implement separate Claude call to verify source-sentence alignment
- ✅ Output: `ValidationResult` (isValid, validationConfidence, validationModel, notes)
- ✅ Independent confidence score from extraction confidence
- ✅ Early return on empty `valueRaw`: skip LLM call, return `isValid: false` / `validationConfidence: 1.0` immediately
- ✅ `stripJsonFences` improvement: fallback extracts first `{...}` JSON object if no code fences

### Stage 4 — Cross-check

- ✅ Implement Tier 2 source comparison (Fragomen or equivalent)
- ✅ Output: `CrossCheckResult` (agrees, tier2Url, notes)
- ✅ Log all disagreements
- ✅ Per-field Tier 2 source selection: cross-check scores each Tier 2 URL by keyword match against field label; global source from `scripts/country-sources.ts` used as fallback if no program Tier 2 matches field

### Stage 5 — Human Review

- ✅ Implement review queue logic
- ✅ Flag values where: extraction confidence < 0.85, validation confidence < 0.85, cross-check disagrees, PAQ delta vs previous > 5 points
- ✅ Human review dashboard functional (basic UI) — `apps/web/app/review` with Supabase magic-link auth, pending/recently-reviewed tabs grouped by country/program, source-sentence + confidence display on detail page, approve flow with re-normalization on edit. Deployed to Cloud Run via `Dockerfile` + `cloudbuild.yaml`.
- ✅ Reject flow on `/review/[id]` patched — form actions read row id from a hidden FormData input rather than closure binding (Next.js inline-action closures were unreliable across minor versions); approve/reject wrap their transactions in try/catch with `console.error` so silent failures surface in Cloud Run logs; reject reports row-update counts via `.returning()`.

### Stage 6 — Publish

- ✅ Approved values written to `field_values` with full provenance chain
- ✅ Provenance record includes: source URL, geographic level, source tier, scrape timestamp, content hash, source sentence, character offsets, extraction model, extraction confidence, validation confidence, cross-check result, reviewer, review timestamp, methodology version
- ✅ W-5: `maxDuration` increased to 900 in `jobs/trigger.config.ts`
- ✅ W-6: `MODEL_VALIDATION` and `MODEL_CROSSCHECK` constants added to `packages/extraction/src/clients/anthropic.ts`; validation and cross-check stages updated to reference their own constants
- ✅ W-2: `normalizeRawValue` normalization layer implemented in `packages/scoring/src/normalize-raw.ts`; publish stage calls it before writing `valueNormalized` to DB
- ✅ I-5: Unique constraint added on `field_values (program_id, field_definition_id)`; publish stage uses `onConflictDoUpdate` for idempotent re-runs
- ✅ Currency preservation: `detectCurrency()` (19 ISO 4217 codes + symbols) strips currency prefix before normalization; preserved in `provenance.valueCurrency` JSONB key — no schema change required (`packages/extraction/src/utils/currency.ts`, `publish.ts:74-85`)
- ✅ Backfill helper: `scripts/backfill-monetary-normalization.ts` re-normalizes pending_review rows whose valueNormalized was null because the currency prefix wasn't stripped pre-fix

### Bug fixes

- ✅ `validate.ts`: crash on character-offset mismatch converted to `console.warn` + safe return; field routed to human review queue instead of aborting pipeline run
- ✅ `publish.ts`: currency-formatted strings (e.g. `AUD3,210.00`) sanitized to numeric before normalization; NaN guard skips field with `console.warn` instead of throwing
- ✅ `publish.ts`: `normalizeRawValue` call fixed to pass `rawAsString` (string) instead of `_numericValue` (number); `normalizeRawValue` expects `string` and calls `.replace()`/`.trim()`/`.toLowerCase()` directly on the input — passing a number caused a runtime crash
- ✅ `extract.ts` + `validate.ts`: `stripJsonFences` improved to extract first `{...}` JSON object from unstructured text (handles models that emit explanatory preamble before JSON)

### Scoring engine

- ✅ `packages/scoring` created (`engine.ts`, `score.ts`, `normalize.ts`, `types.ts`, `index.ts`)
- ✅ Deterministic scoring engine: indicator → sub-factor → pillar → PAQ
- ✅ Three normalization schemes implemented: min-max, z-score, categorical rubric
- ✅ Missing data penalty: `(present / total)^0.5` multiplier at sub-factor level
- ✅ Programs below 70% data coverage on any pillar flagged "insufficient disclosure"
- ✅ Unit test: byte-identical re-runs given same inputs — 99 tests passing (6 methodology + 67 scoring engine + 26 normalize-raw)
- ✅ PAQ score produced for Australia Skills in Demand 482 Core Skills Stream — `scripts/run-paq-score.ts --country AUS` writes to `scores` table, idempotent via `onConflictDoUpdate(programId, methodologyVersionId)`. Score row tagged `metadata.phase2Placeholder = true` because normalization params are engineer-chosen, not calibrated
- ✅ Calibration helper: `scripts/compute-normalization-params.ts` derives p10/p90 per min_max field from live `field_values` distribution; outputs paste-ready TS snippet. Designed to run once ≥5 programs are scored (Phase 3 blocker)

### Canary script (`scripts/canary-run.ts`)

- ✅ Per-field progress logging: `[N/48] Processing field: key — label`
- ✅ Discovered-URL listing after Stage 0 with tier and geographic level
- ✅ Extraction wrapped in `try/catch`: malformed responses skip the field with a log line instead of crashing the run
- ✅ Per-field 25s delay after extraction to stay within API rate limits (increased from 3s — multi-scrape inputs push close to 30K token/min limit)
- ✅ Step-by-step logging: extracted value preview, validation result, cross-check outcome, auto-approval decision
- ✅ Summary table at end of run: URLs discovered/scraped, fields extracted/approved/queued
- ✅ `--country AUS|SGP` CLI argument: runs independently per country
- ✅ Commands: `pnpm --filter @gtmi/db exec tsx ../../scripts/canary-run.ts --country AUS` / `--country SGP`
- ✅ Phase 1 WGI pre-fetch: `fetchWgiScore(countryArg)` called once per run before field loop
- ✅ E.3.2 special handling: bypasses LLM extraction; uses pre-fetched World Bank API score; `extractionModel: 'world-bank-api-direct'`; auto-approved at confidence 1.0
- ✅ Cross-check bypassed: Stage 4 hardcoded to `not_checked` / `agrees: true` in canary (all sources merged into extraction inputs; Trigger.dev job retains proper cross-check)
- ✅ Tier-2 fallback: after batch extraction across tier-1 + global sources, missing fields are retried against tier-2 sources in a second batch; partial fills logged per field (`canary-run.ts:312-346`)
- ✅ Two-phase scrape: global/country-level sources scraped once and reused; program-specific URLs scraped per program (`canary-run.ts:56-103`)

### Canary verification

- ✅ AUS canary run complete: 27/48 fields attempted (Wave 1), 14 fields extracted values, 13 fields returned no value (content truncation at 30K chars), 0 auto-approved (all queued for human review). Issues identified: Tier 2 cross-check source mismatch (fixed), content truncation for salary/education/stability fields, currency not yet preserved in fee fields.
- ✅ Currency preservation in `publish.ts` (stored in `provenance.valueCurrency` JSONB)
- ✅ AUS PAQ score produced + idempotent + flagged `phase2Placeholder` (calibration deferred to Phase 3)
- ✅ Human review dashboard functional (basic UI) — see Stage 5 section above
- ✅ Wave 1 (27 fields) + Wave 2 (21 fields) — full 48-field coverage active via `WAVE_2_ENABLED = true`
- ✅ Singapore S Pass canary run — 34/48 fields populated (70.8%); verifier passed
- ✅ Content window strategy for fields truncated at 30K chars — field-aware windowing shipped (CO-1)
- ✅ Provenance records verified end-to-end — `scripts/verify-provenance.ts` asserts 13 required + 3 approved-only keys per ADR-007

### Phase 2 close-out (Sessions 9–10 — completed)

All open items required to declare Phase 2 complete have shipped. Below is the historical record of the close-out work.

- ✅ **CO-1: Field-aware content windowing** — `packages/extraction/src/utils/window.ts` selects relevance-scored 2K chunks (200-char overlap) keyed on per-field labels, with a 1500-char baseline prefix and 800-char baseline suffix. Replaces the blanket `slice(0, 30000)` in `extract.ts` (single + batch paths). Cache key carries `WINDOW_VERSION` for clean invalidation. Redundant 30K cap removed from `scrape.ts`. 10 unit tests covering answer-near-end, answer-near-start, multi-field batch, no-keyword fallback, ellipsis emission.
- ✅ **CO-2: Wave 2 enable** — `WAVE_2_FIELD_CODES` (21 codes) added to `wave-config.ts` alongside `WAVE_1_FIELD_CODES`; canonical export is `ACTIVE_FIELD_CODES = WAVE_1 ∪ (WAVE_2_ENABLED ? WAVE_2 : [])`. All four consumers (`canary-run.ts`, `extract-single-program.ts`, `run-paq-score.ts`, `diag-empty-fields.ts`) switched. Canary now processes 48 fields end-to-end.
- ✅ **CO-3: AUS canary + provenance verifier** — `scripts/verify-provenance.ts` generalises the read-only audit (any country or program id, with status filtering). Asserts the 13 always-required + 3 approved-only keys per ADR-007; exits 1 on any miss. AUS canary post-polish: 30 of 48 fields populated, all rows from this run have complete provenance.
- ✅ **CO-4: SGP canary + verifier** — S Pass canary: 34 of 48 fields populated (71%, vs AUS 62.5%); SGP government pages are denser/more direct. Verifier passed on all rows produced by the run; 2 orphan rows from a pre-fix run remain (deliberately left in place pending separate cleanup, mirroring the AUS C.2.3 orphan decision).
- ✅ **CO-5: Calibration attempt + scoring** — `compute-normalization-params.ts --programs AUS,SGP` returned only 4 numeric fields with any approved observations; 3 had n=1 (degenerate min=max). Cohort too thin to swap in — calibration deferred to Phase 3 once ≥5 programs are scored. AUS and SGP both scored with existing engineer-chosen ranges, both tagged `phase2Placeholder: true` so downstream consumers cannot publish. Deterministic across re-runs (idempotent via `onConflictDoUpdate(programId, methodologyVersionId)`).
- ✅ **CO-6: Reject flow patched** — `apps/web/app/review/[id]/page.tsx` form actions now read `id` from a hidden FormData input rather than relying on closure binding (Next.js inline-action closures have been finicky across minor versions). Both approve and reject wrap their transactions in try/catch with `console.error` so silent failures surface in Cloud Run logs. Reject reports row-update counts via `.returning()` to make no-op updates obvious.
- ✅ **CO-7: Phase 2 closeout doc + ADR-008** — this header bump; ADR-008 Wayback deferral committed at `docs/decisions/008-defer-wayback-archival-to-phase-5.md` (deferred to Phase 6 in restructured plan). Tag `phase-2-complete` to be applied with this commit.

#### Phase 2 retrospective

**Final canary outcomes (deterministic, all `phase2Placeholder: true`):**

| Program                                       | Coverage (extraction) | Auto-approved | Queued | PAQ   | CME   | Composite |
| --------------------------------------------- | --------------------- | ------------- | ------ | ----- | ----- | --------- |
| AUS Skills in Demand 482 – Core Skills Stream | 30/48 (62.5%)         | 6             | 24     | 13.72 | 22.53 | 16.36     |
| SGP S Pass                                    | 34/48 (70.8%)         | 6             | 28     | 18.11 | 24.14 | 19.92     |
| CAN Express Entry – Federal Skilled Worker¹   | 23/48 (47.9%)         | 3             | 20     | 11.36 | 34.49 | 18.30     |

¹ **CAN added after Phase 2 close-out.** The original Phase 2 close-out (Sessions 9–10) shipped with AUS + SGP only. CAN Express Entry was scored during Session 11 against the same Phase 2 pipeline and the same engineer-chosen normalisation params — added to the cohort here because the program-detail page (Phase 4.3) and the country-detail page (Phase 4.4) both render it. Its lower coverage (47.9%) reflects a smaller canary run, not pipeline regression. Calibration in Phase 3 will replace the placeholder normalisation across all three.

All three flagged `insufficient_disclosure` because pillars C and D have no auto-approved fields without manual /review action — expected at this cohort size. Scoring ingests only `status='approved'`, so coverage of 6/48 (or 3/48 for CAN) in the score reflects the auto-approval threshold (extraction + validation confidence ≥ 0.85 on both), not pipeline failure.

**Empty-field distribution on the post-polish AUS run** (per `diag-empty-fields.ts`):

- ABSENT (~15 fields): data genuinely not on discovered Tier-1 sources. Largest sub-clusters are tax fields (D.3.x — Stage 0 didn't surface ATO for the 482 program; the new ATO sources we wired in for SGP-style country-level discovery still required 2 programs and 1 LLM batch each), family detail (C.2.x — visa-conditions page is JS-gated, only 383 chars reach extraction), policy stability (E.1.1, E.3.1 — Tier-3 news-signal source not yet integrated; V-Dem direct-API stage not yet built).
- LLM_MISS (~6 fields): keywords appeared in scraped content but extraction returned empty. Tuned 6 prompts (A.1.2, B.3.1, C.2.1, D.2.2, D.2.4, E.1.1) with recall hints — modest recovery on subsequent runs.
- TRUNCATION (0 fields): the windowing fix did its job; no field is now blocked purely by 30K-char truncation.

**Three concrete carry-overs into Phase 3 / source ops:**

1. **URL drift is a recurring tax on Tier-1 coverage.** Two AUS URLs and two SGP URLs were 0-char soft-404s in this round — comments at `country-sources.ts` line 32 and 175 dated their last validation 4 days before the run. A simple monthly HEAD-check job in Trigger.dev would surface drift before it costs a canary run. Defer to Phase 5 living-index work or schedule sooner if Phase 3 fans out before that lands.
2. **Calibration needs ≥5 programs.** `compute-normalization-params.ts` is honest about this. The 5-country pilot in Phase 3 (AUS, HKG, GBR, CAN, SGP — plus secondary programs per country) reaches the threshold. Phase 3 should run the calibration script as its first scoring step and replace the engineer-chosen ranges in `run-paq-score.ts` before any non-placeholder scores are persisted.
3. **Auto-approve rate is a methodology lever, not a pipeline metric.** The 12.5% scoring coverage is a direct consequence of the 0.85/0.85 dual-confidence threshold combined with the `not_addressed` / `not_found` sentinel skip. Tightening prompts (Phase 3 work) lifts confidence; loosening the threshold trades it for false positives. The /review queue is the relief valve — Phase 4 dashboard scope assumes a working reviewer cadence to populate the bottom 80% of the score.

**Wave 2 caveat:** `WAVE_2_ENABLED = true` is set in code. The Trigger.dev `extract-single-program` job picks up `ACTIVE_FIELD_CODES` from `wave-config.ts` at runtime — production scope changes the moment Trigger.dev redeploys. If staged rollout to production is needed, flip `WAVE_2_ENABLED` to `false` before the Trigger.dev deploy and back to `true` once verified.

**Operational scripts shipped:**

- `scripts/verify-provenance.ts` — read-only verifier, exit-code semantics for CI.
- `scripts/sync-prompts-from-seed.ts` — one-shot push of `methodology-v1.ts` `extractionPromptMd` into live `field_definitions`. Use whenever the seed is updated.
- `scripts/purge-orphan-pending.ts` — delete pending_review rows with incomplete provenance (typically pre-fix orphans). Dry-run by default.

---

## Phase 3 — Coverage Maximization

**Goal:** Push extraction coverage from the current 30–34/48 baseline (AUS, SGP, CAN canaries) toward the 42–44/48 realistic ceiling before running the full 5-country pilot. Every improvement shipped here is reused across all subsequent country runs.

### Coverage strategy

The realistic per-programme ceiling is **42–44/48**, not 48/48. The remaining 4–6 indicators are either methodology gaps (the indicator we defined doesn't correspond to data anyone publishes) or country-specific transparency gaps (e.g. Bahrain, Saudi Arabia, UAE don't publish admission statistics in any structured form; E.2.1 is permanently null for those countries). The credibility play is "publish only what we can defensibly source, surface what's missing per programme" — not 100% coverage with fudged values. The `insufficient_disclosure` flag (programs <70% coverage on any pillar are excluded from public ranking) is the safety net.

Phase 3 ranks the five work-streams below by leverage. Sub-phases are intended to ship in order; each is independently useful even if a later one slips.

### Phase 3.1 — V-Dem direct-API — ✅ COMPLETE (Session 12 / Phase 3.6 commit 3)

**Unlocks**: E.3.1 (Rule of law) cohort-wide, deterministic confidence 1.0. Mirrors the World Bank API direct-fetch already shipped for E.3.2 in Phase 2.

- ✅ V-Dem fetcher in `scripts/country-sources.ts`: `fetchVdemRuleOfLawScore(iso3)` calling World Bank WGI Rule of Law (`RL.EST`) — methodology line 309 explicitly accepts "V-Dem / World Bank WGI"; same fetch shape as E.3.2 (`GE.EST`).
- ✅ Wired into canary Phase 1 alongside `fetchWgiScore`; mirror in Trigger.dev `extract-single-program`
- ✅ E.3.1 published with `extractionModel: 'v-dem-api-direct'`, auto-approved at confidence 1.0
- ✅ Gated on `PHASE3_VDEM_ENABLED` (default-on per analyst Q5 decision; `.env.example` flipped to `true`)
- ✅ When flag is `'false'` or fetch returns null, E.3.1 falls through to LLM extraction (legacy)
- ✅ 9 vitest tests covering gate semantics + fetcher-skip-when-disabled

### Phase 3.2 — Cross-departmental discovery audit

**Unlocks**: D.3.x tax fields (cohort-wide), E.2.x transparency fields (cohort-wide). Today Stage 0 (Perplexity) gets pulled toward the immigration authority page; the methodology actually requires sources from multiple government departments per programme.

- ⬜ Per-country "expected source departments" registry: immigration authority, tax authority, statistics bureau, gazette/parliamentary record, regional/state where federal devolves authority
- ⬜ Discovery prompt rewritten to enumerate the cross-departmental set explicitly, not just rank URLs
- ⬜ Validation step in `discover.ts`: if no URL from an expected department appears, re-prompt with the missing-department hint
- ⬜ Country-source registry expansion (`scripts/country-sources.ts`) — analogous to the AUS-ATO addition in Phase 2 close-out, but systematic across the cohort: tax authority + statistics bureau per country
- ⬜ Re-canary AUS, SGP, CAN with the expanded registry; expect coverage to land at 35–38/48 per programme

### Phase 3.3 — Cohort-wide prompt sweep

**Unlocks**: ~2–4 LLM_MISS fields per programme (keywords present in scraped content, model returned empty). Six prompts got recall hints in Session 10 polish; the remaining 42 haven't had a serious revision pass since Phase 1.

- ⬜ Run `scripts/diag-empty-fields.ts` after each Phase 3.2 re-canary; bin empty fields into TRUNCATION / LLM_MISS / ABSENT
- ⬜ For each LLM_MISS field, examine scraped content + current prompt + model response → identify the recall failure pattern
- ⬜ Update prompt in `packages/db/src/seed/methodology-v1.ts`, sync to DB via `scripts/sync-prompts-from-seed.ts`, re-canary the affected programmes
- ⬜ Iterate until LLM_MISS converges to 0 across the cohort
- ⬜ Document recurring failure patterns as a prompt-engineering reference for future indicator additions

### Phase 3.4 — Tier 2 backfill methodology revision (ADR-013)

**Unlocks**: ~2–3 fields per programme where Tier 1 truly has nothing but Tier 2 sources (Fragomen, KPMG, etc.) cover the gap. Today the methodology forbids Tier 2 from populating fields directly; this is the editorial-design conversation about whether to relax that rule.

- ⬜ Draft ADR-013: scope of Tier 2 backfill — which indicators (probably outside the scoring core; C.2.x family rights nuances, B.3.3 appeal-process clarity, et al.), how it surfaces in provenance (`sourceTier: 2` flag visible to readers)
- ⬜ Methodology working session — Szabi + Ayush — review which indicators are genuinely Tier-1-only versus which can defensibly accept Tier 2
- ⬜ Methodology v3 release with the per-indicator Tier 2 allowlist
- ⬜ Extraction stage: enable Tier 2 fallback for the allowlisted indicators (the multi-URL extraction code already supports it; just an indicator-level config change)

### Phase 3.5 — Methodology v2 indicator review (ADR-014)

**Unlocks**: 2–4 indicators that don't correspond to publishable data anywhere. Three response options per indicator: drop and re-normalize sub-factor weights; restructure as boolean ("does this country publish at all?"); or country-level cohort substitution (similar to E.1.1's Stability Edge Case).

- ⬜ Audit every indicator that returns `not_addressed` or `not_found` on >50% of the cohort post-3.2 + 3.3
- ⬜ For each, decide: keep, drop, restructure, or country-substitute
- ⬜ ADR-014 captures the per-indicator decision with rationale
- ⬜ Methodology v2.0.0 published; weights re-normalized; `methodology_versions` row added; existing scores keep their v1 stamp (no retroactive recomputation per dispatch §14)
- ⬜ Re-canary the cohort under v2 to produce v2-tagged scores for direct comparison

### Phase 3.6 — Re-canary prep + self-improving discovery — ✅ COMPLETE (Session 12, branch `phase-3-recanary-prep`, 8 commits)

**Trigger.** The Phase 3 AUS re-canary surfaced that fields populated in earlier runs went empty when Stage 0 (Perplexity) returned a different URL set on the second run — discovery is non-deterministic across runs. Combined coverage across runs was 37/48 for AUS Skills in Demand 482 — Core Skills Stream pre-fix; 11 fields remained empty (9 ABSENT + 2 LLM_MISS). Six work-streams ship in Phase 3.6 — five country-agnostic fixes + a structural change to make Stage 0 self-improving.

- ✅ **Commit 1 — Migration 00010** (3d4779b): bundled three concerns approved together (per ADR-012 single-file convention). (a) `sources` schema additions: `last_seen_at`, `discovered_by`, `geographic_level`; replaced `UNIQUE(url)` with `UNIQUE(program_id, url)` per analyst Q1. (b) Methodology v2 column reconciliation — migration 00009 had updated `methodology_versions.normalization_choices` JSONB but not `field_definitions.normalization_fn`; now aligned for C.3.2 → `country_substitute_regional` and B.2.3/B.2.4/D.1.3/D.1.4 → `boolean_with_annotation`. (c) Tier 2 allowlist expansion to B.2.3, B.2.4, D.2.4 (C.2.1 excluded per Q2). 10 shape tests pass.
- ✅ **Commit 2 — C.3.2 country-substitute verification** (14b3187): integration test pinning the canary's `executeCountrySubstitute` dispatch filter; live-DB verification query confirms the post-migration column values. 4 tests pass.
- ✅ **Commit 3 — V-Dem direct-API for E.3.1** (f766cb1): `fetchVdemRuleOfLawScore` mirrors the E.3.2 WGI pattern (World Bank `RL.EST`); gated on `PHASE3_VDEM_ENABLED` (default-on per Q5); falls through to LLM batch when the flag is `'false'` or the fetch returns null. 9 tests pass.
- ✅ **Commit 4 — Scrape thin-content threshold + Jina escalation** (566fd78): `MIN_VISIBLE_TEXT_LENGTH` raised 300 → 1500 (the AUS Medicare URL returned 484-char redirect-stub content and silently passed the old guard); `scrape.ts` now retries once with `force_layer: 'jina'` on `short_content`; Python scraper accepts `force_layer` body parameter. **DEPLOYMENT NOTE (in commit body):** `scraper/main.py` must be redeployed to Cloud Run before any re-canary, otherwise `force_layer=jina` is silently ignored. 5 tests pass.
- ✅ **Commit 5 — Country median wage + FX + citizenship-residence static tables + ADR-016 drafted** (e05c750): three hand-curated 30-cohort lookup tables. OECD AAW primary for OECD members, ILOSTAT mean-earnings fallback for non-OECD per Q3. `check-median-wage-coverage.ts` live-DB gate. ADR-016 status: Proposed → analyst review. 11 tests pass.
- ✅ **Commit 6 — Stage 6.5 Derive (ADR-016 APPROVED)** (ed77be9): pure deterministic computation of A.1.2 (salary as % of local median wage) and D.2.2 (total years to citizenship). Zero LLM calls (verified via grep). `extractionConfidence` hard-coded to 0.6 — never auto-approves; always routes to /review. `publish.executeDerived` writes `pending_review` rows preserving the full provenance including the `derivedInputs` JSONB extension. `<ProvenanceTrigger>` popover renders a "Computed from:" block when `derivedInputs` is present. 24 tests pass (22 derive + 2 provenance-trigger).
- ✅ **Commit 7 — Self-improving sources table (ADR-015)** (6fc0d12): `discover.ts` write-back (cache-hit + cache-miss paths) — every verified URL upserted with `discovered_by='stage-0-perplexity'`, never downgrade tier on conflict. `mergeDiscoveredUrls` utility deduplicates by normalised URL, orders Tier 1 → Tier 2 → Tier 3 with quotas (7/4/1) and cap 12. `loadProgramSourcesAsDiscovered` filters to `tier IN (1,2)` AND `last_seen_at > NOW() - INTERVAL '90 days'` AND `programs.status='active'`. Both `canary-run.ts` and `extract-single-program.ts` invoke the merge step at the same insertion point via the shared utility. **Live-DB integration test** runs against staging DIRECT_URL: writes test-marker URLs against a real AUS program, asserts run-2 sources are a superset of run-1 sources, cleanup verified zero residue. 24 tests pass.
- ✅ **Commit 8 — Documentation close-out** (this commit): IMPLEMENTATION_PLAN, architecture, BRIEF, METHODOLOGY updated; ADR-015 finalized as APPROVED; ADR-016 status verified.

### Phase 3.6.1 — Closure pass — ✅ COMPLETE

Post-Phase-3.6 AUS canary closed at 44/48 (45/48 after the ITEM 1 rollup-classifier fix). Three closure commits landed: (a) D.2.3 derived-knowledge from `country-citizenship-policy.ts`; (b) Cloud Run scraper auth Option B via `gcloud auth print-identity-token`; (c) provenance shape verifier; (d) broken-provenance purge of pre-ADR-014 rows. Gate ≥42/48 met.

### Phase 3.6.2 — Maintenance mode + gap closure (Session 13, single commit, branch `phase-3-recanary-prep`)

**Trigger.** AUS at 45/48 (post-rollup-fix) — three structural gaps remained: B.2.4 (mandatory non-government costs), D.1.3 (PR-accrual physical presence), D.1.4 (PR retention rules). All three are country-deterministic per ADR-013/014 research; the right shape is a derive path against a static lookup table, not another Tier 2 fallback round.

Scope (single commit "feat(pipeline): Phase 3.6.2 — maintenance mode, precision re-run, provenance pre-loading, weekly scrape scaffold, gap closure toward 48/48"):

- **ITEM 1 — Rollup classifier fix.** `scripts/audit-empty-fields-rollup.ts` now classifies synthetic rows (country-substitute-regional, derived-knowledge, derived-computation, v-dem-api-direct, world-bank-api-direct) as POPULATED. Surfaces AUS at 45/48 instead of 44/48.
- **ITEM 2 — Country-level derives for B.2.4 / D.1.3 / D.1.4.** New static lookup tables `country-non-gov-costs.ts` and `country-pr-presence.ts` (30-country cohort each, header-noted as analyst-reviewable). `deriveB24` / `deriveD13` / `deriveD14` mirror the D.2.3 pattern (derived-knowledge, confidence 0.7, routes to /review). All three added to `DERIVED_FIELD_KEYS` so the LLM batch never produces a competing low-confidence row.
- **ITEM 3 — `PHASE3_TARGETED_RERUN` mode.** When set, Stage 0 receives a precision brief listing still-missing indicator labels, the FULL registry is excluded (lifts the 20-URL slice cap), and LLM extraction is filtered to missing fields only. Default `false`. The derive stage runs regardless of the flag — gap closure is not flag-dependent.
- **ITEM 4 — Dynamic URL cap.** `dynamicUrlCap(populatedFieldCount)` returns 20 / 15 / 12 by coverage band (<30 / 30–41 / ≥42). `dynamicTierQuotas(cap)` scales the 60/30/10 Tier-1/2/3 ratio proportionally. Replaces the hard-coded `DEFAULT_URL_CAP=15` in canary-run + extract-single-program.
- **ITEM 5 — Provenance-based URL pre-loading.** `loadProvenUrlsForMissingFields(programId, countryIso, missingKeys)` returns URLs that produced approved rows for the SAME field key in OTHER programs in the SAME country. Cross-country contamination prevented by `programs.country_iso = $countryIso` filter. The merge layer treats these as a third origin (registry → proven → fresh; fresh wins on conflict).
- **ITEM 6 — Migration 00012 + weekly-scrape scaffold.** New `field_url_index` view joins `field_values` + `field_definitions` + `programs` for URL-centric queries. `weekly-maintenance-scrape.ts` registered as a Trigger.dev v3 task but PAUSED (no `schedules.task` block) — Phase 5 activates with cron `0 3 * * 1`. `policy_changes.severity` accepts `'url_broken'` (column is `varchar(20)` no CHECK; type-side widening only).
- **ITEM 7 — Documentation.** This entry, plus architecture and METHODOLOGY notes for the new derive paths.

**Phase 3.6 final test totals (`pnpm test`):**

- `@gtmi/scoring`: 155 / 7 files passed
- `@gtmi/extraction`: 116 / 11 files passed (was 25 pre-Phase-3.6; +91 across 6 new files)
- `@gtmi/web`: 130 / 10 files passed (+2 from Phase 3.6 / commit 6)
- **Total: 401 / 28 files passed.**

### Phase 3 close-out target

After 3.1–3.5, expected per-programme coverage **42–44/48** (43 average). Gate for Phase 5 (5-country pilot): every canary programme (AUS, SGP, CAN) must reach ≥42/48 before Phase 5 begins. Phase 5 then extends this improved pipeline to GBR and HKG. Programmes still flagged `insufficient_disclosure` are by-design exclusions, not pipeline failures.

**Pre-Phase-3.6 baseline (AUS Skills in Demand 482 — Core Skills Stream):** 37/48 POPULATED, 9 ABSENT, 2 LLM_MISS. The AUS re-canary on the new pipeline (post commit-7 + scraper redeploy) is the gate measurement; expected to land at or above the 42/48 floor for the canary programmes.

### Operational artefacts shipped during Phase 3 (running list)

- `scripts/check-source-departments.ts` — diagnostic that lists expected vs discovered source departments per country.
- `scripts/audit-empty-fields-rollup.ts` — extends `diag-empty-fields.ts` to roll up TRUNCATION/LLM_MISS/ABSENT counts across the cohort.
- `scripts/country-median-wage.ts` — 30-country lookup for A.1.2 derivation (OECD primary, ILO fallback). Phase 3.6 / commit 5.
- `scripts/fx-rates.ts` — annual-average LCU-per-USD for cohort currencies. Phase 3.6 / commit 5.
- `scripts/country-citizenship-residence.ts` — years-as-PR before naturalisation; null for no-pathway countries (GCC monarchies). Phase 3.6 / commit 5.
- `scripts/check-median-wage-coverage.ts` — live-DB pre-canary gate; asserts both lookup tables cover every cohort country with `is_primary=true` Tier 1 sources. Phase 3.6 / commit 5.
- `packages/extraction/src/utils/url-merge.ts` — dedupe + tier-ordered merge of fresh Stage 0 results with the sources-table registry. Phase 3.6 / commit 7.
- `packages/extraction/src/stages/derive.ts` — Stage 6.5; pure deterministic computation of A.1.2 and D.2.2. Phase 3.6 / commit 6.
- `scripts/phase3-wipe-discovery-cache-aus.ts` — one-off reset for AUS re-canary preparation.

---

## Phase 4 — Public Dashboard

**Goal:** Interactive public-facing web dashboard. Every data point shows provenance on hover.

### Phase 4.1 — Foundation — ✅ COMPLETE (Session 11, pushed)

- ✅ Theme tokens (editorial palette, pre-calibration amber, sequential score scale, 5-pillar palette with C-pillar shifted to `#5C8A9B`), self-hosted fonts via `next/font/google` (Fraunces / Inter / JetBrains Mono), border-radius rules, editorial type scale, container max-widths.
- ✅ Dark mode via `next-themes` (system / light / dark cycle), reduced-motion respected globally.
- ✅ `(public)` and `(internal)` route groups; `/review` moved into `(internal)/review/*` via `git mv`; URLs unchanged.
- ✅ Public layout shell (sticky 60px top nav with skip-to-content, 3-column footer).
- ✅ GTMI primitives in `apps/web/components/gtmi/`: `ScoreBar`, `PreCalibrationChip`, `CoverageChip`, `CompositeScoreDisplay`, `PillarMiniBars`, `PillarRadar`, `WeightSlider`, `MethodologyBar`, `ProvenanceTrigger` (defensive ADR-007 read with "Provenance incomplete" fail-loud chip), `ProvenanceHighlight`, `PolicyTimeline` (mocked + empty), `EmptyState`, `DirectionArrow`, `SectionHeader`, `DataTableNote`, `ThemeToggle`.
- ✅ ADR-007 schema TypeScript types and `readProvenance()` defensive reader (`apps/web/lib/provenance.ts`).
- ✅ Vitest tests: `score-bar.test.tsx` (15) + `provenance-trigger.test.tsx` (15). Wired into CI through the existing `pnpm test` / `turbo run test` matrix.
- ✅ `/preview-gallery` internal harness (robots-disallowed, not linked) renders every primitive in every state.

### Phase 4.2 — Rankings + Programs Index — ✅ COMPLETE (Session 11)

- ✅ **Migration 00006**: `programs.search_tsv` generated tsvector column (name weight A + description_md weight B) with GIN index. Hand-authored SQL because Drizzle does not support `GENERATED ALWAYS … STORED` or `tsvector`.
- ✅ **ADR-011**: Postgres FTS over Algolia/Typesense for the Phase 4 corpus.
- ✅ Query layer at `apps/web/lib/queries/`: `types.ts` (denormalised UI shapes), `search.ts` (`sanitiseSearchInput`, `buildTsQuery`, `buildSearchPredicate`, `buildSearchRank`), `ranked-programs.ts` (single round-trip with two LATERAL subqueries; cached via `unstable_cache` with tag `programs:all`), `filters-from-url.ts`.
- ✅ `RankingsTable` with 8-column dispatch §9.1 layout, three row states (scored / unscored / pre-calibration), sortable column headers, FLIP-based row reorder via `framer-motion`, advisor-mode client recompute via `recomputePaq()` (composite stays 0.3*CME + 0.7*PAQ).
- ✅ `RankingsFilters` — country multi-select, region/category chip groups, score-range numeric inputs (0–100, step 0.5), scored-only checkbox, debounced (300ms) FTS search input, reset link, selected-country chip row.
- ✅ `AdvisorModeToggle` + `RankingsExplorer` orchestrator. Filters/sort sync to the URL; advisor weights stay client-only.
- ✅ `/` (landing) and `/programs` (paginated, PAGE_SIZE=50) routes consume the explorer with server-rendered initial state derived from URL params.
- ✅ Editorial copy in `apps/web/content/`: `landing.md`, `preview-banner.md`, stub `programs/{aus-skills-in-demand-482-core,sgp-s-pass}.md` for the 4.3 narrative panel. `lib/content.ts` renders Markdown → HTML via `remark`.
- ✅ Vitest tests: `lib/queries/search.test.ts` (17 — sanitisation, parameterisation, SQL-injection guard, dialect render shape), `lib/advisor-mode.test.ts` (13 — proportional rebalance math + recomputePaq).
- ✅ `apps/web/next.config.ts` loads the monorepo-root `.env` so RSC database queries see `DATABASE_URL` in dev (Cloud Run injects directly via Secret Manager).

### Phase 4.3 — Program detail — ✅ COMPLETE (Session 12)

- ✅ Migration **00007** (numbered after 00006 FTS rather than 00005 — supabase/migrations/ already had a gap-free 00001…00006 sequence): `programs.long_summary_md` + `long_summary_updated_at` + `long_summary_reviewer`. Applied via `scripts/apply-migration.ts` per ADR-012; verified via the new `scripts/check-programs-columns.ts` diagnostic.
- ✅ **ADR-010**: columns on `programs` over a separate `program_narratives` table, with explicit promotion conditions (multilingual, narrative versioning, polymorphic narratives) for the next ADR.
- ✅ `lib/queries/program-detail.ts` — single-payload server-only query that joins programs ↔ countries ↔ latest scores ↔ field_definitions LEFT JOIN field_values ↔ sources ↔ policy_changes (RLS gated on `summary_human_approved=true`) ↔ cohort. `unstable_cache`-wrapped, tagged `program:[id]` and `programs:all`. Cohort median extracted to `program-detail-helpers.ts` so tests can import without `'server-only'`.
- ✅ Program detail page at `app/(public)/programs/[id]/page.tsx` covers all three states:
  - Scored: `<CompositeScoreDisplay>` + `<PillarComparison>` (radar + breakdown table + compare-to dropdown) + `<SubFactorAccordion>` with all 15 sub-factors.
  - Pre-calibration: same layout + chip on composite + per-indicator + page-level explanatory banner.
  - Unscored: header + program metadata + `<EmptyState>` "Awaiting Phase 3 scoring" + government source list + "Summary forthcoming" placeholder.
- ✅ `<ProvenanceTrigger>` accessible from every numeric data point in the indicator drilldown, with the ADR-007 schema (13 always-required + 3 approved-only + `valueCurrency` + `stabilityEdgeCase`) and the disabled Wayback-link affordance per ADR-008.
- ✅ `<PolicyTimeline>` reads from `detail.policyChanges` (returns `[]` in Phase 4 because the table is empty + RLS gated). Empty-state copy renders today; Phase 5 lights up automatically with zero code change.
- ✅ Editorial summary panel: prefers `programs.long_summary_md`, falls back to `apps/web/content/programs/<countryIso-lower>-<slug>.md` stubs. Comment-only stubs resolve to "" via `loadContent`'s HTML-comment strip so the "Summary forthcoming" placeholder renders gracefully.
- ✅ Vitest tests this phase (+21 new):
  - `lib/queries/program-detail.test.ts` (11) — `computeMedianPillarScores` + `pillarContribution` math.
  - `components/gtmi/indicator-row.test.tsx` (10) — currency, missing-value branch, pre-calibration chip gating, direction arrow, ProvenanceTrigger accessibility.
- ✅ Live verification against the staging DB:
  - `/programs/e1687f65-…` (AUS, placeholder) → 200, full layout with all 15 sub-factor rows.
  - `/programs/b72e8153-…` (SGP, placeholder) → 200, same composition; cohort dropdown surfaces AUS + CAN.
  - `/programs/011dd295-…` (UAE Golden Visa, unscored) → 200, EmptyState + sources list + Summary forthcoming placeholder.

### Phase 4.4 — Methodology + country + changes + about — ✅ COMPLETE (Session 13)

- ✅ `/methodology` auto-rendered from `methodology_versions` + `field_definitions`. Eight numbered sections in the dispatch order: What GTMI measures, Composite structure (with the live `<MethodologyBar>`), The 5 pillars (per-pillar rationale + per-sub-factor weight + per-indicator row), Normalization, Data integrity, Sensitivity analyses, What GTMI does not measure, Versions. Live verification: 48 indicators / 5 pillars / 15 sub-factors / version v1.0.0 all render against the staging DB.
- ✅ `/countries/[iso]` country detail with header (region, IMD rank, IMD Appeal score with Phase 3 chip when null), per-country mini rankings table reusing the score-bar / coverage-chip / pillar-mini-bars / pre-calibration-chip primitives, Phase 5 stability empty-state, tax-treatment summary aggregating D.3.2 + D.3.3 across the country's programmes (with "Data not yet collected" placeholder), MAX(extracted_at) "Last verified" footer. Live verification: AUS / SGP / CAN render fully; OMN (unscored) renders the unscored state.
- ✅ `/changes` page with disabled filter UI (severity / country / pillar / date range) and `<EmptyState>` Phase 5 copy. `getPolicyChanges` runs a real RLS-gated SELECT against `policy_changes` (returns `[]` today; Phase 5 lights up automatically).
- ✅ `/about` page rendering `apps/web/content/about.md` via remark.
- ✅ Vitest tests this phase (+27 new):
  - `lib/queries/methodology-current.test.ts` (9) — pillar grouping, sub-factor sort, weight attachment, 48-indicator round-trip.
  - `lib/queries/country-detail.test.ts` (9) — tax-treatment aggregation, approved-only filter, whitespace trimming, total preservation.
  - `lib/queries/policy-changes.test.ts` (9) — WHERE clause shape, parameterisation, SQL-injection guard, empty-array filter drop.
- ✅ Markdown stubs shipped (analyst will edit before public launch): `methodology/{intro,normalization,data-integrity,sensitivity,whatGTMIMeasuresNot}.md`, `pillars/{A,B,C,D,E}.md`, `changes-empty.md`, `about.md`.
- ✅ No new dependencies. Phase 4.4 ships purely on the existing remark + Drizzle + postgres-js stack.

### Phase 4.5 — Polish — ✅ COMPLETE (Session 14, tag `phase-4-complete`)

- ✅ Country flags: 30 cohort flag SVGs vendored from MIT-licensed flag-icons into `apps/web/public/flags/`. `<CountryFlag iso countryName? size?>` primitive renders via `next/image`; falls back to a globe glyph for unknown ISOs. Wired into rankings table, country header, program detail header, and selected-country chip row.
- ✅ Open Graph image generation: 1200×630 images via `@vercel/og` library on Cloud Run runtime. Default `app/(public)/opengraph-image.tsx`, per-program `app/(public)/programs/[id]/opengraph-image.tsx` (composite + CME/PAQ + pillar mini-bars), per-country `app/(public)/countries/[iso]/opengraph-image.tsx` (rank, IMD score, programmes-scored). Pre-calibration suffix on placeholder programmes.
- ✅ SEO foundation: `app/sitemap.ts` dynamically generated from `programs` + `countries`; `app/robots.ts` already disallowed `/preview-gallery` and `/review/*` from Phase 4.1; `<JsonLd>` server-component primitive emitting `schema.org/Dataset` records on `/programs/[id]` (with composite/CME/PAQ as `variableMeasured`) and `/countries/[iso]` (with `spatialCoverage`); `metadataBase` + `applicationName` + per-route canonical/OG/Twitter via `generateMetadata` on detail pages.
- ✅ Accessibility pass: 16 vitest-axe smoke tests (`components/gtmi/a11y.test.tsx`); fixes for `aria-prohibited-attr` on `<DirectionArrow>` and `<CountryFlag>` fallback (added `role="img"`); removed `title` on `next/image` (redundant with `alt`); `<PillarRadar>` now emits a sr-only data-table alternative; `RankingsTable` reads `useReducedMotion()` and disables FLIP layout reordering when prefers-reduced-motion is set; semantic landmarks (`<main>`, `<nav>`, `<article>`, `<section>`) and skip-to-content already in place since Phase 4.1; `:focus-visible` ring (2px accent) inherited from globals.css.
- ✅ Performance: `generateStaticParams()` on `/programs/[id]` and `/countries/[iso]` so Next pre-renders every cohort row at build time; `dynamicParams = true` for runtime-render fallback on unknown ids; ISR (revalidate=3600) unchanged. Self-hosted fonts via `next/font/google` (Fraunces/Inter/JetBrains Mono) confirmed shipping. Recharts and framer-motion lazy-loaded behind `'use client'` boundaries.
- ✅ Structured logging: `lib/logger.ts` (pino, JSON output, severity-mapped to Cloud Logging severities, `service: 'gtmi-web'` base, ISO 8601 timestamps, `LOG_LEVEL` env-configurable). First consumer: `app/sitemap.ts` failure path. No `pino-pretty` — production and dev both emit JSON.
- ✅ Server-helpers convention documented: `docs/conventions/server-helpers.md` formalises the `'server-only'` + `-helpers.ts` extraction pattern that's used in four query modules (program-detail, country-detail, methodology-current; policy-changes still uses the inline test-fixture mirror).
- ✅ Cloud Run deployment validation: Dockerfile inspection — no changes needed for Phase 4.5 surfaces (`public/flags/*.svg` ships via the existing public-dir COPY; new routes auto-included by `pnpm --filter @gtmi/web build`; new deps resolve from `apps/web/package.json` in the deps stage). `docker build` not run from this sandbox (Docker Desktop daemon not running). Compile + lint + typecheck all green via `pnpm` directly; the same code paths run inside the Docker build.

**Phase 4 complete.** Tag suggestion: `phase-4-complete` at this commit.

---

## Phase 4 Redesign — Editorial visual layer

**Goal:** Replace the Phase 4 visual layer entirely with the editorial design captured in [docs/design/](design/). Five independently shippable phases (A → E). The data layer (`apps/web/lib/queries/*`), routing, scoring, and component logic stay intact. Plan: [REDESIGN_PLAN.md](../REDESIGN_PLAN.md).

> Phase 4.1's `MethodologyBar` and `ThemeToggle` are **superseded** by this redesign. `MethodologyBar` is replaced by `<SplitSpecimen>` + `<PillarsSpecimen>` and is removed in Phase B / D when its `(public)` page consumers get rewritten. `ThemeToggle` is shimmed to a no-op in Phase A and deleted in Phase B when `(public)/layout.tsx` is rebuilt.

### Phase 4-A — Token layer + primitives — ✅ COMPLETE

- ✅ Replaced shadcn HSL token system with the design's flat hex palette in `apps/web/app/globals.css` (`--paper`, `--paper-2`, `--paper-3`, `--ink`, `--ink-2..5`, `--accent` oxblood, `--navy`, `--positive`, `--warning`, `--negative`, `--pillar-a..e` warm-cool spectrum). Shadcn variable names (`--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--ring`, `--border`, etc.) retained as compatibility aliases pointing at the design tokens — Radix primitives unchanged.
- ✅ Added editorial class atoms verbatim from `docs/design/styles.css`: `.serif`, `.serif-tight`, `.mono`, `.eyebrow`, `.rule` family, `.dropcap`, `.peer-note`, `.btn` family, `.chip` family, `.score-bar`, `.num`, `.num-l`, `.paper-grain`, `.hatch`, `table.gtmi`.
- ✅ `apps/web/tailwind.config.ts` flattened from `hsl(var(--…))` → `var(--…)`. Added `colors.ink.{2,3,4,5}`, `colors.paper.{2,3}`, `colors.rule.{soft}`, `colors.navy.{DEFAULT,2,soft}`, `colors.positive`, `colors.warning`, `colors.negative`, `colors.accent.{2,soft}`, plus `fs-display/h1/h2/h3/body/small/micro` to match the design's px-fixed scale. `darkMode` removed.
- ✅ `apps/web/lib/theme.ts`: `PILLAR_COLORS` switched to the warm-cool spectrum; `ACCENT_DEEP_TEAL` renamed to `ACCENT_OXBLOOD = '#B8412A'`; `PRE_CALIBRATION` collapsed to a single light-only object.
- ✅ Fonts switched from Inter → Inter Tight via `next/font/google`. `apps/web/app/layout.tsx` no longer wires `ThemeProvider`; `<html>` lost `suppressHydrationWarning`.
- ✅ Dark mode dropped (analyst Q2). `next-themes` removed from `apps/web/package.json`; `components/theme-provider.tsx` deleted; `components/theme-toggle.tsx` shimmed to a no-op for back-compat with the Phase 4.1 `(public)/layout.tsx` import (deleted in Phase B). All `dark:` Tailwind variants stripped from `provenance-trigger.tsx`. `vitest.setup.ts` matchMedia stub kept (Radix uses it).
- ✅ New primitives shipped under `apps/web/components/gtmi/`:
  - `Sparkline` + `deterministicTrend(seedKey, composite)` (Q7 placeholder until score history matures).
  - `SpecimenPlate` (full-bleed editorial divider; tones: paper-2 / paper-3 / ink / navy).
  - `SectionPlate` (chapter-style title plate with oxblood numeral; tones: ink / navy / paper-3).
  - `MarginNote` (italic Fraunces gutter annotation; default navy, accent override).
  - `SplitSpecimen` (30/70 SVG donut + side legend; oxblood PAQ arc, navy CME arc).
  - `PillarsSpecimen` (5-letter typographic poster reading methodology v1 weights; pillar labels mapped to Access/Process/Rights/Pathway/Stability per Q1).
- ✅ Existing primitives restyled: `ScoreBar` (rule-soft track, hard corners), `PreCalibrationChip` (chip-amber atom), `CoverageChip` (default percent format; fraction available; `data-low-coverage`), `PillarMiniBars` (6px-wide bars per design's PillarMini), `CompositeScoreDisplay` (paper-2 plate; serif numeral; PAQ/CME below thin rule), `PillarRadar` (oxblood program polygon, ink-4 dashed median, navy compare), `CountryFlag` (mono ISO-box fallback per design), `PolicyTimeline` (chip atoms for severity, serif summary), `ProvenanceHighlight` (oxblood underline on highlight), `SectionHeader` (`.eyebrow` + `.serif`), `EmptyState` (paper-2, dashed rule), `DataTableNote` (italic Fraunces, oxblood left rule).
- ✅ `MethodologyBar` retained for back-compat (consumed by `(public)/page.tsx` + `(public)/methodology/page.tsx` which Phase A is forbidden to touch). Annotation in `components/gtmi/index.ts` flags it for deletion in Phase B / D.
- ✅ `app/preview-gallery/page.tsx` rewritten — every new + restyled primitive in every state (typography, palette, atoms, sequential color scale, sizes, sparkline trend variants, all four ProvenanceTrigger states, all three SectionPlate tones, both SpecimenPlate tones).
- ✅ Tests added: `sparkline.test.tsx` (10), `specimen-plate.test.tsx` (10), `specimen-charts.test.tsx` (4), `coverage-chip.test.tsx` (6), plus 7 new a11y smoke cases for Sparkline / SpecimenPlate / SectionPlate / MarginNote / SplitSpecimen / PillarsSpecimen.
- ✅ `pnpm turbo run typecheck` 7/7 green; `pnpm turbo run test` workspace-wide: 533 tests passing (web 166 / scoring 164 / extraction 203). Web baseline grew 130 → 166 (+36 net new).
- ✅ Live verification on `/preview-gallery`: HTTP 200, 308 KB rendered, all 42 component markers present, zero `next-themes` references in HTML, zero `dark:` variant occurrences.

### Phase 4-B — Landing + Rankings — ✅ COMPLETE

- ✅ Public layout shell rebuilt (`apps/web/app/(public)/layout.tsx`): replaces the Phase 4.1 sticky-60px header + 3-column footer with the editorial `<TopNav>` (rankings underline marker, methodology vocabulary in copy) and full-bleed `<GtmiFooter>` (4 nav columns, primary-source strip, legal row). `lastVerifiedAt` is read from the cohort-stats query at the layout level so the footer's "Last refresh" line is live; the same query result is reused by the landing page (single round-trip via `unstable_cache`).
- ✅ Three new layout-shell primitives shipped: `TopNav`, `GtmiFooter`, `PreviewBanner` (composes `<PreCalibrationChip>`; renders the canonical body or an HTML override).
- ✅ Landing page (`apps/web/app/(public)/page.tsx`) rewritten end-to-end:
  - `<HeroLanding>` — large Fraunces headline with oxblood italic "actually" emphasis (the only word that gets the accent treatment), dek paragraph in Inter Tight, "Browse the rankings →" + "Read the methodology" CTAs, 30/70 split block reading live `cmePaqSplit` from `getMethodologyCurrent()`.
  - **Live-computed stats strip** — five DB-derived cells: programmes-active (`COUNT(*) WHERE status='active'` from `programs`), indicators (`COUNT(*)` from `field_definitions` — not hardcoded 48), source documents (`COUNT(*)` from `sources`), provenance coverage (averaged `approved field_values / 48` per program with at least one extraction), last-updated (`MAX(extracted_at)`). All five values are real per the analyst's "no fabricated numbers" decision.
  - `<ThisEdition>` — 3 most-recent approved policy changes with composite-impact deltas in oxblood/positive-green. Phase 4 reality: `policy_changes` is empty (RLS-gated on `summary_human_approved=true`), so the section renders the design-aligned empty state directly — no mock fallback.
  - `<WorldMap>` — dot-matrix scoring map with hand-laid coordinates extracted from `screen-rankings-v2.jsx` to `apps/web/lib/data/world-map-coordinates.ts` (40 dots across 17×12 grid). Country-level top-scoring composite drives quintile colour; out-of-cohort dots render muted. SVG is `role="img"` with an aria-label.
  - `<SpecimenPlate>` (Plate I, paper-3 tone) wrapping `<PillarsSpecimen>` reading live methodology weights (per Q1, methodology pillar labels — Access/Process/Rights/Pathway/Stability — replace the design's editorial labels).
  - `<EditorsQuote>` — full-bleed dark editorial standfirst with drop-cap.
  - `<ProvenanceProof>` — paper-2 specimen-style exhibit of one indicator's primary source, rendered with `<mark>` highlighting + char/page/sha256/scrape grid.
  - Programme rankings table at the bottom of the landing page (same explorer the dispatch uses on `/programs`).
- ✅ Rankings page (`apps/web/app/(public)/programs/page.tsx`) rewritten: `<PreviewBanner>` + Fraunces "All programmes." header + dek + the same `<RankingsExplorer>` paginated at 50/page + closing `<DataTableNote>`. No `(internal)` files touched.
- ✅ `<RankingsFilters>` refactored to the design's chip-strip + disclosure model (Q4): "All categories" + per-facet category chips front-of-stage, country/region/score-range/search/scored-only behind a "More filters" disclosure. Active-advanced-filter count badge on the toggle. Search debounce, URL state sync, and reset all retained.
- ✅ `<RankingsTable>` rebuilt against the design's `table.gtmi` atom: hairline rules, uppercase header eyebrow, mono numerals, Fraunces programme names, country flag inline with name, sparkline column reading `deterministicTrend(programId, composite)` per Q7 (placeholder until score history matures; disclosure note in `<DataTableNote>` below the table), oxblood wash on the leader row (`rgba(184,65,42,0.04)`), Pre-cal / Scored / Awaiting status chips. FLIP layout reorder via `framer-motion` retained with `useReducedMotion()` opt-out.
- ✅ `<AdvisorModeToggle>` restyled to the editorial vocabulary (hairline border, eyebrow rule, ink-paper switch); slider grid behaviour unchanged.
- ✅ New cohort-stats query (`apps/web/lib/queries/cohort-stats.ts`): five live aggregates in parallel, cached via `unstable_cache` (10min TTL, tag `programs:all` so a publish-stage `revalidateTag` refreshes it). `NULLIF` guards divide-by-zero on an empty cohort. `toInt` / `toFloat` coerce postgres-driver string-or-number returns.
- ✅ World-map coordinates extracted to `apps/web/lib/data/world-map-coordinates.ts` (40 entries + `compositeQuintile` function + `QUINTILE_COLORS` map + `MUTED_DOT_COLOR`). Pure data + small helper, hermetically testable.
- ✅ OG image redesigned (`apps/web/app/(public)/opengraph-image.tsx`): warm-paper background with paper-grain radial gradients, oxblood eyebrow rule + uppercase "Global Talent Mobility Index" tracking, large serif headline with italic oxblood "actually" matching the live hero, 30/70 split visual strip at the bottom, TTR Group attribution. Edge runtime + system-serif fallback (Fraunces over a `next/font/google` resource at edge runtime is a follow-up — visual language and accent land regardless).
- ✅ `MethodologyBar` deleted (Q10). `apps/web/app/(public)/methodology/page.tsx` was minimally amended to swap the single `<MethodologyBar>` consumer for `<SplitSpecimen>` + `<PillarsSpecimen>` reading the live weights — the rest of the methodology page restyle waits for Phase D.
- ✅ `ThemeToggle` shim deleted (last consumer was `(public)/layout.tsx`, now rebuilt with `<TopNav>`).
- ✅ Tests added (Phase B): `cohort-stats.test.ts` (10 — SQL-shape contract + value normalisation), `rankings-filters.test.tsx` (11 — chip strip, More-filters disclosure, reset), `world-map.test.tsx` (8 — quintile partition, coordinate set, dot rendering, accessible svg), `landing-sections.test.tsx` (13 — HeroLanding live values, ThisEdition empty state, TopNav/GtmiFooter/PreviewBanner). 42 net-new tests.
- ✅ Workspace test totals: web 166 → 208, scoring 164 unchanged, extraction 203 unchanged → **575 total green**. Workspace typecheck 7/7 green.
- ✅ Live verification on `http://localhost:3001/` (port 3000 was held by another process): HTTP 200, 524 KB rendered. All 25 structural markers present (TopNav, GtmiFooter, PreviewBanner, HeroLanding, oxblood "actually", stats strip, ThisEdition, WorldMap, SpecimenPlate, PillarsSpecimen, EditorsQuote, ProvenanceProof, RankingsTable, RankingsFilters, All-Categories chip, More-filters toggle, Sparkline, AdvisorModeToggle, all editorial copy markers). ThisEdition correctly renders empty state — zero `<article>` mock entries. None of the design's fabricated stat-strip numbers (187, 2,431, 78.6%) appear in the rendered HTML body. Zero `dark:` variants, zero `next-themes` references, zero `MethodologyBar` references, zero `ThemeToggle` references. 40 world-map dots, 85 ranking rows server-side, 3 sparklines (1 per scored programme). Live stats strip: **78** programmes, **48** indicators, **113** sources, **18%** coverage, **29 APR 2026** last updated.
- ✅ `/programs` HTTP 200, 224 KB; 50 ranking rows (paginated), `<RankingsFilters>` chip strip + disclosure visible, `<AdvisorModeToggle>` retained.
- ✅ OG image HTTP 200, 1200×630 PNG, 87 KB. Editorial visual language confirmed visually.

### Phase 4-C — Programme detail + Provenance drawer — ✅ COMPLETE

- ✅ Programme detail page (`apps/web/app/(public)/programs/[id]/page.tsx`) rewritten end-to-end:
  - `<ProgramHeader>` — breadcrumb (Programmes › Country › Programme), country flag inline with eyebrow caption, status chip + coverage chip, 56px Fraunces serif programme name, italic-serif description body, paper-2 composite-score plate (Phase A `<CompositeScoreDisplay>`).
  - Pre-calibration banner pinned directly under the header for placeholder rows.
  - `<PillarStrip>` — 5-cell pillar grid driven by `getProgramDetail()` pillar scores + indicator counts, scoring bar in each pillar's colour, weight badge from `methodology v1`.
  - `<PillarBreakdown>` (Q5 — keep both modes):
    - **Tabs mode** (default) — 5-tab strip A→E; switching tabs renders the per-pillar radar (program polygon vs cohort median, small-cohort caveat) on the left and a per-pillar `<IndicatorRow>` table on the right.
    - **Expand all sub-factors mode** — collapses the tab strip and renders all 48 indicators grouped by sub-factor, faithful port of the Phase 4.3 SubFactorAccordion behaviour.
  - `<IndicatorRow>` rebuilt to the design's `table.gtmi` row layout: ID · Indicator (Fraunces) · Weight (mono + direction arrow) · Raw value · Score (mono + ScoreBar + Pre-cal chip) · `<ProvenanceTrigger>` · status chip (Verified / Pre-cal / Scored / Missing).
  - `<PolicyTimeline>` reads from `detail.policyChanges`; renders the Phase 5 empty state (no mock).
  - "What this means" panel reads `programs.long_summary_md` first, falls back to `apps/web/content/programs/<countryIso-lower>-<slug>.md`. Italic Fraunces "Summary forthcoming" placeholder for missing content.
  - Government sources list + closing `<DataTableNote>` + bottom-of-page coverage chip in fraction format.
- ✅ `<ProvenanceDrawer>` (`apps/web/components/gtmi/provenance-drawer.tsx`) — right-side Radix Dialog (modal) replacing the Phase 4.1 popover. 540px wide, slides from right edge, oxblood-ink left rule, paper background. Built-in focus trap, Escape-to-close, overlay-click-to-close, scroll-lock all handled by Radix Dialog. Renders the full ADR-007 schema in a single source card per analyst Q13:
  - Header: indicator key (mono) + label (Fraunces) + Raw / Score / Weight / Sources strip.
  - Source card: geographic level + tier · scrape time · char-offset-highlighted source sentence · char/page/sha/scrape grid · "View at source" link · disabled "View archived version" with the Phase 5 ADR-008 tooltip.
  - Tier 2 advisory note when `sourceTier === 2`.
  - Country-substitute note when `extractionModel === 'country-substitute-regional'`.
  - **Derived note** when `extractionModel === 'derived-knowledge'` or `'derived-computation'` (new in Phase C).
  - Derived inputs detail with per-input source links when `provenance.derivedInputs` is present.
  - Provenance metadata grid: extractionModel + confidence bar, validationModel + confidence bar, crossCheckResult, methodologyVersion, reviewer (only when status === 'approved'), stabilityEdgeCase note (E.1.1 mean-substitution).
- ✅ `<ProvenanceTrigger>` migrated from Radix Popover to a controlled drawer trigger. The trigger is now a `btn-link` showing "1 src ⛬" mono label by default; clicking opens the drawer. Fail-loud "Provenance incomplete" chip still rendered when required ADR-007 keys are missing — unchanged contract.
- ✅ Program OG image redesigned (`(public)/programs/[id]/opengraph-image.tsx`) to the editorial palette: warm paper background with paper-grain radial gradients, oxblood eyebrow rule + uppercase "GTMI · {country} · {category}" tracking, programme name in serif, "Composite score" eyebrow + Pre-cal chip when placeholder, large composite numeral with CME/PAQ split, pillar mini-bars across the bottom in the warm-cool palette, TTR Group attribution.
- ✅ New dependency: `@radix-ui/react-dialog ^1.1.15` (matches existing `@radix-ui/react-popover` major). Tree-shaken into the drawer chunk only.
- ✅ Tests: `provenance-trigger.test.tsx` rewritten (21 cases — readProvenance schema validation + drawer migration: trigger renders, drawer opens on click, fieldKey/label render, char-offset highlight, Tier 2 / country-substitute / Derived badges, derivedInputs block, Escape-to-close, click-to-close, full ADR-007 schema with single source card per Q13). New `program-detail.test.tsx` (15 — ProgramHeader: breadcrumb / chips / Pre-cal not duplicated / coverage math; PillarStrip: 5 cells / dashes for unscored / weight overrides; PillarBreakdown: defaults to tabs / pillar-tab switching / expand-all renders all 48 grouped by sub-factor / mode round-trip).
- ✅ `<MethodologyBar>` deletion already shipped in Phase B; no further `theme-toggle` references; no `dark:` variants in any Phase C component.
- ✅ Workspace test totals: scoring 164 unchanged, extraction 203 unchanged, web 208 → **226** (+18 net new for Phase C). Workspace **575 → 593**, all green. Workspace typecheck 7/7 green.
- ✅ Live verification on `http://localhost:3002/programs/e1687f65-…` (port 3000 + 3001 held by other processes): HTTP 200, 286 KB rendered. All 30+ structural markers present (TopNav, Footer, ProgramHeader, ProgramName, CompositeScoreDisplay, CoverageChip, PreCalibrationChip on plate, PillarStrip + 5 cells, PillarBreakdown, default mode=tabs, pillar-tab-strip, all 5 pillar tabs, mode toggle: tabs + expand-all, PillarRadar, indicator table, indicator rows, policy-timeline empty state, "What this means" + "Tier 1 sources tracked" headings, closing data-table-note). Drawer correctly closed on first paint (`provenance-drawer` not in DOM until trigger clicked). 9 indicator rows on the active pillar; 9 fail-loud "Provenance incomplete" chips reflecting the genuine gaps in current AUS canary `field_values.provenance` JSONB — the drawer logic is upstream and is exercised end-to-end by the 9 vitest cases against complete fixtures. Programme OG image: HTTP 200, 1200×630 PNG, 73 KB; visual confirmation: warm paper + oxblood rule + Pre-cal chip + 16.36 composite + CME/PAQ split + 5 pillar bars in the warm-cool palette.

### Phase 4-D — Methodology + Country pages — ✅ COMPLETE

- ✅ Methodology page (`apps/web/app/(public)/methodology/page.tsx`) rewritten end-to-end:
  - Editorial hero with eyebrow `Methodology · v{methodology.versionTag}`, 64px Fraunces headline ending with **`falsifiable`** in oxblood italic, and a Inter Tight standfirst beside it.
  - Live stats strip (5 cells): pillars, sub-factors, indicators, programmes scored, last updated — every value DB-derived from `getMethodologyCurrent` + `getCohortStats`.
  - "The 30 / 70 split" section with `<SplitSpecimen>` reading the live `methodology.cmePaqSplit`.
  - "Five pillars · N indicators · M sub-factors" section with `<PillarsSpecimen>` reading the live pillar weights.
  - **`<WeightTree>` (new)** — server component, root → CME / PAQ → pillar → sub-factor → optional indicator hierarchy. Each node carries its label, indicator count (where applicable), a hairline weight bar in the pillar colour, and the percentage-of-composite. `role="tree"` + per-node `role="treeitem"` + `aria-level` 1–5 + `aria-label` for SR. Hover tints the gutter rule.
  - "Pillar rationale" section: per-pillar Fraunces-letter blocks (in pillar colour) + Markdown rationale loaded from `content/pillars/{A..E}.md` + per-sub-factor count + weight strip below the rationale.
  - `<FalsifiabilityCommitments>` (new) — translates the design's six numbered commitments with sticky standfirst on the left.
  - Sensitivity-analyses placeholder via `<EmptyState>` ("ship in Phase 5") — falls back to live Markdown if `content/methodology/sensitivity.md` populates.
  - Three-column normalization / data-integrity / what GTMI does not measure prose blocks reading from `content/methodology/{normalization,data-integrity,whatGTMIMeasuresNot}.md`.
  - "What GTMI measures" intro long-form panel from `content/methodology/intro.md` when present.
  - "Methodology change log" version history list from `methodology.history`.
  - Closing `<DataTableNote>`.
- ✅ Country detail page (`apps/web/app/(public)/countries/[iso]/page.tsx`) rewritten:
  - `<CountryHeader>` (new) — breadcrumb, country flag inline with eyebrow, 64px Fraunces serif country name, ISO standfirst with live "X of Y programmes scored", top-scoring programme name + rank, and IMD Appeal rank/score. Right column: 3-cell stat strip (Top programme · Avg composite · Coverage).
  - "Programmes scored across N seeded" 1.2/1 split: left column hosts `<CountryProgramsTable>` (new — editorial `table.gtmi` with the country's programmes ranked by composite, full Phase A primitive set: ScoreBar, PillarMiniBars, CoverageChip, PreCalibrationChip, status chip), right column hosts `<CountryRadar>` (new — Recharts overlay of every scored programme on a single radar; oxblood for the leader, navy for the rest, sr-only data table for screen readers).
  - "Tax treatment" section using `<TaxTreatmentCard>` (new — wraps the existing `aggregateTaxTreatment` helper).
  - **Country-level stability section gated behind `NEXT_PUBLIC_STABILITY_ENABLED` per Q8.** Off by default; the query and the empty-state component remain so Phase 5 lights it up by flipping the env var.
  - "Last verified" footer + closing `<DataTableNote>`.
- ✅ Country OG image (`apps/web/app/(public)/countries/[iso]/opengraph-image.tsx`) redesigned to the editorial palette: warm paper background with paper-grain radial gradients, oxblood eyebrow rule + "GTMI · Country profile · {region}" tracking, country name in serif (96px), ISO in oxblood mono, three-stat row (IMD Appeal rank, IMD Appeal score, Programmes scored), TTR Group attribution.
- ✅ **Orphans deleted (per Phase C deviation):**
  - `apps/web/components/gtmi/pillar-comparison.tsx`
  - `apps/web/components/gtmi/sub-factor-accordion.tsx`
  - Both stripped from `components/gtmi/index.ts`. No live consumers remained — `pillar-breakdown.tsx` only had a comment reference.
- ✅ Six new components shipped: `WeightTree`, `FalsifiabilityCommitments`, `CountryHeader`, `CountryProgramsTable`, `CountryRadar`, `TaxTreatmentCard`. All exported through `components/gtmi/index.ts`.
- ✅ Tests: `weight-tree.test.tsx` (10 cases — role=tree + aria-labels, all 5 pillars render, custom CME/PAQ split, weight sum-to-100% sanity check, indicator counts, sub-factor nodes, indicator-leaf gating via `showIndicators` prop, multi-level aria-level coverage). `country-detail.test.tsx` (8 cases — CountryHeader live values + null-safe rendering, CountryProgramsTable rank prefixes / empty state / Pre-cal-vs-Awaiting chips, TaxTreatmentCard empty / both-populated / half-populated branches). 18 net-new tests for Phase D.
- ✅ Workspace test totals: scoring 164 unchanged, extraction 203 unchanged, web 226 → **244** (+18). Workspace **593 → 611**, all green. Workspace typecheck 7/7 green.
- ✅ Live verification on `http://localhost:3003/methodology` (port 3000 + 3002 held by other processes): HTTP 200, 370 KB rendered. All 32 structural markers present including `methodology-falsifiable` (oxblood italic), `methodology-stats-strip`, `weight-tree` with all 5 pillar branches and 15 sub-factor nodes (23 treeitems total), `falsifiability-commitments`, all five per-pillar rationale blocks. Live stats strip values: **Pillars=5 · Sub-factors=15 · Indicators=48 · Programmes scored=78 · Last updated=29 APR 2026**. No legacy MethodologyBar / PillarComparison / SubFactorAccordion / dark: variant references in rendered HTML.
- ✅ Live verification on `http://localhost:3003/countries/AUS`: HTTP 200, 246 KB rendered. All 15 structural markers correct. Country name "Australia" rendered in serif, header stats strip live, **12 programmes** rendered in the table, country radar mounting client-side (`country-radar` test ID present), tax treatment card mounted. Country stability section correctly hidden (Q8 flag default off). Country OG image: HTTP 200, 1200×630 PNG, 57 KB; visual confirmation: warm paper, oxblood eyebrow rule + "GTMI · Country profile · Oceania", "Australia" in serif, AUS in oxblood mono, IMD Appeal rank #13 / score 62.09 / Programmes scored 1 of 12.

### Phase 4-E — Internal tools — ✅ COMPLETE

- ✅ `(internal)/review/layout.tsx` rebuilt: replaces the Phase 4.1 neutral header bar with the editorial `<InternalBadge>` (ink surface, paper text, oxblood pulse dot, mono uppercase tracking) above a paper-2 chrome strip carrying the signed-in user + sign-out form. Auth gating (Supabase magic-link + `middleware.ts`) unchanged.
- ✅ `(internal)/review/page.tsx` rewritten end-to-end (I-01):
  - Editorial header with eyebrow `Review queue · Editorial`, 56px Fraunces "Pending review.", standfirst on the left, 4-cell live `<ReviewQueueStats>` strip on the right.
  - Stats are computed live: in-queue (`COUNT pending_review`), SLA risk (pending older than 3 days), avg age (hours), high-confidence count (`extractionConfidence ≥ 0.9`).
  - `<ReviewFilterTabs>` chip strip — All / Pending / In review / Flagged / High confidence — with per-tab count badges. Active tab persists in `?tab=` URL state.
  - `<ViewToggle>` (Pending / Recently reviewed) sits beside the filter tabs.
  - `<BulkApproveDialog>` (new) — Radix Dialog (modal) confirmation. Disabled when zero candidates; renders `Bulk approve high-confidence (N)` with the live count when candidates exist. Confirms before invoking the server action.
  - `<ReviewQueueTable>` (new) — editorial `table.gtmi` with the design's 10 columns: ID (FNV-1a hash → `RV-XXXXXX`), Programme (flag + Fraunces name), Indicator (key + label), Source (host domain), Impact (`—` per Q9), Conf. (number + colour-coded bar), Age (relative), Reviewer (`Unassigned` placeholder until reviewer assignment ships), Status chip (Pending / In review / Flagged), Open link.
  - Closing `<DataTableNote>` documenting the bulk-approve gate and the Q9 impact-delta deferral.
- ✅ `(internal)/review/[id]/page.tsx` rewritten end-to-end:
  - Breadcrumb back to `/review` + the row's `RV-XXXXXX` tag.
  - Header with field-key + country + programme eyebrow, 36px Fraunces `fieldLabel` headline, country flag inline + relative-age line, status banner on the right (Approved / Rejected / Pending colour-coded — oxblood / positive-green / paper-2).
  - Source card (paper-2 + hairline rule): `<ProvenanceHighlight>` rendering the source sentence with char-offset highlight (graceful fallback when offsets are missing), 4-column metadata grid (extraction conf · validation conf · tier · scraped date), source URL link.
  - Decision section (only on pending rows): two-form layout — left form has the editable raw value textarea + green Approve button; right form has the Reject explainer + red Reject button. Both forms use the patched FormData-id pattern (closure binding is unreliable across Next.js minor versions).
  - Four side-by-side `<details>` blocks for normalized value JSON, full provenance JSONB, extraction prompt Markdown, and scoring rubric.
  - Pagination: `← Previous` / `Next →` links walk the pending queue server-rendered, plus an `N of M pending` counter.
- ✅ New server action `bulkApproveHighConfidence()` (`apps/web/app/(internal)/review/actions.ts`) — selects every `field_values.status = 'pending_review'` row whose provenance JSONB satisfies `extractionConfidence ≥ 0.85` AND `validationConfidence ≥ 0.85` AND `isValid IS DISTINCT FROM 'false'`, updates them to `status = 'approved'` in a single transaction, mirrors the change into `review_queue.status`, and revalidates `/review`. Existing `approveFieldValue` / `rejectFieldValue` actions kept unchanged.
- ✅ `(public)/changes/page.tsx` rewritten end-to-end (I-02):
  - Editorial header: eyebrow `Changes log · always public`, 56px Fraunces "Every score change, written down.", standfirst.
  - `<ChangesAudit>` (new client component) — full I-02 design: 5 filter tabs (All / Data / Methodology / Provenance / Countries) with live count badges; severity-coloured diamond markers on each timeline row; serif programme name + key + Δ PAQ delta + body summary + source link. Filters are local UI state — events bucket via a heuristic against the existing `policy_changes` schema (no `kind` column today): `url_broken` → Provenance, pillar E → Countries, methodology marker → Methodology, default → Data.
  - Renders the design-aligned Phase 5 empty state when `events.length === 0` (current reality, RLS gates `summary_human_approved=true`). When the active tab filters to zero rows on a populated dataset, shows a tighter "No events match this filter" placeholder so the analyst sees the tab UI is functional even when the table is empty.
  - Closing `<DataTableNote>` documenting that `getPolicyChanges` runs a real RLS-gated SELECT and the page activates with zero code change in Phase 5.
- ✅ Six new components shipped: `InternalBadge`, `ReviewQueueStats`, `ReviewQueueTable`, `ReviewFilterTabs`, `BulkApproveDialog`, `ChangesAudit`. Two new server-side helpers: `lib/review-queue-stats.ts` (single-round-trip aggregate) and `lib/review-queue-helpers.ts` (pure helpers — `readProvenanceConfidence`, `isBulkApproveCandidate`, `matchesReviewTab`, `relativeAge`, `reviewIdTag`, `sourceDomain`).
- ✅ Tests (44 net new):
  - `lib/review-queue-helpers.test.ts` (24) — every helper exercised through happy/edge paths: provenance read with string-coerced confidences, bulk-approve gate with all four fail conditions + isValid null = pass, tab matching across the four bucket dimensions, FNV-1a hash stability, source-domain trim + truncation, relative-age formatting from minutes through days.
  - `components/gtmi/internal-tools.test.tsx` (20) — InternalBadge role/copy, ReviewQueueStats four cells with day/hour/dash formatting, ReviewQueueTable rows + Impact='—' (Q9) + Reviewer='Unassigned' + bulk-approve candidate marker, BulkApproveDialog disabled-zero-state + confirmation flow + Cancel/Approve forks, ChangesAudit empty/populated/tab bucketing/tab-empty placeholder.
- ✅ Workspace tests: scoring 164 unchanged, extraction 203 unchanged (one transient live-DB integration test flake on first run; passed on rerun), web 244 → **288** (+44 net new). Workspace **611 → 655**, all green. Workspace typecheck 7/7 green.
- ✅ Live verification on `http://localhost:3004/changes`: HTTP 200, 84 KB rendered. All 14 structural markers correct. Renders the EmptyState branch (`policy_changes` is empty under RLS); zero fabricated mock entries; zero `dark:` variants. Filter tabs render with live count badges (all=0).
- ⚠ `/review` is auth-gated by Supabase magic-link middleware (existing setup). The dev environment lacks `NEXT_PUBLIC_APP_URL` so the auth client returns a 500 on unauthenticated requests — this is inherited Phase 4 behaviour, not a Phase E regression. Page rendering is exercised end-to-end by the 44 vitest cases against complete fixtures.

## Phase 4 Redesign — COMPLETE

All five phases (A → E) shipped, reviewed, and approved. Tag suggestion: **`phase-4-redesign-complete`** at this commit.

| Phase     | Net new tests | Workspace test total | Status |
| --------- | ------------- | -------------------- | ------ |
| Phase 4-A | +36           | 533                  | ✅     |
| Phase 4-B | +42           | 575                  | ✅     |
| Phase 4-C | +18           | 593                  | ✅     |
| Phase 4-D | +18           | 611                  | ✅     |
| Phase 4-E | +44           | **655**              | ✅     |

---

## Phase 5 — 5-Country Pilot

**Goal:** Full extraction across all 5 pilot countries (~25 programs) using the improved pipeline from Phase 3. First composite scores with calibrated normalization params. All sensitivity analyses run.

**Pre-condition:** Phase 3 close-out — every canary programme (AUS, SGP, CAN) at ≥42/48 indicator coverage before Phase 5 begins.

### Extraction

- ⬜ Full extraction across Australia, Hong Kong, UK, Canada, Singapore
- ⬜ All ~25 programs extracted end-to-end through all 7 pipeline stages
- ⬜ Target: ≥42/48 field coverage per program (Phase 3 pipeline carries this)
- ⬜ Fields below 70% coverage on any pillar flagged for review

### Scoring

- ⬜ CME scores loaded from IMD for all 30 countries
- ⬜ CME re-normalized to 0–100 within our 30-country cohort (min-max within cohort)
- ⬜ Calibration: run `compute-normalization-params.ts` — viable now with ≥5 programs scored; replace engineer-chosen ranges in `run-paq-score.ts`; `phase2Placeholder` flag cleared
- ⬜ First full composite scoring run (30% CME + 70% PAQ)
- ⬜ Composite scores published internally

### Sensitivity analyses (all 6)

- ⬜ **Weight sensitivity (Monte Carlo):** 1,000 Dirichlet-sampled weight vectors, ±20% perturbation. Median rank, 5th–95th percentile band, Spearman ρ per program.
- ⬜ **Normalization sensitivity:** pure min-max, pure z-score, distance-to-frontier alternatives. Spearman ρ vs baseline.
- ⬜ **Aggregation sensitivity:** geometric mean at pillar level vs baseline.
- ⬜ **CME/PAQ split sensitivity:** 20/80, 25/75, 35/65, 40/60, 50/50. Top-10 shift documented.
- ⬜ **Indicator dropout test:** drop one indicator at a time. Flag if any program moves >5 ranks.
- ⬜ **Correlation and redundancy:** Pearson matrix across all indicators. ρ > 0.8 within sub-factor triggers review.
- ⬜ All results stored in `sensitivity_runs` table

### Methodology page

- ⬜ Draft public methodology page auto-rendered from database
- ⬜ Pillar weights, sub-factor weights, indicator weights all displayed
- ⬜ Normalization choices documented per indicator

---

## Phase 6 — Living Index

**Goal:** Policy monitoring infrastructure — weekly re-scrapes, change detection, and news signal ingestion. Activates the `/changes` timeline and policy alerts already wired in Phase 4.

- ⬜ Weekly re-scrape of all Tier 1 sources via Trigger.dev scheduled jobs
- ⬜ Content hash comparison against `scrape_history`
- ⬜ Re-extraction triggered on hash change
- ⬜ Diff against previous indicator value on re-extraction; `policy_changes` row created on any indicator value change
- ⬜ Severity classification (deterministic):
  - **Breaking**: PAQ change > 5 points
  - **Material**: PAQ change 1–5 points
  - **Minor**: PAQ change < 1 point, or non-scoring changes
- ⬜ Wayback Machine archival of changed source page (per ADR-008)
- ⬜ Dashboard policy change timeline activates with zero code change (already wired in Phase 4.3)
- ⬜ Tier 3 news-signal ingestion via Exa semantic search (IMI Daily, Henley newsroom, Expatica, Nomad Gate); `news_signals` table populated; signals flow into review queue
- ⬜ Email alerts via Resend on material/breaking changes; summary text generated by Claude with human review before sending
- ⬜ URL drift monitoring: monthly HEAD-check job surfacing Tier 1 URL soft-404s before they cost a canary run

Trigger.dev jobs: `weekly-rescrape`, `diff-and-classify`, `news-signal-ingest`.

---

## Phase 7 — Scale and Enrichment

**Goal:** Full 85-program universe. External indices integrated. Methodology whitepaper published.

### Scale

- ⬜ Onboard remaining 60 programs (total: 85 across IMD Top 30)
- ⬜ All programs through full extraction pipeline

### External index integration

- ✅ World Bank Worldwide Governance Indicators (WGI) — Pillar E.3.2 — **shipped in Phase 2** via `fetchWgiScore` in canary Phase 1
- 🚚 V-Dem Institute — Pillar E.3.1 — **moved to Phase 3.1** (deterministic, ~1 day eng; ships before the broader Phase 7 enrichment so E.3 closes earlier)
- ⬜ Annual IMD Appeal refresh job (CME update) — runs once per year following IMD's release
- ⬜ OECD tax treaty database (Pillar D.3 supplementary; supplements the per-country tax-authority discovery shipped in Phase 3.2)
- ⬜ QS World University Rankings (program narrative only, not scoring)

### Publications

- ⬜ Methodology whitepaper published
- ⬜ Sensitivity analysis results published with V1 release
- ⬜ Open internal beta to TTR Group strategy clients

---

## Operational requirements (ongoing across all phases)

- All code changes via PR, one approval minimum
- All migrations reviewed by both contributors before merge
- Any methodology change = ADR + `methodology_versions` increment
- Scores not recomputed retroactively on methodology change — each score carries its `methodology_version_id`
- All LLM calls logged: prompt, response, model, token count, timestamp, cost
- Daily cost dashboard: Anthropic, Perplexity, Supabase, Cloud Run (web + scraper), Trigger.dev, Wayback (Phase 5+)
- Weekly data-quality report: field coverage %, review queue backlog, policy changes detected, news signals triaged
- Incident runbook maintained for: extraction pipeline failure, Supabase outage, LLM provider outage, Perplexity / scraper service outage, invalid source URL, program closure

---

## ADR approvals

All Phase 2 ADRs (002–007) approved and documented — Szabi, 2026-04-19.

Session 6 changes (Wave 1 filter, two-phase discovery, per-field Tier 2 selection, bug fixes) are operational decisions, not methodology changes. No ADRs raised.

Session 7 changes (Stage 0 five-category source mix expansion, publish.ts normalizeRawValue type fix) are operational and bug-fix decisions. No ADRs raised.

Session 8 changes (Perplexity API for Stage 0, Python/Playwright scraper replacing Firecrawl, E.3.2 World Bank API direct, canary cross-check bypass, extract/validate resilience improvements) are tooling, operational, and bug-fix decisions. No ADRs raised.

Session 9 changes (currency preservation in provenance JSONB, batch extraction + tier-2 fallback, scrape/extraction caches, Phase 2 PAQ scoring, /review web app with Supabase auth, Cloud Run deployment with NEXT_PUBLIC_APP_URL canonical-origin fix) are operational. ADR-008 to be raised on Phase 2 closeout for Wayback deferral to Phase 6.

Phase 3.6 (Session 12) introduced two ADRs, both approved by Szabolcs Fulop on 2026-04-28:

- **ADR-013** amended (not superseded) by Phase 3.6 commit 1: Tier 2 allowlist expanded from {B.3.3, C.2.4, D.2.3} to {B.3.3, C.2.4, D.2.3, B.2.3, B.2.4, D.2.4}. C.2.1 was considered and excluded per analyst Q2.
- **ADR-015** — Self-improving sources table (Stage 0 write-back + URL merge). Approved 2026-04-28.
- **ADR-016** — Derived fields (Stage 6.5: deterministic computation for A.1.2 and D.2.2). Approved 2026-04-28.
