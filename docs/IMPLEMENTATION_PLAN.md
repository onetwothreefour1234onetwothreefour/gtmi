# GTMI Implementation Plan

> **Last updated:** Session 9 — 26 Apr 2026. Documented work completed since Session 8: extraction batch pipeline + tier-2 fallback in canary, currency preservation in publish.ts (provenance JSONB), scrape/extraction caches, Phase 2 PAQ scoring script, normalization-param calibration script, scrape guards, Wave 1 AUS PAQ score row, /review web app (auth-gated). Wayback archival officially deferred to Phase 5 (co-located with diff detection — see ADR-008 pending). Phase 2 remaining work captured in "Phase 2 close-out" section at the bottom of Phase 2.
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

## Phase 2 — Extraction Canary

**Goal:** One program end-to-end. Australia Skills in Demand 482 Core Skills Stream through all pipeline stages, producing provenance records and a deterministic PAQ score.

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
- 🚚 **Wayback Machine archival → moved to Phase 5** (co-located with re-scrape diff detection; archival of every canary scrape would pollute history)

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
- ⬜ Field-aware content-window selection — current code still slices to first 30K chars in `extract.ts:252,341`; diagnostic `scripts/diag-empty-fields.ts` already classifies fields as TRUNCATION/LLM_MISS/ABSENT but the fix isn't implemented

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
- ✅ Human review dashboard functional (basic UI) — `apps/web/app/review` with Supabase magic-link auth, pending/recently-reviewed tabs, status banners, approve flow with re-normalization on edit
- ⬜ Reject flow on `/review/[id]` writes to DB but doesn't redirect/refresh consistently — reproduce + fix

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
- 🔄 Wave 1 (27 fields) attempted; Wave 2 (remaining 21 fields) **see Phase 2 close-out below**
- 🔄 Singapore S Pass canary run — **see Phase 2 close-out below**
- ⬜ Content window strategy for fields truncated at 30K chars — **see Phase 2 close-out below**
- ⬜ Provenance records verified end-to-end for AUS canary extracted fields — **see Phase 2 close-out below**

### Phase 2 close-out (Session 9 — work plan)

Open items below this line are the only blockers to declaring Phase 2 complete. Work order matches dependency graph in conversation thread.

- ⬜ **CO-1: Field-aware content windowing** — replace blanket `slice(0, 30000)` in `extract.ts` (single + batch paths) with relevance-scored chunk selection driven by per-field keywords (lift `extractKeywords` from `diag-empty-fields.ts`). Cache key gets a `WINDOW_VERSION` constant so old cache rows are auto-invalidated. **Also** remove redundant 30K cap in `scrape.ts:172` (let full content into cache; windowing happens in extract). Two unit tests: answer-near-end + answer-near-start. Done when `diag-empty-fields.ts --country AUS` reports ≥6 of 13 previously-TRUNCATION fields recover.
- ⬜ **CO-2: Wave 2 enable** — add `WAVE_2_FIELD_CODES` (21 sub-factors) to `wave-config.ts`, introduce `ACTIVE_FIELD_CODES = WAVE_1 ∪ (WAVE_2_ENABLED ? WAVE_2 : [])`, switch consumers in `canary-run.ts:46`, `extract-single-program.ts:61`, `run-paq-score.ts:195`, `diag-empty-fields.ts:109`. Set `WAVE_2_ENABLED = true`. Done when canary processes 48 fields end-to-end.
- ⬜ **CO-3: AUS canary re-run + provenance verifier** — generalize `audit-phase2.ts` (currently hard-coded program ID) into `scripts/verify-provenance.ts --country|--programId`. Asserts every field_values row has the 14 required provenance keys per ADR-007. Exit 1 on any miss. Run AUS canary with windowing + Wave 2 + verifier. Done when ≥30/48 AUS fields populated and verifier reports zero missing keys.
- ⬜ **CO-4: SGP canary** (parallel to CO-3) — `canary-run.ts --country SGP` + verifier. Done when SGP S Pass has ≥20 populated field_values, provenance verified.
- ⬜ **CO-5: Re-calibrate normalization params from AUS+SGP distribution** — run `compute-normalization-params.ts`, paste output into `run-paq-score.ts` replacing hardcoded ranges. Keep `phase2Placeholder = true` flag (real calibration is Phase 3 with ≥5 programs). Re-score AUS, score SGP. Done when both score rows exist and are deterministic across re-runs.
- ⬜ **CO-6: Fix reject flow on `/review/[id]`** — reproduce on Cloud Run, capture logs, fix DB write/redirect (likely server-action redirect interaction with transaction or RLS on `review_queue`). Done when reject moves item to "Recently Reviewed" tab with red badge.
- ⬜ **CO-7: Phase 2 closeout doc** — bump status header to Session 10, add Phase 2 retrospective (cost numbers from canary runs, TRUNCATION/LLM_MISS/ABSENT distribution, what Phase 3 cohort needs). Tag `phase-2-complete`. Raise ADR-008 documenting Wayback deferral to Phase 5.

---

## Phase 3 — 5-Country Pilot

**Goal:** Full extraction across all 5 pilot countries (~25 programs). First composite scores. All sensitivity analyses run.

### Extraction

- ⬜ Full extraction across Australia, Hong Kong, UK, Canada, Singapore
- ⬜ All ~25 programs extracted end-to-end through all 7 pipeline stages
- ⬜ Target: ≥90% field coverage across the pilot
- ⬜ Fields under 70% coverage flagged for extraction prompt review

### Scoring

- ⬜ CME scores loaded from IMD for all 30 countries
- ⬜ CME re-normalized to 0–100 within our 30-country cohort (min-max within cohort)
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

## Phase 4 — Public Dashboard

**Goal:** Interactive public-facing web dashboard. Every data point shows provenance on hover.

### Program explorer

- ⬜ Country and program explorer with filters (region, category, pillar strength)
- ⬜ Composite score display per program
- ⬜ Pillar breakdown radar chart per program
- ⬜ Sub-factor drill-down per pillar
- ⬜ Indicator table with values and provenance hover

### Provenance display

- ⬜ Hover any data point → exact source sentence, URL, scrape date
- ⬜ Click-through to Wayback-archived version if current URL differs from scraped URL
- ⬜ Every published value traceable to the sentence that produced it

### Methodology page

- ⬜ Auto-generated from `methodology_versions` and `field_definitions` tables
- ⬜ No separate copy — database is single source of truth
- ⬜ Sensitivity analysis visualizations: Monte Carlo rank bands, CME/PAQ split chart, indicator dropout heatmap

### Infrastructure

- ⬜ Next.js 15 App Router with React Server Components
- ⬜ Tailwind CSS, shadcn/ui, Recharts visualizations, Framer Motion interactions
- ⬜ RLS: public reads limited to approved `field_values`, current `scores`, current `methodology_versions`, approved `policy_changes`, public `programs` metadata

---

## Phase 5 — Living Index

**Goal:** Fully automated policy monitoring. Weekly re-scraping, diff detection, alerts.

### Scheduled re-scraping

- ⬜ Weekly re-scrape of all Tier 1 sources via Trigger.dev scheduled jobs
- ⬜ Content hash comparison against `scrape_history`
- ⬜ Re-extraction triggered on hash change

### Policy change detection

- ⬜ Diff against previous indicator value on re-extraction
- ⬜ `policy_change_event` created on any indicator value change
- ⬜ Severity classification (deterministic):
  - **Breaking**: PAQ change > 5 points
  - **Material**: PAQ change 1–5 points
  - **Minor**: PAQ change < 1 point, or non-scoring changes
- ⬜ Wayback Machine archival of changed source page
- ⬜ Dashboard policy change timeline updated

### Alerts

- ⬜ Email alerts via Resend to subscribed users on material/breaking changes
- ⬜ Summary text generated by Claude, subject to human review before sending

### News signal ingestion

- ⬜ Tier 3 news sources ingested via Exa semantic search
- ⬜ Signals automatically linked to relevant programs
- ⬜ Signals flow into review queue for analyst triage
- ⬜ `news_signals` table populated

---

## Phase 6 — Scale and Enrichment

**Goal:** Full 85-program universe. External indices integrated. Methodology whitepaper published.

### Scale

- ⬜ Onboard remaining 60 programs (total: 85 across IMD Top 30)
- ⬜ All programs through full extraction pipeline

### External index integration

- ⬜ World Bank Worldwide Governance Indicators (WGI) — Pillar E.3
- ⬜ V-Dem Institute — Pillar E.3
- ⬜ Annual IMD Appeal refresh job (CME update)
- ⬜ OECD tax treaty database (Pillar D.3 supplementary)
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
- Daily cost dashboard: LLM, Firecrawl, Supabase, Vercel, Trigger.dev, Wayback
- Weekly data-quality report: field coverage %, review queue backlog, policy changes detected, news signals triaged
- Incident runbook maintained for: extraction pipeline failure, Supabase outage, LLM provider outage, Firecrawl rate limiting, invalid source URL, program closure

---

## ADR approvals

All Phase 2 ADRs (002–007) approved and documented — Szabi, 2026-04-19.

Session 6 changes (Wave 1 filter, two-phase discovery, per-field Tier 2 selection, bug fixes) are operational decisions, not methodology changes. No ADRs raised.

Session 7 changes (Stage 0 five-category source mix expansion, publish.ts normalizeRawValue type fix) are operational and bug-fix decisions. No ADRs raised.

Session 8 changes (Perplexity API for Stage 0, Python/Playwright scraper replacing Firecrawl, E.3.2 World Bank API direct, canary cross-check bypass, extract/validate resilience improvements) are tooling, operational, and bug-fix decisions. No ADRs raised.

Session 9 changes (currency preservation in provenance JSONB, batch extraction + tier-2 fallback, scrape/extraction caches, Phase 2 PAQ scoring, /review web app with Supabase auth, Cloud Run deployment with NEXT_PUBLIC_APP_URL canonical-origin fix) are operational. ADR-008 to be raised on Phase 2 closeout for Wayback deferral to Phase 5.
