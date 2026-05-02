# Global Talent Mobility Index (GTMI) — Methodology v6

> **Document status:** Canonical methodology specification v6. Supersedes v5 — Phase 3.9 close 2026-05-02 expanded the derive scope from 7 indicators to **12 indicators** (ADR-025) and added the country-agnostic anti-bot blocker registry + Wayback-first routing + URL-merge filter (ADR-024). Coverage maximization closed at Phase 3.9. Phase 3.10 = pre-scale wiring + readiness pass before the 5-country pilot. Wayback partially un-deferred (now used as a blocker fallback, not yet as the canonical archive). Changes from v5 are marked `[NEW v6]`.

> **Last updated:** 2 May 2026 (Phase 3.9 close-out, Sessions 15–17). Phase 3.9 shipped: per-scrape GCS archive snapshots (W0); native-language scrape + translation pipeline (W2); per-country cross-departmental authority registry (W3); per-program discovery hints (W5); weekly maintenance scrape via Trigger.dev (W6, ADR-023); discovery telemetry (W8); `extraction_attempts` history (W9); yield-ranked URL merge (W10); hash-based extraction short-circuit (W11); surgical re-run modes including `--mode narrow / gate-failed / rubric-changed / field / archive-first / archive-only` (W12); Stage-0 missing-fields brief (W14); country-agnostic anti-bot blocker detection across hash_equality / thin_fanout / challenge_fanout signals + Wayback-first routing (W15+W16, ADR-024); in-memory PDF integration tests (W17); five new derives — country-level D.2.4 / D.3.1 / D.3.3 + program-age E.1.3 + policy-history E.1.1 (W20+W21, ADR-025); URL-merge filter against `blocker_domains` (W22). Total derive coverage now **12/48 fields**: A.1.2, B.2.4, D.1.2, D.1.3, D.1.4, D.2.2, D.2.3, D.2.4, D.3.1, D.3.3, E.1.1, E.1.3. NLD HSM canary 44/48; JPN HSP canary 23/48 (bounded by ISA's all-paths anti-bot wall, captured in `blocker_domains`).

---

## 0. Purpose and audience

The Global Talent Mobility Index (GTMI) is a composite indicator that benchmarks the world's talent-based premium mobility programs. It measures how effectively a country's visa architecture attracts, admits, retains, and integrates highly skilled international talent.

This methodology document is the canonical reference. It is written to satisfy three audiences simultaneously:

- A sovereign client evaluating whether to commission a program design project from TTR Group, who must be able to trust the ranking without reservation.
- A peer-reviewer (for example, OECD, IMD, or academic methodologist) who must be able to replicate our results from the raw data and this document alone.
- An end user browsing the interactive dashboard, who must be able to understand, in plain language, what each score means.

Everything described here must be published on the public methodology page. There are no hidden formulas. There is no unpublished expert override. The index is fully reproducible.

---

## 1. Framework

### 1.1 Theoretical foundation

Building a composite index correctly begins with theory, not data. The theoretical structure we adopt is a nested three-layer hierarchy:

```
GTMI Composite Score (0–100)
├── Country Mobility Environment (CME) — 30%
│   └── Sourced from IMD World Talent Ranking "Appeal" factor, re-normalized
│
└── Program Architecture Quality (PAQ) — 70%
    ├── Pillar A: Access      (weight within PAQ: 28%)
    ├── Pillar B: Process     (weight within PAQ: 15%)
    ├── Pillar C: Rights      (weight within PAQ: 20%)
    ├── Pillar D: Pathway     (weight within PAQ: 22%)
    └── Pillar E: Stability   (weight within PAQ: 15%)

        Each pillar has 2–4 sub-factors.
        Each sub-factor has 1–5 indicators (data fields).
```

### 1.2 Why this split between Country Environment and Program Architecture

The central design question was: should the index rank programs purely on their own architecture, or also incorporate country context?

- A pure program-only ranking (PAQ only) would give Bahrain's Golden Residency the same credit as Switzerland's L-Permit if their architecture scored identically, even though a skilled worker would almost always prefer the latter. This would not be credible.
- A pure country ranking (CME only) would reproduce the IMD ranking and add no value.
- A 50/50 blend would overweight country context and dilute the product's differentiation.

We settle on 30% CME / 70% PAQ. The rationale:

- The user's core decision question is "which visa do I pursue?" PAQ must dominate because it's what the user can compare.
- 30% is high enough to be decisive when programs are otherwise close.
- 30% is low enough that a well-designed program in a mid-tier country can still outrank a poorly designed program in a top-tier country.

The split is formally tested in the sensitivity analysis (section 8). Under alternative splits of 20/80, 25/75, 35/65, 40/60, and 50/50, the top-10 ordering changes by at most 2 positions at the 50/50 extreme.

### 1.3 The five pillars of Program Architecture Quality

**Pillar A: Access (28%).** Who can even apply? Highest pillar weight because selection criteria are the single biggest determinant of real-world utility.

**Pillar B: Process (15%).** How hard is the application itself? Measures friction, cost, speed, and administrative clarity.

**Pillar C: Rights (20%).** What can the visa holder actually do once granted? Measures labor market, family, and practical freedoms.

**Pillar D: Pathway (22%).** Where does the visa lead? Measures clarity and attainability of progression to permanent residence and citizenship.

**Pillar E: Stability (15%).** How reliable is this promise? Measures policy volatility, transparency, and institutional reliability. GTMI's most proprietary pillar.

---

## 2. Scoring Hierarchy and Units

All scores are on a 0–100 scale.

```
Indicator Score (0–100)
  ↓ weighted sum within sub-factor
Sub-Factor Score (0–100)
  ↓ weighted sum within pillar
Pillar Score (0–100)
  ↓ weighted sum across pillars
Program Architecture Quality (PAQ) Score (0–100)
  ↓ combined with Country Mobility Environment
GTMI Composite Score (0–100)
```

Weights at each level sum to 1.0 within their parent. Aggregation is weighted arithmetic mean. Compensability between pillars is accepted and disclosed.

---

## 3. Normalization

### 3.1 Min-max normalization (bounded continuous numerics)

```
indicator_score = 100 × (x − x_min) / (x_max − x_min)
```

Inverted for "lower is better" indicators:

```
indicator_score = 100 × (x_max − x) / (x_max − x_min)
```

`x_min` and `x_max` are across all 85 programs in the scoring set.

### 3.2 Z-score standardization (skewed distributions)

```
z = (x − μ) / σ
indicator_score = 100 × Φ(z)
```

Used where min-max would produce distortion due to outliers. Choice determined statistically per indicator using Shapiro-Wilk normality test.

### 3.3 Categorical and ordinal scoring

Published ordinal rubric per categorical indicator. LLMs extract the value; the scoring engine deterministically maps to the rubric score.

### 3.4 Boolean indicators

Binary: 0 or 100. Direction specified per indicator.

### 3.5 Null and missing data

Not imputed. See section 7.5 for penalty mechanism.

---

## 4. The Country Mobility Environment (CME) — 30%

Anchored on the IMD World Talent Ranking 2025 **Appeal** sub-index specifically — not the overall ranking. Re-normalized to 0–100 across our 30-country cohort using min-max within cohort (min = 53.08, Oman; max = 93.07, Switzerland). Updated annually within 30 days of IMD's release.

### 4.2 Confirmed 2025 country universe (Appeal factor Top 30)

| Rank | Country        | ISO | Appeal Score | CME Normalized |
| ---- | -------------- | --- | ------------ | -------------- |
| 1    | Switzerland    | CHE | 93.07        | 100.00         |
| 2    | Netherlands    | NLD | 74.22        | 52.89          |
| 3    | Ireland        | IRL | 74.14        | 52.69          |
| 4    | Luxembourg     | LUX | 69.63        | 41.39          |
| 5    | Iceland        | ISL | 67.72        | 36.61          |
| 6    | Germany        | DEU | 67.21        | 35.34          |
| 7    | Canada         | CAN | 66.87        | 34.49          |
| 8    | Sweden         | SWE | 64.07        | 27.49          |
| 9    | Singapore      | SGP | 62.73        | 24.14          |
| 10   | Belgium        | BEL | 62.52        | 23.61          |
| 11   | Austria        | AUT | 62.37        | 23.23          |
| 12   | UAE            | ARE | 62.16        | 22.71          |
| 13   | Australia      | AUS | 62.09        | 22.53          |
| 14   | Japan          | JPN | 60.92        | 19.61          |
| 15   | Norway         | NOR | 59.40        | 15.81          |
| 16   | Taiwan         | TWN | 58.96        | 14.71          |
| 17   | Lithuania      | LTU | 58.26        | 13.96          |
| 18   | USA            | USA | 57.11        | 10.08          |
| 19   | Finland        | FIN | 57.01        | 9.83           |
| 20   | Hong Kong      | HKG | 56.57        | 8.73           |
| 21   | Malaysia       | MYS | 56.51        | 8.58           |
| 22   | Chile          | CHL | 56.34        | 8.15           |
| 23   | Saudi Arabia   | SAU | 56.34        | 8.15           |
| 24   | Namibia        | NAM | 55.51        | 6.08           |
| 25   | France         | FRA | 55.06        | 4.95           |
| 26   | United Kingdom | GBR | 54.81        | 4.33           |
| 27   | Estonia        | EST | 54.16        | 2.70           |
| 28   | New Zealand    | NZL | 53.56        | 1.20           |
| 29   | Bahrain        | BHR | 53.44        | 0.90           |
| 30   | Oman           | OMN | 53.08        | 0.00           |

Normalization formula: `CME = 100 × (score − 53.08) / (93.07 − 53.08)`

---

## 5. The Program Architecture Quality (PAQ) — 70%

### Pillar A — Access (28% of PAQ)

**A.1 Economic access (40% of pillar)**

| Indicator                                        | Weight | Normalization | Direction          |
| ------------------------------------------------ | ------ | ------------- | ------------------ |
| A.1.1 Minimum salary threshold (USD-equivalent)  | 50%    | z-score       | lower is better    |
| A.1.2 Salary threshold as % of local median wage | 30%    | min-max       | lower is better    |
| A.1.3 Alternative qualification pathways         | 20%    | categorical   | more flex = better |

**A.2 Human capital requirements (35% of pillar)**

| Indicator                              | Weight | Normalization | Direction             |
| -------------------------------------- | ------ | ------------- | --------------------- |
| A.2.1 Minimum educational requirement  | 35%    | categorical   | lower is better       |
| A.2.2 Minimum work experience (years)  | 35%    | min-max       | lower is better       |
| A.2.3 Language proficiency requirement | 30%    | categorical   | less onerous = better |

**A.3 Structural selectivity (25% of pillar)**

| Indicator                            | Weight | Normalization | Direction                 |
| ------------------------------------ | ------ | ------------- | ------------------------- |
| A.3.1 Occupation list constraint     | 40%    | categorical   | more open = better        |
| A.3.2 Annual quota presence and size | 35%    | categorical   | no quota = better         |
| A.3.3 Applicant age cap              | 25%    | min-max       | no cap or higher = better |

### Pillar B — Process (15% of PAQ)

**B.1 Time to decision (40% of pillar)**

| Indicator                                    | Weight | Normalization | Direction          |
| -------------------------------------------- | ------ | ------------- | ------------------ |
| B.1.1 Published SLA processing time (days)   | 50%    | min-max       | shorter = better   |
| B.1.2 Fast-track option availability and SLA | 30%    | categorical   | available = better |
| B.1.3 Number of application steps            | 20%    | min-max       | fewer = better     |

**B.2 Direct cost (35% of pillar)**

| Indicator                                           | Weight | Normalization | Direction      |
| --------------------------------------------------- | ------ | ------------- | -------------- |
| B.2.1 Principal applicant fees (USD)                | 40%    | z-score       | lower = better |
| B.2.2 Per-dependant fees (USD)                      | 25%    | z-score       | lower = better |
| B.2.3 Employer-borne levies and skill charges (USD) | 20%    | z-score       | lower = better |
| B.2.4 Mandatory non-government costs                | 15%    | z-score       | lower = better |

**B.3 Digital and administrative access (25% of pillar)**

| Indicator                                | Weight | Normalization      | Direction               |
| ---------------------------------------- | ------ | ------------------ | ----------------------- |
| B.3.1 Online application availability    | 40%    | categorical        | online-first = better   |
| B.3.2 In-person / biometric requirement  | 35%    | min-max (inverted) | fewer = better          |
| B.3.3 Appeal and refusal process clarity | 25%    | categorical        | clear + timely = better |

### Pillar C — Rights (20% of PAQ)

**C.1 Labor market flexibility (45% of pillar)**

| Indicator                                         | Weight | Normalization      | Direction             |
| ------------------------------------------------- | ------ | ------------------ | --------------------- |
| C.1.1 Employer-sponsorship requirement            | 30%    | categorical        | not required = better |
| C.1.2 Ability to switch employers                 | 30%    | categorical        | free switch = better  |
| C.1.3 Self-employment and secondary income rights | 25%    | categorical        | permitted = better    |
| C.1.4 Labor market test requirement               | 15%    | boolean (inverted) | not required = better |

**C.2 Family rights (35% of pillar)**

| Indicator                                   | Weight | Normalization         | Direction           |
| ------------------------------------------- | ------ | --------------------- | ------------------- |
| C.2.1 Spouse inclusion and work rights      | 40%    | categorical           | automatic = better  |
| C.2.2 Dependent child age cap and inclusion | 25%    | min-max + categorical | higher cap = better |
| C.2.3 Parent or extended family inclusion   | 20%    | boolean               | available = better  |
| C.2.4 Same-sex partner recognition          | 15%    | boolean               | recognized = better |

**C.3 Access to public services (20% of pillar)**

| Indicator                                  | Weight | Normalization | Direction          |
| ------------------------------------------ | ------ | ------------- | ------------------ |
| C.3.1 Public healthcare access             | 50%    | categorical   | automatic = better |
| C.3.2 Public education access for children | 50%    | categorical   | automatic = better |

### Pillar D — Pathway (22% of PAQ)

**D.1 Permanent residence pathway (50% of pillar)**

| Indicator                                          | Weight | Normalization      | Direction        |
| -------------------------------------------------- | ------ | ------------------ | ---------------- |
| D.1.1 PR provision available                       | 30%    | boolean            | yes = 100        |
| D.1.2 Minimum years of residence to PR             | 30%    | min-max            | shorter = better |
| D.1.3 Physical presence requirement during accrual | 20%    | min-max (inverted) | fewer = better   |
| D.1.4 PR retention rules                           | 20%    | min-max (inverted) | fewer = better   |

**D.2 Citizenship pathway (35% of pillar)**

| Indicator                                        | Weight | Normalization      | Direction          |
| ------------------------------------------------ | ------ | ------------------ | ------------------ |
| D.2.1 Citizenship provision available            | 30%    | boolean            | yes = 100          |
| D.2.2 Total minimum years to citizenship         | 30%    | min-max (inverted) | shorter = better   |
| D.2.3 Dual citizenship permitted                 | 20%    | boolean            | permitted = better |
| D.2.4 Civic / language / integration test burden | 20%    | categorical        | lower = better     |

**D.3 Tax treatment for new talent (15% of pillar)**

| Indicator                                | Weight | Normalization | Direction            |
| ---------------------------------------- | ------ | ------------- | -------------------- |
| D.3.1 Tax residency trigger (days/yr)    | 36%    | min-max       | more days = better   |
| D.3.2 Special regime available           | 44%    | categorical   | available = better   |
| D.3.3 Territorial vs. worldwide taxation | 20%    | categorical   | territorial = better |

### Pillar E — Stability (15% of PAQ)

**E.1 Policy stability (50% of pillar)**

| Indicator                                     | Weight | Normalization      | Direction          |
| --------------------------------------------- | ------ | ------------------ | ------------------ |
| E.1.1 Material policy changes in last 5 years | 50%    | z-score (inverted) | fewer = better     |
| E.1.2 Forward-announced pipeline changes      | 30%    | boolean            | announced = better |
| E.1.3 Program age (years, capped at 20)       | 20%    | min-max            | older = better     |

**E.2 Transparency (30% of pillar)**

| Indicator                                             | Weight | Normalization   | Direction                |
| ----------------------------------------------------- | ------ | --------------- | ------------------------ |
| E.2.1 Published approval rate or admission statistics | 40%    | boolean + value | published = better       |
| E.2.2 Published quota / cap information               | 30%    | categorical     | fully disclosed = better |
| E.2.3 Public guidance and decision criteria           | 30%    | categorical     | comprehensive = better   |

**E.3 Institutional quality (20% of pillar)**

| Indicator                                       | Weight | Normalization | Direction       |
| ----------------------------------------------- | ------ | ------------- | --------------- |
| E.3.1 Rule of law (V-Dem / World Bank WGI)      | 50%    | re-normalized | higher = better |
| E.3.2 Government effectiveness (World Bank WGI) | 50%    | re-normalized | higher = better |

---

## 6. Source model [UPDATED]

### 6.1 Source tiers

| Tier | Description                                         | Pillars                    |
| ---- | --------------------------------------------------- | -------------------------- |
| 1    | Official government sources at any geographic level | A, B, C, D, E.1, E.2       |
| 2    | Law firm and immigration consultant sources         | Cross-check only           |
| 3    | News and policy monitoring                          | Early-warning signals only |

External indices (World Bank WGI, V-Dem) used in Pillar E.3 only, explicitly disclosed.

### 6.2 Geographic source levels [NEW]

All sources are classified by geographic level. This classification affects discovery priority and provenance display but does not change the tier assignment.

| Level         | Description                                  | Examples                                 |
| ------------- | -------------------------------------------- | ---------------------------------------- |
| `global`      | Intergovernmental and global datasets        | UN, World Bank, ILO, OECD global         |
| `continental` | Regional bloc frameworks                     | EU directives, ASEAN, OECD regional      |
| `national`    | Official country-level government pages      | Home Office, IRCC, Dept of Home Affairs  |
| `regional`    | Province, state, canton, emirate-level pages | Ontario PNP, Swiss cantons, UAE emirates |

**Regional government sources are Tier 1.** Province-level, canton-level, and emirate-level official government pages carry the same data integrity weight as national pages. Some fields (particularly regional quota data, provincial nominee programs, and canton-specific tax rules) are only available at the regional level.

### 6.3 Multi-source extraction per program [NEW]

Each program is now extracted from up to 10 sources, discovered dynamically by Stage 0 of the pipeline using the Perplexity API [NEW v3]. Sources span multiple geographic levels where relevant. Field-level provenance records which specific URL produced which value.

**Two-phase discovery [NEW]:** Before program-specific discovery runs, a country-level source pre-load phase (Phase 1) scrapes 4 global sources once per country from `scripts/country-sources.ts`: World Bank WGI, OECD Migration Outlook, IMD World Talent Ranking, and Migration Policy Institute. These serve country-level fields (E.3.2, E.1.1, and others) and are shared across all programs in the same country run. Program-specific Stage 0 discovery (Phase 2) then finds the remaining program-level sources.

**Country-level vs program-level field classification [NEW]:** Fields are pre-classified as either country-level (served primarily by global sources; values are consistent across all programs in a country) or program-level (discovered per-program by Stage 0). In Wave 1 (27 fields), 8 are country-level (D.2.1, D.2.2, C.3.1, C.3.2, E.1.1, E.3.2, and 2 others) and 19 are program-specific.

**Wave field configuration:** `scripts/wave-config.ts` defines `WAVE_1_FIELD_CODES` (27 sub-factor codes), `WAVE_2_FIELD_CODES` (the remaining 21), and `ACTIVE_FIELD_CODES = WAVE_1 ∪ (WAVE_2_ENABLED ? WAVE_2 : [])`. `WAVE_2_ENABLED = true` is the Phase 2 close-out default and shipped on `main`; extraction covers the full 48-field methodology end-to-end. Setting `WAVE_2_ENABLED = false` reverts to the original Wave 1 staging scope. This is an operational staging decision, not a methodology change — methodology weights and definitions are unchanged across waves. Trigger.dev picks up `ACTIVE_FIELD_CODES` at runtime; staged production rollouts must flip the flag before Trigger.dev redeploys.

**Discovery priority order:**

1. Official national government visa listing page for the specific program (always required as URL 1 — not the homepage, not a news article)
   1a. Country-level fields are pre-populated from global sources (World Bank WGI, OECD, IMD, MPI) before program-specific discovery begins.
2. Official regional government page (if relevant — e.g., provincial nominee programs)
3. Official continental or global source (if relevant — e.g., EU Blue Card directive)
4. Tier 2 cross-check source (law firm)
5. Additional Tier 1 supplementary pages (fees page, processing times page, forms, etc.)
   6–10. Additional high-value pages where available; only included if they genuinely add coverage

---

## 7. Data Integrity and Handling

### 7.1 Government-source-only for PAQ

Every indicator in Pillars A through D, and sub-factors E.1 and E.2, must be populated from a Tier 1 government source at any geographic level. No exceptions.

Pillar E.3 is explicitly sourced from external indices (World Bank WGI, V-Dem). Disclosed on methodology page.

### 7.2 Seven-stage verification pipeline [UPDATED]

0. **Discover** — Perplexity API (`sonar` model, `PERPLEXITY_API_KEY`) [NEW v3] performs live web search to find up to 10 URLs per program. Classifies each URL by tier and geographic level. Prompt prioritises the official government visa listing page and includes country-specific URL patterns. Enforces a five-category source mix: (1) official govt/intergovernmental sources (up to 5, Tier 1), (2) global and regional institutional sources (Tier 1), (3) immigration law/advisory firms (Tier 2, ranked by field coverage depth), (4) independent visa/residency research publishers (Tier 2, ranked by field coverage depth), and (5) specialist immigration news/intelligence sources (Tier 2, ranked by recency). An explicit EXCLUSIONS list prohibits login-gated pages, lead-generation pages, social media, and forum content. Discovered URLs verified with HEAD requests; any returning 404 or 410 is discarded before the pipeline continues.
1. **Scrape** — Custom Python/Playwright scraper service (`scraper/main.py`, FastAPI + Playwright) scrapes each discovered URL with full browser rendering. SHA-256 hash recorded. `scrape_cache` table memoizes responses for 24h; `scrape-guards.ts` rejects empty / HTML-error / anti-bot bodies before they enter extraction [NEW v4].
2. **Extract** — Claude extracts value, confidence, exact source sentence, character offsets. The extraction system prompt treats government-page list formats as explicit statements: bullet-point eligibility lists, condition blocks, numbered requirement lists, and table rows are all valid value sources. Strict per-field-type output format rules: numeric fields return the base value only (minimum of a range); categorical fields return a 1–5 word label; text fields return a 20-word max summary; count fields return an integer only. Field-aware content windowing (`utils/window.ts`) selects relevance-scored 2K chunks (200-char overlap) within a 30K budget keyed on `field_definitions.label`, with a 1500-char baseline prefix and 800-char baseline suffix; replaces the previous head-slice [NEW v4]. Batch extraction (`executeAllFields`) extracts all `ACTIVE_FIELD_CODES` from a single scrape in one LLM call (8K max-tokens, JSON array), merging across URLs by highest confidence per field, with a 30s inter-batch delay and an early-exit once every field reaches confidence ≥ 0.9 [NEW v4]. `extraction_cache` table memoizes results keyed on `sha256(contentHash + fieldKey + promptHash + WINDOW_VERSION)`; cache hits skip the LLM entirely [NEW v4]. Rate-limit retry: 3 attempts on HTTP 429 with exponential back-off (60s × attempt). Coverage-gap sentinels (`not_addressed` / `not_found`) are skipped at publish so absence is honest in coverage math [NEW v4].
   2.5. **Derive (ADR-016, ADR-025) [UPDATED v6]** — Between Stage 2 and Stage 3, a deterministic step computes **12 indicators** without invoking the LLM:

   | Indicator                                                   | Source                                     | Model                 | Confidence |
   | ----------------------------------------------------------- | ------------------------------------------ | --------------------- | ---------- |
   | A.1.2 — Salary % of median wage                             | OECD AAW / ILO mean earnings + FX          | `derived-computation` | 0.6        |
   | B.2.4 — Mandatory non-government costs                      | `country-non-gov-costs.ts`                 | `derived-knowledge`   | 0.7        |
   | D.1.2 — Years to PR                                         | `country-pr-timeline.ts`                   | `derived-knowledge`   | 0.7        |
   | D.1.3 — PR-accrual physical presence                        | `country-pr-presence.ts`                   | `derived-knowledge`   | 0.7        |
   | D.1.4 — PR retention rules                                  | `country-pr-presence.ts`                   | `derived-knowledge`   | 0.7        |
   | D.2.2 — Years to citizenship                                | D.1.2 + `country-citizenship-residence.ts` | `derived-computation` | 0.6        |
   | D.2.3 — Dual citizenship policy                             | `country-citizenship-policy.ts`            | `derived-knowledge`   | 0.7        |
   | D.2.4 — Civic / language / integration test burden [NEW v6] | `country-civic-test-policy.ts`             | `derived-knowledge`   | 0.7        |
   | D.3.1 — Tax residency trigger (days/yr) [NEW v6]            | `country-tax-residency.ts`                 | `derived-knowledge`   | 0.7        |
   | D.3.3 — Territorial vs. worldwide taxation [NEW v6]         | `country-tax-basis.ts`                     | `derived-knowledge`   | 0.7        |
   | E.1.1 — Severity-weighted policy-change count [NEW v6]      | `program-policy-history.ts`                | `derived-knowledge`   | 0.7        |
   | E.1.3 — Program age (capped at 20) [NEW v6]                 | `programs.launch_year`                     | `derived-computation` | 0.6        |

   All derived rows route to human review before publication (every confidence is below the 0.85 auto-approve threshold). Skip conditions (input field absent; FX or median-wage table miss; D.1.1 false / no PR pathway; entry exists but value is null — e.g. NLD facts-and-circumstances tax residency; programs.launch_year is null) emit a one-line log and write no row — the missing-data penalty applies normally. The mechanism is country-agnostic by construction: per-country and per-programme data lives in lookup tables under `packages/extraction/src/data/`; the derive functions in `packages/extraction/src/stages/derive.ts` contain no per-country branches.

3. **Validate** — separate Claude call verifies source-sentence alignment. Independent confidence score. Skip optimisation: when `valueRaw` is empty, validation returns `isValid: false` / `validationConfidence: 1.0` without an LLM call [NEW v3].
4. **Cross-check [UPDATED v6 / Phase 3.10]** — compare the extracted value against a Tier 2 source. Selectively activated for auto-approve candidates only: when a row would otherwise pass the dual-confidence threshold, `crossCheck.execute()` runs against ONE Tier 2 scrape from the merged set. Disagreements veto auto-approve and route the row to /review with `provenance.crossCheckResult='disagree'` recorded for the reviewer. Pending-review rows skip the cross-check (human eyes already cover them). Tier 2 source selection is per-field: available Tier 2 URLs are ranked by keyword overlap with the field label; the best-matching URL is used. Global sources from `scripts/country-sources.ts` serve as fallback if no program-level Tier 2 URL is relevant to the field. Cost impact: ~$0.02–$0.04 per programme. **History:** Phase 2 → Phase 3.9 hardcoded `not_checked` because all sources fed `executeAllFields`; that trade-off is now reversed since cross-check runs against ONE source instead of all of them.
5. **Human review** — values below 0.85 confidence on either stage, cross-check disagreements, or >5 point PAQ delta vs previous extraction.
6. **Publish** — approved values enter `field_values` with full provenance.

### 7.3 Provenance chain per indicator value [UPDATED]

Every published value carries: source URL, **geographic level**, **source tier**, scrape timestamp, content hash, exact source sentence, character offsets, extraction model, extraction confidence, validation model, validation confidence, cross-check result, reviewer, review timestamp, methodology version. Monetary fields additionally carry **`provenance.valueCurrency`** — the original ISO 4217 currency code stripped from the raw string before numeric normalization, so the numeric `valueNormalized` can be FX-converted at scoring time without losing the source unit [NEW v4]. `scripts/verify-provenance.ts` asserts the 13 always-required + 3 approved-only keys (per ADR-007) on every row and exits non-zero on any miss — used in CI and post-canary checks.

### 7.4 Living index and policy change detection

All Tier 1 sources re-scraped weekly (Phase 6). Content hash comparison triggers re-extraction. Severity classification:

- **Breaking**: PAQ change >5 points.
- **Material**: PAQ change 1–5 points.
- **Minor**: PAQ change <1 point, or non-scoring text changes.

Wayback Machine archival co-located with the re-scrape diff path (Phase 6) — see ADR-008 for the deferral rationale.

### 7.5 Missing data and edge case handling

- **Missing Data Penalty**: indicator excluded from sub-factor; weights re-normalized; sub-factor score multiplied by `(present / total)^0.5`. Scoring ingests only `status='approved'` rows, so coverage in scores reflects the dual-confidence (extraction + validation ≥ 0.85) auto-approval threshold combined with /review queue completion — not pipeline failure.
- **Insufficient Disclosure**: programs below 70% data coverage on any pillar flagged and excluded from public top list. Both Phase 2 canaries (AUS, SGP) flagged at close-out — expected at this cohort size; expected to clear once /review queue is worked through.
- **Phase 2 placeholder flag**: scores computed with engineer-chosen normalization ranges (rather than calibrated p10/p90 percentiles from a real distribution) carry `metadata.phase2Placeholder = true` on the `scores` row and must not be published publicly. Calibration is the first scoring step in Phase 5 once ≥5 programs are scored, after which the flag clears [NEW v4].
- **Stability Edge Case (E.1.1)**: programs younger than 3 years use within-country cohort mean substitution for E.1.1, falling back to global cohort mean if fewer than two mature programs exist in country. Flagged in provenance record.
- **Derived fields (12 indicators) [UPDATED v6 / ADR-016 + ADR-025]**: A.1.2, B.2.4, D.1.2, D.1.3, D.1.4, D.2.2, D.2.3, D.2.4, D.3.1, D.3.3, E.1.1, E.1.3 are computed after batch extraction. All route to /review on confidence 0.6 (`derived-computation`) or 0.7 (`derived-knowledge`). If input fields are absent, or the country lookup has no entry, or the entry's value is structurally null (e.g. NLD facts-and-circumstances tax residency, GCC monarchies' naturalisation pathway), the derived field stays empty and the missing-data penalty applies. The reviewer accepts/rejects the computation; auto-approval is impossible by construction (every confidence is hard-coded below the 0.85 threshold). The categorical scales follow the methodology-v1 rubrics exactly; severity weights for E.1.1 (major=3 / moderate=2 / minor=1) follow the methodology's major/moderate/minor definitions.

### 7.5.1 Coverage philosophy and realistic ceiling [NEW v5]

GTMI does not target 100% indicator coverage as a quality metric. Some indicators we defined do not correspond to data any government publishes (e.g. several E.2.x transparency indicators are permanently null for jurisdictions that don't publish admission statistics in structured form — Bahrain, Saudi Arabia, UAE). The credibility design is:

> publish only what we can defensibly source, surface what's missing per programme, and let the reader apply their own credibility weighting via the `insufficient_disclosure` flag.

The realistic per-programme ceiling, post the Phase 5 coverage push, is **42–44/48 (43 average)**. The remaining 4–6 unfilled indicators per programme fall into three categories, each with a designed handling:

1. **Genuine country-level transparency gaps** — the country does not publish the underlying data. Indicator stays null; sub-factor missing-data penalty applies; if pillar coverage drops below 70%, the program is `insufficient_disclosure`-flagged and withheld from the public ranking. No methodology change required.
2. **Indicators that do not correspond to publishable data anywhere** — methodology v2 review (Phase 5.6, ADR-014) decides per indicator whether to drop, restructure as boolean, or country-substitute. Methodology weights re-normalize at v2; existing v1 scores keep their v1 stamp (no retroactive recomputation).
3. **Indicators outside the Pillar A-D scoring core where Tier 1 is silent but Tier 2 covers the gap** — methodology v3 review (Phase 5.5, ADR-013) authorises Tier 2 backfill for the allowlisted indicators, with `sourceTier: 2` flag visible in the provenance display so the reader sees the credibility tradeoff.

Phase 3 (`docs/IMPLEMENTATION_PLAN.md` §Phase 3) sequences the five coverage work-streams that drive coverage from today's 30–34/48 baseline (AUS, SGP, CAN canaries) toward the 42–44/48 ceiling before the 5-country pilot: V-Dem direct API, cross-departmental discovery audit, cohort-wide prompt sweep, Tier 2 backfill ADR, and methodology v2 review. Living-index policy monitoring is a separate Phase 6 deliverable.

### 7.6 LLM use boundaries

LLMs are used for:

- **URL discovery** — Perplexity API (`sonar`) finds the most relevant sources per program [NEW v3: Perplexity replaces Claude for this step]
- **Extraction** — Claude extracts specific field values from scraped page content
- **Source-sentence identification** and validation
- **Summary generation** for policy change events (subject to human review)

External APIs (non-LLM) used for specific fields [NEW v3]:

- **World Bank API** — E.3.2 (Government Effectiveness) fetched directly from `api.worldbank.org/v2/country/{iso2}/indicator/GE.EST`; no LLM extraction; confidence 1.0

LLMs are never used for:

- Scoring (fully deterministic)
- Inference of missing values (missing is missing)
- Weight determination (theory-driven, hard-coded)
- Ranking override (no expert adjustment layer)
- Derived-field computation (Stage 6.5). 12 indicators are deterministic arithmetic or knowledge-lookup over already-extracted inputs plus static lookup tables and the programs row — no model is invoked, and the reviewer (not the model) accepts the computation [UPDATED v6 / ADR-016 + ADR-025].

---

## 8. Robustness and Sensitivity Analysis

Six analyses published with every release:

1. **Weight sensitivity (Monte Carlo)** — 1,000 random weight vectors from Dirichlet distribution, ±20% perturbation. Median rank, 5th–95th percentile band, Spearman ρ.
2. **Normalization sensitivity** — pure min-max, pure z-score, distance-to-frontier alternatives.
3. **Aggregation sensitivity** — geometric mean at pillar level vs baseline.
4. **CME/PAQ split sensitivity** — 20/80, 25/75, 35/65, 40/60, 50/50.
5. **Indicator dropout test** — drop one indicator at a time; flag if any program moves >5 ranks.
6. **Correlation and redundancy** — Pearson matrix; ρ > 0.8 within sub-factor triggers review.

---

## 9. Reproducibility and Versioning

- Every methodology change is an ADR with rationale, date, contributors, and specific diff.
- Given a `methodology_version_id` and complete `field_values`, re-running the scoring engine produces byte-identical scores.
- The methodology page auto-renders from the database's current `methodology_version` record. No separate copy.

---

## 10. What GTMI does not claim to measure

- GTMI does not measure lived experience.
- GTMI does not capture informal practice.
- GTMI does not rank countries for permanent immigration planning for HNW clients.
- GTMI does not constitute legal advice.

---

## Appendix A — Categorical rubrics

[To be exhaustively enumerated in implementation. Versioned with methodology_version.]

## Appendix B — External data sources

- IMD World Talent Ranking (Appeal factor): `https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-talent-ranking/`
- World Bank Worldwide Governance Indicators: `https://info.worldbank.org/governance/wgi/`
- V-Dem Institute: `https://v-dem.net/`
- OECD Tax Treaty Database: `https://www.oecd.org/tax/treaties/`
- QS World University Rankings: `https://www.topuniversities.com/`
- Henley Passport Index (reference only): `https://www.henleyglobal.com/passport-index/`
- OECD Annual Average Wages (primary for OECD members; A.1.2 derivation, ADR-016): `https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE`
- ILOSTAT Mean Earnings (fallback for non-OECD members; A.1.2 derivation, ADR-016): `https://ilostat.ilo.org/topics/wages/`
- World Bank Official exchange rate (LCU per USD, period average; FX conversion for A.1.2): `https://data.worldbank.org/indicator/PA.NUS.FCRF`

## Appendix C — Citations of methodological authority

- Nardo, M., Saisana, M., Saltelli, A., Tarantola, S. (2008). _Handbook on Constructing Composite Indicators: Methodology and User Guide._ OECD Publishing and European Commission Joint Research Centre.
- IMD World Competitiveness Center. _Methodology of the World Talent Ranking._
- OECD Indicators of Talent Attractiveness: Methodology cross-reference for pillar structure validation.

## Appendix D — Phase 2 implementation changes [NEW]

The following changes were made during Phase 2 implementation. All have been formally approved as ADRs 002–007 (2026-04-19).

| Change                                  | Description                                                                                                                                                                                                                                                                          | ADR status                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Stage 0 added to pipeline               | URL Discovery stage using `claude-sonnet-4-6` (`MODEL_DISCOVERY`)                                                                                                                                                                                                                    | Accepted — ADR-002        |
| Geographic source level model           | Four-level classification: global, continental, national, regional                                                                                                                                                                                                                   | Accepted — ADR-003        |
| Regional sources = Tier 1               | Province, canton, emirate-level official pages classified as Tier 1                                                                                                                                                                                                                  | Accepted — ADR-004        |
| Multi-URL extraction                    | Up to 10 URLs per program, discovered dynamically                                                                                                                                                                                                                                    | Accepted — ADR-005        |
| `MODEL_DISCOVERY` constant              | Dedicated model constant for discovery stage                                                                                                                                                                                                                                         | Accepted — ADR-006        |
| Provenance extended                     | Geographic level and source tier added to provenance record                                                                                                                                                                                                                          | Accepted — ADR-007        |
| Wave field config                       | `scripts/wave-config.ts`; `WAVE_1_FIELD_CODES` (27) + `WAVE_2_FIELD_CODES` (21); `ACTIVE_FIELD_CODES` is the canonical export; `WAVE_2_ENABLED` flag                                                                                                                                 | No ADR — operational      |
| Two-phase discovery                     | Country-level sources pre-loaded once; program-level discovery per program                                                                                                                                                                                                           | No ADR — operational      |
| Per-field Tier 2 selection              | Cross-check scores Tier 2 URLs by field label keyword match; global fallback                                                                                                                                                                                                         | No ADR — operational      |
| `validate.ts` resilience                | Offset mismatch logs `console.warn` + safe return instead of crashing                                                                                                                                                                                                                | No ADR — bug fix          |
| Stage 0 five-category source mix        | SOURCE MIX REQUIREMENT expanded: five named categories (official govt, global institutional, law firms, independent research publishers, specialist news); tier rule (4) updated; EXCLUSIONS block added                                                                             | No ADR — operational      |
| `publish.ts` normalizeRawValue type fix | Pass `rawAsString` (string) instead of `_numericValue` (number) to `normalizeRawValue`; resolves runtime crash on `.replace()`/`.trim()` when input is numeric                                                                                                                       | No ADR — bug fix          |
| Stage 0 switched to Perplexity API      | `discover.ts` rewritten to call Perplexity API (`sonar` model, `PERPLEXITY_API_KEY`) instead of Claude `web_search_20250305`. Same prompt logic, five-category source mix, and HEAD request verification. `MODEL_DISCOVERY` constant retained but unused by `discover.ts`.           | No ADR — tooling decision |
| Stage 1 switched to Python/Playwright   | `scrape.ts` rewritten to call local FastAPI + Playwright service (`scraper/main.py`) at `SCRAPER_URL` instead of Firecrawl. Full browser rendering. `scraper/` directory added. Must be started before running pipeline.                                                             | No ADR — tooling decision |
| E.3.2 World Bank API direct             | `canary-run.ts` now pre-fetches E.3.2 (Government Effectiveness) from World Bank API in Phase 1 via `fetchWgiScore()`. Bypasses LLM extraction for this field; `extractionModel: 'world-bank-api-direct'`; auto-approved at confidence 1.0.                                          | No ADR — operational      |
| Cross-check bypassed in canary          | `canary-run.ts` Stage 4 hardcoded to `not_checked` because all Tier 1 + global sources are merged into `executeMulti` inputs; separate Tier 2 cross-check is redundant when all sources are already used for extraction. Trigger.dev job retains proper cross-check.                 | No ADR — operational      |
| `extract.ts` rate-limit retry           | 3 retries on HTTP 429 with exponential back-off (60s × attempt number). After 3 failures, throws.                                                                                                                                                                                    | No ADR — bug fix          |
| `executeMulti` inter-scrape delay       | Increased from 2000ms to 5000ms to reduce rate-limit pressure from multi-scrape inputs.                                                                                                                                                                                              | No ADR — operational      |
| `extract.ts` strict output format rules | System prompt extended: numeric → base value only; categorical → 1–5 word label; text → 20-word max summary; count → integer only. `sourceSentence` still verbatim.                                                                                                                  | No ADR — operational      |
| `stripJsonFences` improvement           | `extract.ts` and `validate.ts`: fallback now extracts first `{...}` JSON object from text when no code fences present (handles models that prepend explanatory text before JSON).                                                                                                    | No ADR — bug fix          |
| `validate.ts` empty-value skip          | When `valueRaw === ''`, validation returns `isValid: false` / `validationConfidence: 1.0` immediately without an LLM call. Reduces token usage on no-extraction fields.                                                                                                              | No ADR — operational      |
| Canary per-field rate-limit delay       | Increased from 3s to 25s between fields. Reason: multi-scrape inputs (up to 5 × 30K chars ≈ 37.5K tokens) plus validation call approaches 30K token/min rate limit.                                                                                                                  | No ADR — operational      |
| `country-sources.ts` WGI helpers        | `ISO3_TO_ISO2` lookup table, `fetchWgiScore(countryIso3)`, and `fetchAllWgiScores(countryIsos)` added.                                                                                                                                                                               | No ADR — operational      |
| Field-aware content windowing [NEW v4]  | `packages/extraction/src/utils/window.ts` (`selectContentWindow`) replaces 30K head-slice. Relevance-scored 2K chunks (200-char overlap) within a 30K budget keyed on field labels, with 1500-char baseline prefix and 800-char baseline suffix. Cache key carries `WINDOW_VERSION`. | No ADR — operational      |
| Wave 2 enabled [NEW v4]                 | `WAVE_2_ENABLED = true`; `ACTIVE_FIELD_CODES = WAVE_1 ∪ WAVE_2` covers all 48 methodology fields. All consumers — canary, Trigger.dev, scoring, diagnostic — switched to `ACTIVE_FIELD_CODES`.                                                                                       | No ADR — operational      |
| Currency preservation [NEW v4]          | `utils/currency.ts` (`detectCurrency()`) recognises 19 ISO 4217 codes + symbols. `publish.ts` strips the prefix before normalization and writes the code into `provenance.valueCurrency`. `scripts/backfill-monetary-normalization.ts` re-normalizes pre-fix rows.                   | No ADR — operational      |
| Batch extraction + caches [NEW v4]      | `executeAllFields` batches all `ACTIVE_FIELD_CODES` per scrape into one LLM call; merges across URLs by highest confidence; early-exits at confidence ≥ 0.9 across every field; 30s inter-batch delay. `extraction_cache` and `scrape_cache` tables (migration `00004`).             | No ADR — operational      |
| Coverage-gap sentinels [NEW v4]         | `not_addressed` / `not_found` for categorical fields are skipped at publish so absence is honest in scoring coverage math.                                                                                                                                                           | No ADR — operational      |
| Phase 2 placeholder flag [NEW v4]       | `scores.metadata.phase2Placeholder = true` set whenever `run-paq-score.ts` uses engineer-chosen normalization ranges. Public publication blocked until calibration replaces the placeholder ranges (Phase 3 first step once ≥5 programs scored).                                     | No ADR — operational      |
| Wayback archival deferred [NEW v4]      | Moved out of Phase 2 (Stage 1) into Phase 5 (co-located with re-scrape diff and policy-change events).                                                                                                                                                                               | Accepted — ADR-008        |
| /review UI on Cloud Run [NEW v4]        | `apps/web/app/review` deployed to Cloud Run via `Dockerfile` + `cloudbuild.yaml`. Supabase magic-link auth; route protection in `middleware.ts`; `NEXT_PUBLIC_APP_URL` carries the canonical origin so callbacks resolve correctly.                                                  | No ADR — operational      |

## Appendix E — Phase 3.6 implementation changes [NEW v5]

Eight commits on branch `phase-3-recanary-prep` (Session 12, 28 Apr 2026). See `docs/IMPLEMENTATION_PLAN.md` Phase 3.6 section for the full per-commit breakdown.

| Change                                        | Description                                                                                                                                                                                                                                                               | ADR status                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Migration 00010 (3 bundled concerns)          | (a) `sources` schema additions: `last_seen_at`, `discovered_by`, `geographic_level`; UNIQUE(url) → UNIQUE(program_id, url). (b) Methodology v2 column reconciliation for C.3.2 + 4 boolean_with_annotation fields. (c) Tier 2 allowlist expansion to B.2.3, B.2.4, D.2.4. | ADR-013 amended; ADR-015 schema                                                      |
| C.3.2 country-substitute dispatch fix (Fix B) | Migration 00010 column reconciliation makes the canary's existing `executeCountrySubstitute` filter actually match — silently disabled at runtime since Phase 3.5                                                                                                         | No ADR — bug fix                                                                     |
| V-Dem direct-API for E.3.1 (Fix A)            | `fetchVdemRuleOfLawScore` mirrors E.3.2 WGI pattern; gated on `PHASE3_VDEM_ENABLED` (default true per Q5)                                                                                                                                                                 | No ADR — operational; methodology line 309 already accepted "V-Dem / World Bank WGI" |
| Scrape thin-content threshold (Fix C)         | `MIN_VISIBLE_TEXT_LENGTH` 300 → 1500; on `short_content`, retry once via `force_layer: 'jina'`; persistent thinness logs `SCRAPE_THIN_CONTENT` and treats as ABSENT                                                                                                       | No ADR — operational                                                                 |
| Derived fields A.1.2 + D.2.2 (Fix D)          | Stage 6.5 — pure deterministic arithmetic; no LLM. Confidence hard-coded 0.6; routes to /review. Three static lookup tables (median wage, FX, citizenship residence).                                                                                                     | **ADR-016 — APPROVED 2026-04-28**                                                    |
| Self-improving sources table (Fix E)          | Stage 0 write-back to `sources` (cache-hit + cache-miss); merge utility combines fresh Stage 0 with 90-day registry; cap 12; tier ordering with quotas 7/4/1; never downgrade tier on conflict; live-DB integration test against staging.                                 | **ADR-015 — APPROVED 2026-04-28**                                                    |
| Tier 2 allowlist expansion (Fix E')           | `tier2_allowed = true` for B.2.3, B.2.4, D.2.4 in addition to original ADR-013 set. C.2.1 considered and excluded — scoring-core Pillar C carve-out from ADR-013 stands.                                                                                                  | ADR-013 amended                                                                      |

## Appendix F — Phase 3.6.2 implementation changes [NEW v6]

Single-commit close-out on branch `phase-3-recanary-prep`. See `docs/IMPLEMENTATION_PLAN.md` Phase 3.6.2 section for the per-ITEM breakdown.

| Change                                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                             | ADR status                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Country-level derives B.2.4 / D.1.3 / D.1.4 (ITEM 2)   | Stage 6.5 derive paths against new lookup tables `country-non-gov-costs.ts` (B.2.4) and `country-pr-presence.ts` (D.1.3 / D.1.4). All three are country-deterministic per ADR-013/014 research; the right shape is a derive path, not another Tier 2 fallback round. Confidence 0.7; routes to /review. Lookup table headers carry analyst-reviewable notes — values must be re-checked before each new country canary. | Extends ADR-016                    |
| Maintenance mode `PHASE3_TARGETED_RERUN` (ITEM 3)      | When `'true'`: precision brief into Stage 0 listing missing indicators, full registry excluded from re-discovery, LLM extraction filtered to missing-only. Default `false`. Derives run regardless of the flag.                                                                                                                                                                                                         | No ADR — operational               |
| Dynamic URL cap + tier quotas (ITEM 4)                 | `dynamicUrlCap(populatedFieldCount)` returns 20 / 15 / 12 by coverage band; `dynamicTierQuotas(cap)` scales the 60/30/10 ratio proportionally. Replaces hard-coded `DEFAULT_URL_CAP=15`.                                                                                                                                                                                                                                | No ADR — operational               |
| Provenance-based URL pre-loading (ITEM 5)              | `loadProvenUrlsForMissingFields` returns URLs that produced approved rows for the same field key in OTHER programs in the SAME country. Cross-country contamination prevented by the `programs.country_iso` SQL filter. Third merge origin (registry → proven → fresh).                                                                                                                                                 | No ADR — operational               |
| `field_url_index` view + paused weekly scrape (ITEM 6) | Migration 00012 creates a denormalised projection of `field_values` + provenance + `field_definitions` for URL-centric queries. `weekly-maintenance-scrape.ts` registered as a Trigger.dev task but PAUSED (no `schedules.task` block); Phase 5 activates with cron `0 3 * * 1`. `policy_changes.severity` accepts `'url_broken'` (varchar(20) no CHECK; type-side widening only).                                      | ADR-018 forthcoming for activation |
| Rollup classifier — synthetic POPULATED (ITEM 1)       | `audit-empty-fields-rollup.ts` now classifies country-substitute-regional, derived-knowledge, derived-computation, v-dem-api-direct, world-bank-api-direct rows as POPULATED. Surfaces true coverage; pre-fix AUS displayed at 44/48 instead of the actual 45/48.                                                                                                                                                       | No ADR — bug fix                   |

---

_Last updated: Session 10 — Phase 2 closed (`phase-2-complete`). AUS + SGP scored with `phase2Placeholder: true`. Field-aware content windowing, Wave 2 enabled (48 fields), currency preservation, batch extraction + caches, /review on Cloud Run with Supabase auth, ADR-008 Wayback deferral (Szabi/Ayush)._
