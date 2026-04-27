# GTMI extraction prompt engineering — patterns

This is the running reference for Stage 2 (extract) prompt design. Captured
during the Phase 3.3 prompt sweep against the post-Phase-2 baseline. Each
pattern names a recurring failure mode, the recall hint that fixes it, and
the indicator codes where it landed.

The intended audience is whoever adds an indicator to the methodology, or
whoever revisits a stale prompt because a new country joins the cohort.
Reading this before writing a prompt should save the same iteration loop
twice.

## Triage taxonomy

When a field appears as `LLM_MISS` in the gap register
(`docs/phase-3/baseline-gaps.csv`), classify it before rewriting:

| Failure mode   | Definition                                                                                         | Fix                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recall         | The value is on the page; the prompt's vocabulary doesn't match the page's vocabulary.             | Add synonyms, country-specific name lists, named-system anchors.                                                                                                          |
| Format         | The model found the value but returned it in the wrong structure.                                  | Tighten output spec; add a worked example of a valid output.                                                                                                              |
| Negative-match | The model returned empty when the page does state an answer (often "0" or "none").                 | Make the empty-vs-zero distinction explicit; name the cases where 0 / "none" applies.                                                                                     |
| Boundary       | The page Stage 0 discovered doesn't contain the answer; a sibling page on the same authority does. | NOT a prompt problem. Address in Phase 3.2 (department-aware discovery) or with a deeper-link discovery pass. Mark the field PROMPT_UNCERTAIN; do not rewrite the prompt. |

The taxonomy is intentionally small. Hard cases land in Boundary and are
documented; we don't chase them with prompt changes that pad the prompt
without fixing the underlying gap.

## Pattern library

### 1. Country-specific named-system anchors (Recall)

**Failure**: the prompt enumerates portal/system names from a few countries
(ImmiAccount, GOV.UK) but a new country uses a different name (Canada's
"Express Entry profile", "PR Portal", "Authorized Paid Representative
Portal"). Model returns empty because none of the named anchors match.

**Fix**: maintain a per-country anchor list in the prompt. When extending
the cohort, the first thing to do for every "named-system" field is add
the new country's named systems to the anchor list. Don't rely on
generic "online portal" — be specific.

**Used in**: B.3.1 (online application availability).

### 2. CEFR / language-band cross-mapping (Recall)

**Failure**: government pages rarely state language requirements in CEFR
bands (A2, B1, B2…). They use country-specific scales: Canadian Language
Benchmark (CLB), IELTS bands, TOEFL scores, "basic English",
"competent English". Model returns empty because the rubric is in CEFR.

**Fix**: every prompt that maps a language requirement to a categorical
rubric must include explicit CLB ↔ IELTS ↔ TOEFL ↔ CEFR ↔ qualitative
phrase mappings. Same for civics-test names — list "Life in the UK Test",
"Australian citizenship test", "Discover Canada" by name.

**Used in**: D.2.4 (citizenship test burden).

### 3. Points-based system signal (Recall + Negative-match hybrid)

**Failure**: programmes that qualify via points (Canada Express Entry CRS,
NZ SMV, AU Skilled Independent 189) don't fit the salary / employer-
sponsorship / age-cap rubrics cleanly because there's no hard threshold —
the criterion contributes points instead of gating eligibility.

**Fix**: every prompt that asks for a "minimum X" must have an explicit
clause: "If the programme qualifies via a points-based system where X
contributes points but is not a hard threshold, return [0 / no_salary_route
/ <effective cap from the points table> / etc.] with notes 'no fixed X;
points-based system'."

**Used in**: A.1.1 (minimum salary), A.1.3 (alternative pathways), A.3.3
(age cap), B.2.3 (employer levies), C.1.3 (self-employment rights).

### 4. Implicit "0" / "none" vs. genuinely empty (Negative-match)

**Failure**: when the answer is "no, there's no such requirement" or "the
levy is zero", the model often returns empty rather than the explicit
zero/none. Downstream the field looks LLM_MISS rather than a deliberate
"none".

**Fix**: every categorical rubric needs an explicit "absent / none"
option; every numeric prompt needs an explicit "return 0 with notes
'no such requirement'" path. Then add: "Do not return empty unless the
page is silent on the topic entirely."

**Used in**: A.1.1, A.1.3, B.2.3, B.2.4, B.3.3, D.3.2, E.1.2, E.1.3 (where
applicable).

### 5. Date-window enforcement (Format)

**Failure**: time-bounded fields ("changes in last 5 years",
"statistics from last 3 years") slip when the model counts everything ever
published rather than filtering by year.

**Fix**: lead the prompt with an explicit date window using the current
year hardcoded ("The current year is 2026. The window is 2021–2026").
Repeat the window in every recall hint that asks the model to count.
Do not rely on the model to infer "the last 5 years" correctly.

**Used in**: E.1.1 (material policy changes), E.2.1 (admission stats).

### 6. Same-authority sibling-page link as positive evidence (Recall)

**Failure**: official pages frequently link to a more detailed sibling
page on the same authority (operational manual, policy guide, statistics
dashboard). The model treats those links as third-party and returns a
weaker classification than the indicator deserves.

**Fix**: explicitly authorise "same-authority sibling-page link counts
as positive evidence" for guidance / statistics / decision-criteria
fields. Do NOT extend this to off-domain links — that crosses into
Tier 2 territory (Phase 3.4 ADR-013).

**Used in**: E.2.1 (statistics — link to same-authority dashboard counts),
E.2.3 (guidance — link to same-authority policy manual = comprehensive).

### 7. Country-default lookup with confidence cap (Recall)

**Failure**: tax-treatment fields (D.3.1 day-count, D.3.3 territorial-vs-
worldwide) are answered identically for every immigration programme in
the same country — but the canary's discovered immigration page rarely
restates the country's general rule, so the model returns empty even
though the answer is well known.

**Fix**: every country-default field's prompt names the known country
defaults explicitly ("Canada → worldwide", "Hong Kong → territorial"),
authorises the model to apply the country default if the page is silent,
and caps confidence at ≤ 0.6 in that case so the row enters review.

**Used in**: D.3.1 (tax residency trigger), D.3.3 (territorial vs
worldwide).

### 8. Boundary cases that prompts cannot fix (PROMPT_UNCERTAIN)

**Failure**: the canonical answer lives on a sibling page Stage 0 didn't
discover. For Canada, the citizenship physical-presence calculator page
is JS-rendered and the canary scrape returned only the bullet-point
summary; the 1,095-day rule (3 years) lives on the calculator page that
the scraper service can reach but Stage 0 didn't surface.

**Fix**: not a prompt problem. Three options, in order of preference:

1. Phase 3.2 v2 discovery prompt (already shipped) reaches more sibling
   pages by department type — if that closes it, no further work needed.
2. A "deep-link discovery" pass that follows in-page links on a sample
   of high-value programme pages and adds those URLs to the discovery
   set. Out of Phase 3.3 scope.
3. Per-country source registry expansion — analyst-curated. Phase 3.2
   deferred this; if the v2 prompt doesn't close the gap we revisit.

Mark the field PROMPT_UNCERTAIN in `methodology-v2.ts` with a comment
explaining which sibling page holds the answer. **Never rewrite the
prompt to compensate for a missing page.**

**Used in**: D.1.3, D.1.4, D.2.2 (all CAN — citizenship physical-presence
calculator page).

### 9. Thin-scrape signal (operational, not a prompt issue)

**Failure**: canary scrapes for canada.ca pages returned 1.5K–6K chars
where 30K was expected. Pages contain the keywords but not the deep
content the prompt assumes. The model is doing the right thing —
returning empty when the page is too thin to answer — but the gap
register classifies this as `LLM_MISS` because the keyword regex still
matches what little content arrived.

**Fix**: not a prompt problem. The Playwright scraper service needs to
detect anti-bot / partial-page responses (similar to scrape-guards.ts
which already rejects empty / HTML-error / anti-bot bodies, but doesn't
flag the "incomplete content" failure mode). Out of Phase 3.3 scope.

**Detection**: when many CAN fields land in `LLM_MISS` for a single
programme, run `scripts/peek-scrape.cjs <url>` against the canary's
discovered URLs and check character counts. <10K on a canada.ca page is
the smoke signal.

## Conventions for adding a new prompt

1. Start from the SHARED_PREAMBLE — never write a free-standing prompt.
2. Question first, then "Allowed values" or "Edge cases" or both.
3. **Recall hints** before edge cases. Recall hints are what stops
   `LLM_MISS`. They're the longest part of any well-tuned prompt.
4. Name positive-evidence anchors per country. Update annually as new
   countries join the cohort.
5. Every categorical rubric must have an "absent" or "none" option.
6. Every numeric field that can legitimately be zero must include an
   explicit "return 0 with notes" clause.
7. If the failure mode is Boundary, mark PROMPT_UNCERTAIN and do not
   rewrite the prompt.

## How to verify a prompt change worked

1. `pnpm --filter @gtmi/db exec tsx ../../scripts/sync-prompts-from-seed.ts --source v2 --keys <KEY> --execute`
2. Optionally run `scripts/invalidate-extraction-cache-phase-3-3.ts --execute` to remove orphan v1 cache rows for that key.
3. Re-canary the affected programme(s).
4. `scripts/audit-empty-fields-rollup.ts --only-canaried` and diff against the baseline gap register. The field should flip from `LLM_MISS` → `POPULATED` (or, if it doesn't, it's actually Boundary).

## How to roll a prompt change back

`pnpm --filter @gtmi/db exec tsx ../../scripts/sync-prompts-from-seed.ts --source v1 --keys <KEY> --execute`

The v1 prompt returns to the live `field_definitions` row. The v2 cache
key naturally misses on next extraction; v1 cache key may hit if rows
weren't purged. No data loss.
