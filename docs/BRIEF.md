# PROJECT: Global Talent Mobility Index (GTMI) — Build Specification v6

> **Document status:** Canonical build specification v6. Supersedes v5 — incorporating Phase 2 close-out (Sessions 9–10). Changes from v5 are marked with `[NEW v6]`. ADRs 002–008 approved and documented (008 = Wayback deferral, 2026-04-26).

> **Last updated:** Session 10 — 27 Apr 2026. **Phase 2 closed (tag `phase-2-complete`).** AUS Skills in Demand 482 — Core (PAQ 13.72 / CME 22.53 / Composite 16.36) and SGP S Pass (PAQ 18.11 / CME 24.14 / Composite 19.92) scored deterministically, both `phase2Placeholder: true`. Field-aware content windowing replaces head-slice. Wave 2 enabled — full 48-field coverage. Currency code preserved in provenance. Batch extraction + extraction cache + scrape cache shipped. Tier-1 URLs refreshed (ATO added for AUS tax fields), six LLM_MISS prompts retuned. /review UI deployed to Cloud Run with Supabase magic-link auth. Wayback archival deferred to Phase 5 (ADR-008).

---

## 0. How to use this document

This document is the single source of truth for the GTMI build. It comes with a companion `METHODOLOGY.md` that is the canonical, peer-reviewer-grade specification of the index. Together, they form the complete brief.

Read both before writing any code. Then produce an architectural response identifying any technical, statistical, or commercial weakness. Propose alternatives with reasoning. Do not silently substitute choices.

Ask clarifying questions only if a decision materially blocks progress. Most decisions are already made.

---

## 1. What we are building

The Global Talent Mobility Index (GTMI) is an interactive web platform that benchmarks talent-based premium mobility programs worldwide. It evaluates how effectively each country's visa architecture supports the attraction, admission, retention, and integration of highly skilled international talent.

Competitive positioning:

- Henley & Partners ranks investment migration programs (RBI, CBI). They cover money-in pathways.
- IMD World Talent Ranking measures country-level attractiveness. They cover macro pull factors.
- No existing index rigorously benchmarks the visa programs themselves for skilled workers, highly qualified professionals, and talent visas.

GTMI fills that gap with a methodology that is:

- **Anchored**: 30% of the composite derives from IMD's published Appeal factor, re-normalized across our 30-country universe.
- **Proprietary**: 70% from GTMI's Program Architecture Quality score, built from 48 indicators across 5 pillars and 15 sub-factors, all sourced from government and independent-source documents.
- **Transparent**: every weight is published and justified. Every data point traces to a government source URL, timestamp, content hash, and the exact source sentence that produced the value.
- **Living**: all sources re-scraped weekly with diff-based policy change detection, Wayback archiving, and change alerts.

The pilot covers 5 countries (Australia, Hong Kong, UK, Canada, Singapore) with ~25 programs. The full universe is 85 programs across the IMD World Talent Ranking 2025 Appeal factor Top 30. Architecture must scale beyond this without refactoring.

---

## 2. Non-negotiable differentiators

Every architectural and methodological decision must preserve these four:

1. **Scope**: talent and skilled-immigration programs. Not RBI, not CBI, not retirement visas, not tourist visas.
2. **Anchor-plus-architecture methodology**: IMD provides the country context (30%), GTMI provides the program-quality spine (70%).
3. **Radical transparency**: every published value is traceable to the exact sentence in a government source that produced it, displayed to the user on hover.
4. **Living index**: scheduled re-scraping, diff detection, policy change alerts, public change timeline per program.

---

## 3. Methodology (summary; full details in METHODOLOGY.md)

Composite score = 30% Country Mobility Environment + 70% Program Architecture Quality.

Program Architecture Quality = weighted composition of 5 pillars:

- **Pillar A — Access (28%)**: eligibility breadth and selectivity. 3 sub-factors, 9 indicators.
- **Pillar B — Process (15%)**: application friction, cost, speed. 3 sub-factors, 10 indicators.
- **Pillar C — Rights (20%)**: labor, family, public service rights during validity. 3 sub-factors, 10 indicators.
- **Pillar D — Pathway (22%)**: PR, citizenship, tax treatment progression. 3 sub-factors, 11 indicators.
- **Pillar E — Stability (15%)**: policy volatility, transparency, institutional quality. 3 sub-factors, 8 indicators.

Total indicators: 48. All weights at every level sum to 1.0 (arithmetically verified). Note: D.3.4 Exit Tax Exposure was dropped during Phase 1; weights redistributed within D.3.

---

## 4. Team and collaboration

Two senior contributors, both domain-literate, both coding in Antigravity on separate machines, both contributing to production.

- **Contributor A (Szabi)**: methodology, scoring engine, data layer, dashboard UX, client-facing narrative.
- **Contributor B (Ayush)**: extraction pipeline, verification logic, URL registry maintenance, domain QA, news source intelligence.

Git workflow: trunk-based, feature branches, PR review with one approval minimum, squash merges. Shared Supabase project as single source of truth. Shared secrets via a team vault (1Password or Bitwarden).

Daily 15-minute sync or async in Slack. Architectural decisions captured as ADRs in `/docs/decisions/`.

---

## 5. Technical stack (non-negotiable unless a counter-proposal is agreed)

- **Frontend**: Next.js 15 with App Router, React Server Components, TypeScript strict mode.
- **UI**: Tailwind CSS, shadcn/ui, Recharts for visualizations, Framer Motion for interactions.
- **Backend**: Supabase (Postgres 15, Row Level Security, Auth, Storage for raw scrape snapshots).
- **Extraction**: Custom Python/Playwright scraper service (`scraper/`) for scraping — replaces Firecrawl [NEW v5]. Perplexity API (`sonar` model) for URL discovery (Stage 0) — replaces Claude [NEW v5]. Anthropic Claude API:
  - `claude-sonnet-4-6` for primary extraction and validation
  - `claude-sonnet-4-6` for bulk summaries and routing
- **Scraper service**: FastAPI + Playwright microservice at `scraper/main.py`. Run with `uvicorn main:app --host 0.0.0.0 --port 8765`. Environment variable `SCRAPER_URL` (default `http://localhost:8765`) [NEW v5].
- **Orchestration**: Trigger.dev v3 for scheduled jobs (scraping, diff detection, alerts, news signal ingestion).
- **Enrichment**: Exa for semantic search of law firm and news commentary. Direct API for World Bank, V-Dem. Scrape (respectfully, with rate limits) for Numbeo, QS, Henley Passport Index. OECD tax treaty database accessed via published PDFs parsed and cached.
- **Email**: Resend for policy change alerts.
- **Archival**: Wayback Machine Save Page Now API for legal defensibility of source snapshots.
- **Deployment**: Cloud Run for Next.js (`apps/web`) and Python scraper (`scraper/`) — `Dockerfile` + `cloudbuild.yaml` + `deploy.cmd`; Supabase cloud; Trigger.dev cloud. Vercel is not used. [NEW v6]
- **Auth**: Supabase Auth (magic link). `apps/web/middleware.ts` enforces auth on `/review`. `NEXT_PUBLIC_APP_URL` carries the canonical origin so callbacks resolve correctly behind Cloud Run. [NEW v6]
- **Monorepo**: pnpm workspaces + Turborepo.
- **Observability**: Sentry for errors, OpenTelemetry traces exported to a cloud provider (suggest Axiom or Better Stack), cost dashboard via a custom Supabase view.

---

## 6. Extraction pipeline architecture [UPDATED]

### 6.1 Pipeline stages

The extraction pipeline now has **seven stages**, not five. Stage 0 (URL Discovery) was added during Phase 2 implementation.

```
Stage 0 — Discover    → find up to 10 URLs per program using Perplexity API (sonar) [NEW v5]
Stage 1 — Scrape      → Python/Playwright scraper service scrapes each discovered URL [NEW v5]
Stage 2 — Extract     → claude-sonnet-4-6 extracts field values with confidence + provenance
Stage 3 — Validate    → separate Claude call verifies source-sentence alignment
Stage 4 — Cross-check → compare against Tier 2 source for disagreement detection
Stage 5 — Human review → queue for values below confidence threshold or with disagreements
Stage 6 — Publish     → approved values written to field_values with full provenance
```

**Wave field configuration:** `scripts/wave-config.ts` exports `WAVE_1_FIELD_CODES` (27 sub-factor codes), `WAVE_2_FIELD_CODES` (the remaining 21), and `ACTIVE_FIELD_CODES = WAVE_1 ∪ (WAVE_2_ENABLED ? WAVE_2 : [])`. `WAVE_2_ENABLED = true` is the Phase 2 close-out default; the canary runner, Trigger.dev `extract-single-program`, `run-paq-score.ts`, and `diag-empty-fields.ts` all run against the full 48-field methodology. Rollback to Wave 1 only = set `WAVE_2_ENABLED = false`. **Note:** Trigger.dev picks up `ACTIVE_FIELD_CODES` at runtime, so production scope changes the moment Trigger.dev redeploys — staged production rollouts must flip the flag to `false` before deploy and back after verification.

**Field-aware content windowing [NEW v6]:** `packages/extraction/src/utils/window.ts` (`selectContentWindow`) replaces the previous `slice(0, 30000)` head-slice. The batch extraction path scores 2K-char chunks (200-char overlap) by per-field keyword match against `field_definitions.label`, then greedily fills a 30K budget while preserving a 1500-char baseline prefix and 800-char baseline suffix. Cache key in `extract.ts` includes a `WINDOW_VERSION` constant so windowing changes invalidate stale `extraction_cache` rows cleanly. Post-fix TRUNCATION = 0 in `diag-empty-fields.ts`.

**Batch extraction + caching [NEW v6]:** `executeBatch` extracts all fields for a single scrape in one LLM call (8K max-tokens, JSON array response). `executeAllFields` iterates batches across URLs and merges by highest confidence per field, with a 30s inter-batch delay and an early-exit once every field reaches confidence ≥ 0.9. The `extraction_cache` table (migration `00004_extraction_caches`) memoizes results keyed by `sha256(contentHash + fieldKey + promptHash + WINDOW_VERSION)`; cache hits skip the LLM entirely. The `scrape_cache` table memoizes scrape responses for 24h; `scrape-guards.ts` rejects empty / HTML-error / anti-bot bodies before they enter extraction.

### 6.2 Stage 0 — URL Discovery [NEW v5: Perplexity replaces Claude]

Before scraping begins, a discovery stage finds the most relevant URLs for each program. This replaces the previous static registry approach where a single URL per program was maintained manually.

**How it works:**

1. The job receives a `programId`, `programName`, and `country`
2. The **Perplexity API** (`sonar` model, `PERPLEXITY_API_KEY` env var) is called with a structured prompt to find up to 10 most relevant pages for that program (live web search at run time — not training knowledge)
3. Results are returned as a `DiscoveryResult` containing up to 10 `DiscoveredUrl` objects
4. The first URL must always be the official national government visa listing page for the specific program (not the homepage)
5. Remaining URLs are supplementary sources at any geographic level
6. The prompt includes country-specific URL patterns (e.g. `immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/…` for Australia) to guide the model to the exact listing page
7. Each discovered URL is verified with a HEAD request; any URL returning HTTP 404 or 410 is discarded before the pipeline continues

**Two-phase discovery [NEW]:** Discovery now runs in two phases:

1. **Phase 1 (country-level):** Four global sources from `scripts/country-sources.ts` (World Bank WGI, OECD Migration Outlook, IMD World Talent Ranking, Migration Policy Institute) are scraped once per country run and shared across all programs in that country. These serve country-level fields (E.3.2, E.1.1, and others).
2. **Phase 2 (program-specific):** `DiscoverStageImpl` runs per-program to discover up to 10 program-specific URLs.

**Updated discovery prompt [UPDATED]:** The Stage 0 prompt now explicitly:

- PRIORITISES pages containing structured field-level criteria data: salary thresholds, occupation/skills lists, government fees, processing times, family inclusion rights, PR/citizenship pathways.
- DEPRIORITISES or EXCLUDES: employer sponsorship process pages, English language test provider lists, generic immigration landing pages, consultation/agent service pages, and news articles.
- Returns URLs ranked by relevance (after the mandatory official listing page), with a `reason` field stating the specific field-level data expected from each URL.
- Enforces a five-category source mix: (1) official government and intergovernmental sources (up to 5 URLs, Tier 1), (2) global and regional institutional sources (Tier 1 if intergovernmental), (3) established immigration law and advisory firms (Tier 2, ranked by field coverage depth), (4) independent visa and residency research publishers (Tier 2, ranked by field coverage depth), and (5) specialist immigration news and professional intelligence sources (Tier 2, ranked by recency and policy-change coverage). An explicit EXCLUSIONS list prohibits login-gated pages, lead-generation pages, social media, forum threads, and non-English pages where an English equivalent exists.

**Model used:** Perplexity API `sonar` model (`PERPLEXITY_API_KEY`) [NEW v5] — URL discovery is the highest-leverage step in the pipeline; wrong URLs at this stage corrupt everything downstream. The `MODEL_DISCOVERY` constant (`claude-sonnet-4-6`) remains defined in `anthropic.ts` but is not used by `discover.ts`.

**Geographic source levels:** Sources are classified at four levels — see Section 6.3.

**Output type:** `DiscoveryResult` (defined in `packages/extraction/src/types/extraction.ts`)

### 6.3 Geographic source level model [NEW]

All discovered URLs are classified by geographic level:

| Level         | Description                                  | Examples                                            |
| ------------- | -------------------------------------------- | --------------------------------------------------- |
| `global`      | Intergovernmental and global datasets        | UN, World Bank, ILO, OECD global                    |
| `continental` | Regional blocs and continental frameworks    | EU directives, ASEAN frameworks, OECD regional      |
| `national`    | Official country-level government pages      | Home Office, IRCC, Dept of Home Affairs             |
| `regional`    | Province, state, canton, emirate-level pages | Ontario PNP, individual Swiss cantons, UAE emirates |

**Important:** Regional government sources (province, canton, emirate) are classified as **Tier 1** alongside national sources. They are official government sources and carry the same data integrity weight.

**Country-level vs program-level field classification [NEW]:**

Within Wave 1 (27 fields), 8 are designated **country-level** — values are consistent across all programs in the same country and served by global sources from `scripts/country-sources.ts`: D.2.1, D.2.2, C.3.1, C.3.2, E.1.1, E.3.2, and 2 others. The remaining 19 Wave 1 fields are **program-specific** and discovered per-program by Stage 0.

### 6.4 Source tier model (updated)

| Tier | Description                                                                                   | Use                                                         |
| ---- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Official government sources at any geographic level (global, continental, national, regional) | Source of record for all Pillar A–D indicators and E.1, E.2 |
| 2    | Law firm and immigration consultant sources (Fragomen, KPMG, Envoy, Baker McKenzie)           | Cross-check and triangulation only                          |
| 3    | News and policy monitoring sources (IMI Daily, Henley newsroom, Expatica)                     | Early-warning signals only                                  |

### 6.5 Multi-URL extraction per program [NEW]

Each program now has up to 10 source URLs (discovered dynamically by Stage 0), compared to the previous single-URL approach. Each URL is scraped and passed to Claude separately in sequence (5s delay between calls to respect rate limits — increased from 2s in Session 8) [NEW v5]. Results are merged at the field level: `executeMulti` runs sequentially across all Tier 1 scrapes and returns the highest-confidence result with its source URL. Field-level provenance tracks which URL produced which value.

The extraction system prompt is extended to handle government page formats where eligibility data appears as bullet-point lists, condition blocks, numbered requirement lists, or table rows rather than standalone labelled values. The model extracts condition text verbatim in these cases rather than treating the field as empty.

**Per-field Tier 2 cross-check source selection [NEW]:** The cross-check stage (Stage 4) no longer defaults to the first available Tier 2 URL. Each available Tier 2 URL is scored by keyword overlap with the field label; the best-matching URL is selected for cross-check. If no program-level Tier 2 URL is relevant to the field, the corresponding global source from `scripts/country-sources.ts` is used as fallback.

---

## 7. Field schema

### 7.1 Existing 22 fields (retained from prototype)

Minimum educational requirement; Minimum work experience; Minimum salary requirement; Language test requirement; Requirement of employer nomination; Number of application steps; Application fees; Expected processing time; Online application portal; Customer support channel information; Rate of approval / rejection; Applicant quota for different streams; Long-term residency or temporary pathway product; Ability to switch employers; Access to public healthcare; Additional work permissions; Benefits for dependents; PR / citizenship provision; Minimum residence period to PR; Minimum residence period to citizenship; Physical presence requirement; Language fluency requirement.

Coverage analysis on the current 25-program sample: best-covered field is 92%, worst-covered is 0% ("Rate of approval / rejection"). 10 of 22 fields are below 50% coverage. The extraction prompts need complete rewriting to address this.

### 7.2 New fields added to close methodology gaps (27 fields)

Mapped directly to the indicator list in METHODOLOGY.md. Key additions:

- **Economic access**: salary threshold as % local median wage; alternative qualification pathways.
- **Human capital**: age cap.
- **Selectivity**: occupation list type; labour market test requirement; employer levies/skill charges.
- **Process**: fast-track option availability; SLA as distinct from informal processing time; biometric/in-person visit count; appeal process clarity.
- **Rights**: labour market test; labour rights (self-employment, secondary income); spouse work rights (automatic / permit / none); dependent child age cap; parent/extended family inclusion; same-sex partner recognition; public education access.
- **Pathway**: PR retention rules; citizenship test burden; dual citizenship permitted; tax residency day trigger; special tax regime availability; territorial vs worldwide taxation; exit tax exposure.
- **Stability**: material policy changes in last 5 years (count with severity); forward-announced pipeline; program age; published approval statistics; published quota; public guidance quality; rule-of-law index; government effectiveness index.

### 7.3 Field definition data model

Each of the 48 indicator fields is represented in `field_definitions` table with:

- `key` (stable machine identifier)
- `label` (human-readable)
- `data_type` (text | numeric | boolean | enum | json)
- `pillar` (A | B | C | D | E)
- `sub_factor` (A.1 | A.2 | A.3 | B.1 | ... | E.3)
- `weight_within_sub_factor` (decimal, sums to 1.0 within sub-factor)
- `extraction_prompt_md` (the exact instruction given to the LLM for this field)
- `scoring_rubric_jsonb` (for categorical indicators, complete mapping from value to score)
- `normalization_fn` (min_max | z_score | categorical | boolean)
- `direction` (higher_is_better | lower_is_better)
- `source_tier_required` (always 1 except Pillar E.3 which accepts external indices)
- `version_introduced` (methodology version)

Extraction prompts must always include the instruction: "If the page does not explicitly state this information, return an empty string. Do not infer, do not bridge from related fields, do not use general knowledge."

---

## 8. Data integrity and verification

### 8.1 Source tiers

- **Tier 1** (source of record): immigration authority, tax authority, ministry of finance, official gazette, statistics bureau — at any geographic level (global, continental, national, regional). All Pillar A–D indicators and Pillar E sub-factors E.1 and E.2 must come from Tier 1 only.
- **Tier 2** (triangulation and context): law firm commentary (Fragomen, KPMG, Envoy, Baker McKenzie), corporate immigration advisories. Used for cross-check and program narrative context only.
- **Tier 3** (ambient intelligence): IMI Daily, Henley newsroom, Expatica, Nomad Gate, general news. Used for policy change early-warning signals only.

External indices (World Bank WGI, V-Dem) are used in Pillar E.3 only and explicitly disclosed.

### 8.2 Verification pipeline

Seven stages per field value (updated from six — Stage 0 and Scrape separated):

0. **Discover** — Perplexity API (`sonar`) finds up to 10 URLs per program via live web search, classified by tier and geographic level [NEW v5]. Prompt prioritises the official government visa listing page and includes country-specific URL patterns. Discovered URLs verified with HEAD requests; 404/410 discarded.
1. **Scrape** — Custom Python/Playwright scraper service (`scraper/main.py`) scrapes each discovered URL [NEW v5]. SHA-256 hash of content recorded.
2. **Extract** — Claude extracts the value, confidence score, exact source sentence, character offsets from each scraped page.
3. **Validate** — separate Claude call reviews whether the extracted value accurately reflects the source sentence.
4. **Cross-check** — compare against Tier 2 source. Disagreement logged.
5. **Human review** — all values below 0.85 on either confidence score, or with cross-check disagreement, or with >5 point PAQ score delta vs previous extraction, enter the review queue.
6. **Publish** — approved values enter `field_values` with full provenance.

### 8.3 Provenance chain

Every published value carries: source URL, geographic level, source tier, scrape timestamp, content hash, exact source sentence, character offsets, extraction model, extraction confidence, validation confidence, cross-check result, reviewer, review timestamp, methodology version. Monetary fields additionally store the original ISO 4217 currency code in `provenance.valueCurrency` so the numeric `valueNormalized` can be FX-converted at scoring time without losing the source unit [NEW v6]. `scripts/verify-provenance.ts` asserts the 13 always-required + 3 approved-only keys (per ADR-007) on every row and exits non-zero on any miss — used in CI and post-canary checks.

### 8.4 Policy change detection

Weekly re-scrape of all Tier 1 sources. Content hash comparison triggers re-extraction. Any indicator value change creates a `policy_change_event` with severity (minor / material / breaking). Wayback archival of source page. Email alert via Resend. Dashboard timeline update.

---

## 9. Model assignment by task [NEW]

| Task                           | Model / Service                    | Constant / Key         | Reason                                                                            |
| ------------------------------ | ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| URL Discovery (Stage 0)        | Perplexity API `sonar` [NEW v5]    | `PERPLEXITY_API_KEY`   | Live web search; highest-leverage step — wrong URLs corrupt everything downstream |
| Scraping (Stage 1)             | Python/Playwright service [NEW v5] | `SCRAPER_URL`          | Full browser rendering for JS-heavy government pages; no Firecrawl API needed     |
| Primary extraction (Stage 2)   | `claude-sonnet-4-6`                | `MODEL_EXTRACTION`     | Accuracy and instruction-following for structured extraction                      |
| Validation (Stage 3)           | `claude-sonnet-4-6`                | `MODEL_VALIDATION`     | Independent verification requires same capability level                           |
| Cross-check (Stage 4)          | `claude-sonnet-4-6`                | `MODEL_CROSSCHECK`     | Same capability level as extraction for reliable agreement detection              |
| Bulk summaries                 | `claude-sonnet-4-6`                | `MODEL_SUMMARY`        | Speed and cost efficiency for high-volume summarisation                           |
| E.3.2 Government Effectiveness | World Bank API (direct) [NEW v5]   | `ISO3_TO_ISO2` mapping | Direct authoritative source; no LLM extraction needed; confidence 1.0             |

---

## 10. Database schema (core tables)

```sql
countries (iso_code PK, name, region, imd_rank, imd_appeal_score, imd_appeal_score_cme_normalized, gov_portal_url, tax_authority_url, last_imd_refresh)

programs (id PK, country_iso FK, name, category, status [active|suspended|closed], launch_year, closure_year, description_md, created_at, updated_at)

sources (id PK, program_id FK, url UNIQUE, tier [1|2|3], geographic_level [global|continental|national|regional], source_category [imm_authority|tax_authority|gazette|stats|lawfirm|news|external_index], is_primary, scrape_schedule_cron, last_scraped_at, last_content_hash)

field_definitions (id PK, key UNIQUE, label, data_type, pillar, sub_factor, weight_within_sub_factor, extraction_prompt_md, scoring_rubric_jsonb, normalization_fn, direction, source_tier_required, version_introduced)

field_values (id PK, program_id FK, field_definition_id FK, value_raw TEXT, value_normalized JSONB, value_indicator_score DECIMAL, source_id FK, provenance JSONB, status [draft|approved|rejected|superseded], extracted_at, reviewed_by, reviewed_at, methodology_version_id FK)

scores (id PK, program_id FK, methodology_version_id FK, scored_at, cme_score, paq_score, composite_score, pillar_scores JSONB, sub_factor_scores JSONB, data_coverage_pct DECIMAL, flagged_insufficient_disclosure BOOL)

scrape_history (id PK, source_id FK, scraped_at, http_status, content_hash, raw_markdown_storage_path, extraction_job_id, status)

policy_changes (id PK, program_id FK, field_definition_id FK, previous_value_id FK, new_value_id FK, detected_at, severity [minor|material|breaking], paq_delta, summary_text, summary_human_approved BOOL, wayback_url)

methodology_versions (id PK, published_at, version_tag SEMVER, framework_structure JSONB, pillar_weights JSONB, sub_factor_weights JSONB, indicator_weights JSONB, normalization_choices JSONB, rubric_versions JSONB, cme_paq_split JSONB, change_notes MD, created_by)

review_queue (id PK, field_value_id FK, flagged_reason, priority, assigned_to, status, resolved_at)

news_signals (id PK, source_url, publication, detected_at, matched_programs JSONB, summary, triggered_review_queue_id FK NULLABLE)

sensitivity_runs (id PK, methodology_version_id FK, run_type [weight_mc|normalization|aggregation|cme_paq|dropout|correlation], run_at, results JSONB)
```

> **[NEW]** The `sources` table now includes a `geographic_level` column to classify each source as global, continental, national, or regional.

Row Level Security on every table. Authenticated team members can write. Public reads limited to approved `field_values`, current `scores`, current `methodology_versions`, approved `policy_changes`, public `programs` metadata.

---

## 11. Repository structure

```
gtmi/
├── apps/
│   ├── web/                   # Next.js 15 public dashboard
│   └── admin/                 # Internal dashboard (route group /admin)
├── packages/
│   ├── db/                    # Supabase types, migrations, seed scripts
│   ├── extraction/            # Pipeline interfaces, Claude extraction/validation, extraction prompts
│   │   └── src/
│   │       ├── clients/       # anthropic.ts
│   │       ├── stages/        # discover.ts [NEW], extract.ts, validate.ts, etc.
│   │       └── types/         # extraction.ts, pipeline.ts, provenance.ts
│   ├── scoring/               # Deterministic scoring engine
│   ├── verification/          # Validation, cross-check, review queue logic
│   ├── enrichment/            # IMD, World Bank WGI, V-Dem, QS, Numbeo integrations
│   ├── sensitivity/           # All 6 sensitivity analyses, Monte Carlo runner
│   └── shared/                # Types, zod schemas, utilities
├── jobs/                      # Trigger.dev jobs
├── scraper/                   # Python/Playwright scraper service [NEW v5]
│   ├── main.py                # FastAPI + Playwright scraper; POST /scrape, GET /health
│   ├── requirements.txt       # fastapi, uvicorn, playwright
│   └── README.md              # Setup and run instructions
├── scripts/
│   ├── canary-run.ts          # Full 7-stage pipeline runner; --country AUS|SGP CLI arg
│   ├── wave-config.ts         # WAVE_1_FIELD_CODES (27) + WAVE_2_FIELD_CODES (21); ACTIVE_FIELD_CODES (consumers import this)
│   └── country-sources.ts     # Global/country-level source registry; fetchWgiScore; ISO3_TO_ISO2 [UPDATED]
├── docs/
│   ├── BRIEF.md               # Build specification v4 (current)
│   ├── METHODOLOGY.md         # Methodology v2 (current)
│   ├── architecture.md        # Mermaid diagrams
│   ├── runbook.md             # Operational procedures
│   ├── decisions/             # ADRs, numbered
│   └── existing-assets/       # CSV exports of original xlsx files
├── supabase/
│   ├── migrations/
│   └── seed/
├── .github/workflows/
├── turbo.json
├── package.json
└── README.md
```

---

## 12. Build sequence

### Phase 1 (foundation) — COMPLETE

- Monorepo scaffolded with pnpm workspaces, Turborepo, TypeScript strict, ESLint, Prettier, Husky, Changesets.
- Supabase staging and production projects created.
- Core schema migrations shipped. RLS policies in place.
- Seed data loaded: 30 countries, 85 programs, 85 sources, 10 news signal sources, 48 field_definitions.
- CI green: lint, typecheck, migration dry-run, schema tests, methodology unit test.
- Extraction package scaffold: Anthropic and Firecrawl client factories, all pipeline stage interfaces, Trigger.dev stub job.

### Phase 2 (extraction canary) — ✅ COMPLETE (tag `phase-2-complete`, 2026-04-27)

**Final canary outcomes (deterministic, both `phase2Placeholder: true`):**

| Program                         | Coverage (extraction) | Auto-approved | Queued | PAQ   | CME   | Composite |
| ------------------------------- | --------------------- | ------------- | ------ | ----- | ----- | --------- |
| AUS Skills in Demand 482 — Core | 30/48 (62.5%)         | 6             | 24     | 13.72 | 22.53 | 16.36     |
| SGP S Pass                      | 34/48 (70.8%)         | 6             | 28     | 18.11 | 24.14 | 19.92     |

Both flagged `insufficient_disclosure` (auto-approved coverage below pillar threshold, expected until /review backfill). Calibration of normalization params deferred to Phase 3 (cohort too thin: 4 numeric fields with approved values, 3 with n=1).

**Completed in Phase 2:**

- `GeographicLevel`, `DiscoveredUrl`, `DiscoveryResult`, `DiscoverStage` types defined
- `ExtractionPipeline` updated to include `discover` as Stage 0
- `MODEL_DISCOVERY = 'claude-sonnet-4-6'` added as dedicated model constant
- `countries.csv` corrected with 2025 IMD Appeal factor data and ISO codes; seed bug fixed
- Migration `00003_update_imd_appeal_scores.sql` created
- GitHub Actions CI workflow committed (lint, typecheck, migration dry-run on push/PR to main)
- `packages/db/drizzle.config.ts` connected to `DATABASE_URL` via `.env` at monorepo root
- `jobs/trigger.config.ts` connected to real Trigger.dev project (`proj_wqkutxouuojvjdzsqopp`); `maxDuration: 900`; dev server running
- Stage 0 — Discover implemented and wired into Trigger.dev job
- Stage 1 — Scrape implemented (Firecrawl; SHA-256 hash; Tier 1 throws, Tier 2/3 logs)
- Stage 2 — Extract implemented (`claude-sonnet-4-6`; `executeMulti` runs sequentially with 2s inter-scrape delay; highest-confidence wins across Tier 1 sources)
- Stage 2 — Extraction system prompt extended: handles bullet-point eligibility lists, condition blocks, numbered requirement lists, and table rows as explicit statements
- Stage 3 — Validate implemented (independent confidence score)
- Stage 4 — Cross-check implemented (Tier 2 comparison; disagreements logged)
- Stage 5 — Human review logic implemented (queue flagging rules)
- Stage 6 — Publish implemented (full provenance chain to `field_values`)
- Deterministic scoring engine: `packages/scoring` created with 99 passing tests
- Three normalization schemes implemented: min-max, z-score, categorical rubric
- `normalizeRawValue` normalization layer: converts raw extracted strings to typed primitives (`number | string | boolean`) before DB write (`normalize-raw.ts`, 26 tests)
- Missing data penalty and insufficient-disclosure flagging implemented
- Unique constraint added on `field_values (program_id, field_definition_id)`; publish stage uses `onConflictDoUpdate` for idempotent re-runs
- Discovery cap increased from 5 to 10 URLs per program; discovery prompt extended with official-listing-page-first instruction and country-specific URL patterns
- `canary-run.ts` fully implemented: per-field progress logging, `try/catch` error recovery per field, 3s per-field delay, discovered-URL listing after Stage 0
- `canary-run.ts` accepts `--country AUS|SGP` CLI argument; runs independently per country
- Wave field config: `scripts/wave-config.ts` exports `WAVE_1_FIELD_CODES` (27), `WAVE_2_FIELD_CODES` (21), and `ACTIVE_FIELD_CODES`; `WAVE_2_ENABLED = true` activates 48-field coverage; rollback = one flag change
- Country-level source registry: `scripts/country-sources.ts` created; 4 global sources (World Bank WGI, OECD Migration Outlook, IMD World Talent Ranking, Migration Policy Institute); `getCountryLevelSources(fieldKey)` helper
- Two-phase discovery: country-level Phase 1 loads global sources once per country run; program-specific Phase 2 runs `DiscoverStageImpl` per program
- Per-field Tier 2 cross-check source selection: Tier 2 URLs scored by keyword match against field label; global source fallback if no program Tier 2 matches
- `validate.ts` crash fix: character-offset mismatch converted from exception to `console.warn` + safe return; field enters human review queue instead of aborting pipeline
- `publish.ts` currency sanitization: currency-formatted strings (e.g. `AUD3,210.00`) stripped to numeric before normalization; NaN guard skips field with `console.warn` instead of throwing
- `discover.ts` prompt update: field-data prioritisation (salary, fees, occupation lists, processing times, family rights, PR pathways); deprioritises sponsor/test/consultation/news pages; results ranked by relevance with field-data reason
- `discover.ts` source mix expanded to five categories: (1) official govt/intergovernmental (up to 5, Tier 1), (2) global institutional (Tier 1), (3) immigration law/advisory firms (Tier 2), (4) independent visa/residency research publishers (Tier 2), (5) specialist immigration news/intelligence (Tier 2); rule (4) updated to include national legislative sources and specialist immigration intelligence sources; explicit EXCLUSIONS block added
- `publish.ts` normalizeRawValue type fix: pass `rawAsString` (string) instead of `_numericValue` (number) to `normalizeRawValue`; resolves type mismatch — `normalizeRawValue` signature is `(valueRaw: string, ...)` and calls `.replace()`, `.trim()`, `.toLowerCase()` on the input
- AUS canary run complete: 27/48 fields attempted (Wave 1), 14 fields extracted values, 13 no value (content truncation at 30K chars), 0 auto-approved (all queued for human review)
- Stage 0 switched to Perplexity API (`sonar` model, `PERPLEXITY_API_KEY`): `discover.ts` fully rewritten; no longer uses Claude or `web_search_20250305` tool [NEW v5]
- Stage 1 switched to custom Python/Playwright scraper service: `scrape.ts` rewritten to call local FastAPI service at `SCRAPER_URL`; `scraper/` directory created with `main.py`, `requirements.txt`, `README.md` [NEW v5]
- `extract.ts` rate-limit retry: 3 retries on HTTP 429 with exponential back-off (base 60s × attempt) [NEW v5]
- `extract.ts` inter-scrape delay increased from 2000ms to 5000ms in `executeMulti` [NEW v5]
- `extract.ts` system prompt extended with strict per-field-type output format rules (numeric: base value only; categorical: 1–5 word label; text: 20-word max summary; count: integer only) [NEW v5]
- `extract.ts` + `validate.ts` `stripJsonFences`: now also extracts first `{...}` JSON object from unstructured response text (handles model preamble before JSON) [NEW v5]
- `validate.ts` early return: when `valueRaw === ''`, skip LLM call entirely and return `isValid: false` with `validationConfidence: 1.0` [NEW v5]
- `canary-run.ts` E.3.2 direct World Bank API: E.3.2 now pre-fetched in Phase 1 via `fetchWgiScore(countryArg)`; bypasses LLM extraction; `extractionModel: 'world-bank-api-direct'`; auto-approved at confidence 1.0 [NEW v5]
- `canary-run.ts` cross-check bypassed: Stage 4 hardcoded to `not_checked` in canary since all Tier 1 + global sources feed into `executeMulti` (no separate cross-check source needed) [NEW v5]
- `canary-run.ts` per-field rate-limit delay increased from 3s to 25s (multi-scrape inputs push close to 30K token/min limit) [NEW v5]
- `country-sources.ts` additions: `ISO3_TO_ISO2` mapping table; `fetchWgiScore(countryIso3)`; `fetchAllWgiScores(countryIsos)` [NEW v5]

**Phase 2 close-out (Sessions 9–10) — all shipped [NEW v6]:**

- Field-aware content windowing (`packages/extraction/src/utils/window.ts`) replaces 30K head-slice. 10 unit tests; TRUNCATION = 0 post-fix.
- Wave 2 enabled — `WAVE_2_ENABLED = true`, `ACTIVE_FIELD_CODES` covers all 48 methodology fields, all four consumers switched.
- AUS + SGP canaries: 30/48 and 34/48 fields populated respectively; provenance verifier passed on every row from these runs.
- Currency preservation: `utils/currency.ts` (`detectCurrency()`) + `provenance.valueCurrency`; `scripts/backfill-monetary-normalization.ts` re-normalizes pre-fix pending rows.
- Calibration attempt: `scripts/compute-normalization-params.ts --programs AUS,SGP` returned only 4 numeric fields with approved values (3 of them n=1) — too thin to swap in. Calibration deferred to Phase 3 once ≥5 programs are scored. AUS and SGP scored with engineer-chosen ranges and tagged `phase2Placeholder: true`.
- /review reject flow patched (FormData id binding, try/catch with `console.error`, `.returning()` row-update reporting).
- Tier-1 URL refresh: 2 AUS + 2 SGP soft-404 URLs replaced; ATO sources added for AUS tax fields.
- Six LLM_MISS prompts retuned with recall hints (A.1.2, B.3.1, C.2.1, D.2.2, D.2.4, E.1.1).
- ADR-008: Wayback Machine archival deferred from Phase 2 (Stage 1) to Phase 5, co-located with re-scrape diff detection.

**Operational scripts shipped during Phase 2:**

- `scripts/verify-provenance.ts` — read-only verifier with CI exit-code semantics.
- `scripts/sync-prompts-from-seed.ts` — push `methodology-v1.ts` `extractionPromptMd` into live `field_definitions`.
- `scripts/purge-orphan-pending.ts` — delete pending_review rows with incomplete provenance (dry-run by default).
- `scripts/backfill-monetary-normalization.ts` — re-normalize pre-currency-fix rows.
- `scripts/audit-phase2.ts`, `scripts/audit-scrape-cache.ts`, `scripts/purge-bad-scrapes.ts`.

**Carry-overs into Phase 3 (per Phase 2 retrospective):**

1. URL drift monitoring — schedule a monthly HEAD-check job in Trigger.dev (Phase 5 living-index work or sooner if Phase 3 fans out first).
2. Calibration — Phase 3 must run `compute-normalization-params.ts` as the first scoring step once ≥5 programs are scored, then replace the engineer-chosen ranges in `run-paq-score.ts` before any non-placeholder scores are persisted.
3. Auto-approve rate is a methodology lever — tightening prompts lifts confidence; loosening the dual-confidence threshold trades it for false positives. /review queue is the relief valve; Phase 4 dashboard scope assumes a working reviewer cadence.

### Phase 3 (5-country V1) — PENDING

### Phase 4 (public dashboard) — PENDING

### Phase 5 (living index + coverage push) — PENDING [NEW v6]

Expanded scope from the original "weekly re-scrape only" framing. Phase 5 also addresses the Phase 2 retrospective finding that AUS+SGP+CAN converge at 30–34/48 today — driven by source-discovery gaps, not pipeline failure. Six sub-phases ranked by leverage:

- **5.1 Living-index policy monitoring** — weekly re-scrape, hash-diff, severity classification, Wayback archival (per ADR-008), Tier 3 news-signal ingestion via Exa, Resend alerts on material/breaking changes. Unlocks Pillar E.1.x cohort-wide.
- **5.2 V-Dem direct-API** — `fetchVdemRuleOfLawScore(iso3)` mirroring the World Bank API path already in production. Closes Pillar E.3 cohort-wide. ~1 day engineering.
- **5.3 Cross-departmental discovery audit** — per-country source-department registry expansion (immigration, tax, statistics bureau, gazette, regional). Discovery prompt rewritten to enumerate the cross-departmental set explicitly and re-prompt on missing departments. Unlocks Pillar D.3.x tax fields and E.2.x transparency fields cohort-wide. Re-canary the 5-country pilot.
- **5.4 Cohort-wide prompt sweep** — systematic LLM_MISS triage and prompt revision until LLM_MISS converges to 0 across the cohort. Six prompts hinted in Session 10; the remaining 42 haven't had a serious revision pass since Phase 1.
- **5.5 Tier 2 backfill methodology revision (ADR-013)** — relaxed the Tier-1-only rule for selected indicators outside the scoring core, with `sourceTier: 2` flag visible in provenance. Unlocks ~2–3 fields per programme where Tier 1 truly has nothing.
- **5.6 Methodology v2 indicator review (ADR-014)** — audit indicators that return `not_addressed` on >50% of the cohort post-5.3 + 5.4. Decide per-indicator: keep, drop and re-normalize sub-factor weights, restructure as boolean, or country-substitute. Methodology v2.0.0 published; existing scores keep their v1 stamp.

**Realistic per-programme coverage target after 5.1–5.6: 42–44/48 (43 average).** The remaining 4–6 indicators are either methodology gaps (the indicator we defined doesn't correspond to data anyone publishes) or country-specific transparency gaps (e.g. Bahrain, Saudi Arabia, UAE don't publish admission statistics in any structured form; E.2.1 is permanently null for those countries). The credibility play is "publish only what we can defensibly source, surface what's missing per programme" — not 100% coverage with fudged values. The `insufficient_disclosure` flag is the safety net for programmes below 70% coverage on any pillar.

### Phase 6 (scale and enrichment) — PENDING

Onboard the remaining 60 programmes to reach the full 85-programme cohort across IMD Top 30. OECD tax treaty database supplements Pillar D.3. Annual IMD Appeal refresh job. Methodology whitepaper published. Open internal beta to TTR Group strategy clients.

---

## 13. Operational requirements

- All code changes via PR with one approval minimum.
- All migrations reviewed by the other contributor before merge.
- Any methodology change is an ADR and increments `methodology_versions`.
- All LLM calls logged: prompt, response, model, token count, timestamp, cost.
- Daily cost dashboard: LLM (Anthropic + Perplexity), Supabase, Cloud Run (web + scraper), Trigger.dev, Wayback (Phase 5+).
- Weekly data-quality report: field coverage %, review queue backlog, policy changes detected, news signals triaged.

---

## 14. Do not

- Do not let the LLM infer values. If the government page does not state it, it is empty.
- Do not let Tier 2 or Tier 3 sources populate production fields.
- Do not make scoring non-deterministic. LLMs extract, the engine scores.
- Do not copy Henley's weights, factor names, or framing.
- Do not recompute historical scores when methodology changes. Each score carries its version.
- Do not allow expert override of rankings.
- Do not commit secrets. Ever.
- Do not rebuild the n8n workflow. Migrate, do not port.
- Do not ship without provenance display on every data point.
- Do not import the existing 25 extracted rows. Re-extract from scratch.

---

## 15. Migration from existing assets

Contributor B has built:

- n8n workflow with 24 nodes (exported as `Visa_Data_Scraper___Selected_Countries.json`) — **being retired**.
- `Talent_Program_Registry.xlsx` — seeded into database.
- `Program_Specifications.xlsx` — not imported; re-extraction required.

Migration steps:

1. Import both xlsx files into `docs/existing-assets/` as CSV.
2. Seed `countries` from IMD Appeal Top 30.
3. Seed `programs` and `sources` (Tier 1) from Government Source Registry. Preserve original URLs.
4. Seed news signal sources (Tier 3) from Residency News Sources.
5. Seed `field_definitions` from the 48-indicator schema in METHODOLOGY.md.
6. Do not import existing extracted values. Re-extract clean.
7. Retire n8n. The pipeline is Trigger.dev.
8. Keep Google Sheets alive as a human-readable mirror, synced one-way from the database via a nightly export job.

---

_Last updated: Session 10 — Phase 2 closed (`phase-2-complete`). AUS + SGP scored with `phase2Placeholder: true`. Field-aware content windowing, Wave 2 enabled (48 fields), currency preservation, batch extraction + caches, /review on Cloud Run with Supabase auth, ADR-008 Wayback deferral (Szabi/Ayush)._
