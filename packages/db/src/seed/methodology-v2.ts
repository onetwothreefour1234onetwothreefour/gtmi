/**
 * Methodology V2 — Phase 3.3 prompt-sweep overlay on V1.
 *
 * V1 (`methodology-v1.ts`) is preserved as the historical record. This file
 * re-exports the same methodology object structure but overrides the
 * `extractionPromptMd` for LLM_MISS fields identified in
 * `docs/phase-3/baseline-gaps.csv`.
 *
 * V2 does NOT change weights, normalization, indicators, or the rubric.
 * The methodology version remains 1.0.0 — `version_tag` is bumped to
 * `1.0.1-phase-3-3-prompts` only as a content marker; the
 * `methodology_versions` DB row does not need a new entry because no
 * scoring inputs have changed.
 *
 * Phase 3.5 (ADR-014) may introduce a true V2.0.0 with weight changes;
 * that will live in a separate file.
 *
 * See docs/prompt-engineering-patterns.md for the failure-mode taxonomy
 * and decision rules behind each rewrite.
 */

import { methodologyV1 } from './methodology-v1';

// Re-export the SHARED_PREAMBLE pattern by reading it off any v1 prompt.
// (V1 doesn't export the constant, so we reconstruct it via the prefix
// shared by every v1 prompt — everything before the first occurrence of
// "Extraction Task:".)
const sampleV1Prompt = methodologyV1.indicators[0]!.extractionPromptMd;
const SHARED_PREAMBLE_PLUS_NEWLINES = sampleV1Prompt.slice(
  0,
  sampleV1Prompt.indexOf('Extraction Task:')
);

function withPreamble(extractionTask: string): string {
  return SHARED_PREAMBLE_PLUS_NEWLINES + extractionTask;
}

// ────────────────────────────────────────────────────────────────────
// Phase 3.8 / P0.5 — generate the "Allowed values:" enumeration in the
// extraction prompt directly from the field's rubric. Eliminates the
// drift class where the prompt and the rubric disagree on vocabulary
// (the C.3.2 / C.3.1 bug class). The generator is opt-in: existing
// prompts that hand-roll the block keep working, but new prompts and
// rewrites should use `renderAllowedValues` so the prompt and rubric
// are mechanically tied.
//
// Usage:
//   withRubricVocab('C.3.2', C32_REGIONAL_RUBRIC, `
//     Extraction Task: C.3.2 — Public education access for children
//     Question: ...
//     {{ALLOWED_VALUES}}
//     Edge cases: ...
//   `)
// ────────────────────────────────────────────────────────────────────

interface CategoricalRubric {
  categories: Array<{ value: string; score?: number; description?: string }>;
}

export function renderAllowedValues(rubric: CategoricalRubric): string {
  const lines = rubric.categories.map((c) => {
    const desc = c.description ? c.description : '';
    return `"${c.value}": ${desc}`;
  });
  return ['Allowed values:', '', ...lines].join('\n');
}

const ALLOWED_VALUES_MARKER = '{{ALLOWED_VALUES}}';

export function withRubricVocab(
  key: string,
  rubric: CategoricalRubric,
  extractionTask: string
): string {
  if (!extractionTask.includes(ALLOWED_VALUES_MARKER)) {
    throw new Error(
      `withRubricVocab(${key}): prompt body is missing the ${ALLOWED_VALUES_MARKER} marker. Insert it where the "Allowed values:" block should render.`
    );
  }
  const block = renderAllowedValues(rubric);
  return SHARED_PREAMBLE_PLUS_NEWLINES + extractionTask.replace(ALLOWED_VALUES_MARKER, block);
}

/**
 * Phase 3.3 prompt overrides — keyed by indicator code. Only fields
 * classified LLM_MISS in baseline-gaps.csv with a clear, prompt-fixable
 * failure mode appear here. Boundary failures (data lives on a sibling
 * page Stage 0 didn't discover) are documented in
 * docs/prompt-engineering-patterns.md as PROMPT_UNCERTAIN and are NOT
 * rewritten here — the prompt isn't the problem, the page coverage is.
 */
export const PHASE_3_3_PROMPT_OVERRIDES: Record<string, string> = {
  // ────────────────────────────────────────────────────────────────────
  // Pillar A overrides removed in methodology v2.0.0 — the entire
  // Pillar A indicator set has been restructured. The prompts in
  // methodology-v1.ts are now the canonical source of truth for every
  // Pillar A field (no Phase 3.3 overlay). See ADR superseding ADR-016.
  // ────────────────────────────────────────────────────────────────────
  // B.2.1 — Phase 3.6.6 / FIX 3: multi-currency acceptance. Country-agnostic.
  // The original v1 prompt asked for USD-denominated values, but
  // government fee pages publish in local currency (CAD, AUD, GBP,
  // SGD, HKD, NZD, JPY, EUR, etc.). The model returned empty when it
  // saw a local-currency figure. Now we extract the value AS STATED
  // with its currency code; FX conversion happens downstream at score
  // time, not at extraction.
  // ────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────
  // Pillar B overrides removed in methodology v3.0.0 — the entire
  // Pillar B indicator set has been restructured. The prompts in
  // methodology-v1.ts are now the canonical source of truth for every
  // Pillar B field (no Phase 3.3 overlay). See ADR-029.
  // ────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────
  // C.1.3 — Recall: CAN/UKVI use "open work permit" / "ancillary work
  // rights" rather than "self-employment".
  // ────────────────────────────────────────────────────────────────────
  'C.1.3': withPreamble(
    `Extraction Task: C.1.3 — Self-employment and secondary income rights
Question: Can the visa holder engage in self-employment and secondary income activities?
Allowed values:

"full_rights": both fully permitted.
"limited_secondary": secondary employment permitted but self-employment restricted/prohibited.
"permitted_with_permission": permitted only with prior authorization.
"prohibited": self-employment and secondary income not permitted.

Recall hints:

PR-track visas (Express Entry once PR is granted) → "full_rights".
Open work permit / open spouse permit / "no employer-specific restriction" → "full_rights".
"Tied to employer" / "employer-specific work permit" / "named sponsor" / "may only work for [sponsoring employer]" → "limited_secondary" or "prohibited" depending on whether other paid work is barred.
"Self-employment is not permitted" (UK Skilled Worker explicit) → "limited_secondary" if secondary employee work is allowed, else "prohibited".
"Permission may be granted on application" → "permitted_with_permission".
Australia 482 Specialist stream: only the sponsoring employer + nominated occupation → "limited_secondary".

Edge cases:

Passive investment income (dividends, rental) generally outside these rules unless addressed.
Sector/occupation restrictions should be noted.
Volunteer and unpaid work generally permitted regardless — do not factor in.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // C.2.2 — Recall: "dependent child" age varies by country; explicit
  // hints needed.
  // ────────────────────────────────────────────────────────────────────
  'C.2.2': withPreamble(
    `Extraction Task: C.2.2 — Dependent child age cap
Question: Up to what age can a dependent child be included on the principal's visa?

Recall hints:

Common patterns:
  * Australia 482 / 189: under 18 (or under 23 if dependent full-time student).
  * UK Skilled Worker: under 18 at first application; can stay until current visa expires.
  * Canada Express Entry / IRCC: under 22 at the time of application (locked-in age).
  * Singapore EP/S Pass DP: unmarried child under 21.
  * Hong Kong: under 18 (or 21 for full-time students).
Look for: "child under [X]", "dependent child", "minor", "unmarried son/daughter under [X]", "locked-in age".

Edge cases:

If cap differs for full-time students, report the higher cap and note the condition (populate student_extension_age in notes).
If no age cap, return 999.
"Locked-in age" (age frozen at time of application) is a CAP — report the lock-in age (Canada: 22).
If children age out mid-visa, note this in notes — but report the entry-eligibility cap.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // C.2.4 — Recall: CAN uses "common-law partner" not "de facto".
  // ────────────────────────────────────────────────────────────────────
  'C.2.4': withPreamble(
    `Extraction Task: C.2.4 — Same-sex partner recognition
Question: Does this program recognize same-sex spouses or same-sex de facto partners as eligible dependants?

Recall hints:

Recognition phrases (positive evidence for true):
  * "spouse" defined as including same-sex married partners.
  * "common-law partner" (Canada) — gender-neutral, includes same-sex.
  * "de facto partner" (Australia) — gender-neutral, includes same-sex.
  * "civil partner" / "civil union" (UK, several EU) — gender-neutral.
  * "domestic partner" (Singapore on a case-by-case basis).
"Spouse" alone with no gender qualifier in a country that legally permits same-sex marriage (CAN, AUS, UK, etc.) → true.
Recognition of a foreign same-sex marriage (even where the country doesn't itself perform them) → true if explicitly accepted.
"Partner" with no qualifier in a country that doesn't recognize same-sex relationships at all (most Gulf states) → likely false; check carefully.

Edge cases:

If silent and the country is one where same-sex marriage is unlawful, default to false and note "no explicit recognition; country does not legally recognize same-sex marriage".
If silent and the country legally recognizes same-sex marriage, default to true (general law applies).`
  ),

  // ────────────────────────────────────────────────────────────────────
  // D.2.3 — Negative-match: country's general dual-citizenship policy
  // is rarely on the visa page itself.
  // ────────────────────────────────────────────────────────────────────
  'D.2.3': withPreamble(
    `Extraction Task: D.2.3 — Dual citizenship permitted
Question: Does the country permit dual or multiple citizenship for naturalizing applicants from this program?

Recall hints:

If the page is a citizenship-eligibility page on the official immigration domain, the dual-citizenship answer is usually stated nearby. Common phrases:
  * "Canada permits dual citizenship" → true.
  * "Australia permits dual or multiple citizenship" → true.
  * "United Kingdom permits dual citizenship" → true.
  * "Singapore does not generally permit dual citizenship for adult naturalised citizens" → false.
  * "Hong Kong applies the People's Republic of China nationality law" — Mainland Chinese rule disallows dual; for non-Chinese applicants the practical answer differs.
If the source explicitly mentions a renunciation requirement (must renounce previous citizenship), → false unless the country's law makes the renunciation purely formal.

Edge cases:

"Permitted in practice but requires renunciation formalism not enforced" is true only if source explicitly acknowledges this.
If the page is silent and you cannot find a statement on the same official-immigration domain, return empty with notes "country's dual-citizenship rule not stated on this page".`
  ),

  // ────────────────────────────────────────────────────────────────────
  // D.2.4 — Recall: add CLB (Canadian Language Benchmark) mapping.
  // ────────────────────────────────────────────────────────────────────
  'D.2.4': withPreamble(
    `Extraction Task: D.2.4 — Civic, language, integration test burden for citizenship
Question: How burdensome are the civic, language, or integration tests required for citizenship from this track?
Allowed values:

"none": no test required.
"light": single test of single type (language A2/B1 OR short civics quiz).
"moderate": multiple tests or one substantial test (language B2+ and civics).
"heavy": multiple substantial tests including language above B2, civics, and integration/history.

Recall hints:

CEFR levels (A1, A2, B1, B2, C1, C2) are rarely stated by name on government pages. Use these mappings:
  * Canadian Language Benchmark (CLB): CLB 4 ≈ A2/B1; CLB 5–6 ≈ B1/B2; CLB 7+ ≈ B2/C1. Canadian citizenship requires CLB 4 → "light" before adding civics.
  * IELTS bands: IELTS 4 ≈ A2/B1 → light; IELTS 6 ≈ B2 → moderate; IELTS 7+ ≈ C1 → heavy.
  * "basic English" / "everyday English" / "functional English" → A2/B1 → light if it's the only test.
  * "good knowledge of English" / "competent English" / TOEFL ~80 → B2 → moderate.
  * "advanced English" / TOEFL 100+ → C1+ → heavy.
Civics tests by name:
  * "Life in the UK Test" — civics test.
  * "Australian citizenship test" — civics test.
  * "Discover Canada" study guide + citizenship test — civics test.
  * "naturalisation test" / "civics test" generally → civics test.
If both a language requirement AND a civics test are required, the answer is at least "moderate".

Edge cases:

Exemptions for age/disability do not change category.
If citizenship is not available from this track, return empty.
If the source describes only "must understand basic English" with no civics test mentioned, return "light".
Canadian citizenship: CLB 4 + Discover Canada citizenship test = "moderate" (two distinct tests).`
  ),

  // ────────────────────────────────────────────────────────────────────
  // D.3.1 — Recall: "183-day common-law test" pattern is universal but
  // not always tagged as "tax residency trigger".
  // ────────────────────────────────────────────────────────────────────
  'D.3.1': withPreamble(
    `Extraction Task: D.3.1 — Tax residency trigger (days/year)
Question: How many days of physical presence trigger full tax residency (worldwide income taxation)?

Recall hints:

Common phrasings (all positive evidence — extract the day count):
  * "An individual is a [Country] tax resident if they are physically present for [X] days or more in a calendar year."
  * "183-day rule", "183 days or more", "more than 183 days".
  * "[X] days in any 12-month period".
  * "Substantial presence test" (US-style): primary day-count is 183 (3-year weighted) — extract 183 with a note about weighting.
  * "Significant residential ties test" (Canada): not a pure day count — extract 183 (the secondary day-count threshold) with notes about the residential-ties test.
For Singapore: "physically present in Singapore for 183 days or more" → 183.
For UK: Statutory Residence Test — automatic UK residence at 183 days; report 183 with a note about ties tests.
For Australia: 183-day test (any 12-month period) → 183.
For Hong Kong: territorial system — see edge case below.

Edge cases:

If test is non-pure-day-count (substantial presence with prior-year weighting, center of vital interests), report primary day-count threshold (almost always 183) and describe additional test in notes.
If taxed territorially regardless of presence, return null with notes "territorial regime — see D.3.3" (Hong Kong, Singapore at the foreign-source level).
If the page is silent on the day-count test but asserts the country has a residence-based system, return 183 only if you find the trigger elsewhere on the same authority.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // D.3.2 — Negative-match: model returns empty for "no special regime"
  // case rather than "none".
  // ────────────────────────────────────────────────────────────────────
  'D.3.2': withPreamble(
    `Extraction Task: D.3.2 — Special regime available
Question: What special/preferential tax regime, if any, is available to holders of this visa?
Allowed values:

"none": no special regime available to holders of this program.
"time_limited_bonus": fixed-term reduction/exemption (e.g., 30% expat ruling for 5 years).
"time_limited_flat_rate": fixed-term flat/lump-sum tax regime (e.g., Italy's 100k flat tax).
"non_dom": regime exempting foreign-source income, typically domicile-based.
"indefinite_preferential": preferential regime for duration of residence, no time cap.

Recall hints:

If the source clearly addresses tax treatment for this visa class and describes no special regime, return "none" — do not return empty.
Named regimes to recognize as positive evidence for the non-"none" categories:
  * "Australian temporary resident foreign-income exemption" (482 holders) → "non_dom" (foreign-source income exempt while a temp resident).
  * "UK non-dom remittance basis" (pre-2025 rules) → "non_dom".
  * "Italy 100k flat tax" → "time_limited_flat_rate".
  * "Spain Beckham law" → "time_limited_bonus".
  * "Netherlands 30%-ruling" → "time_limited_bonus".
  * "Portugal NHR (legacy / replacement)" → varies; note specifics.
  * "Singapore — no special regime; territorial system applies generally" → "none".
  * "Canada — no special regime for new arrivals" → "none".

Edge cases:

If regime is general (not tied to this visa) but accessible to holders, it qualifies; note eligibility conditions.
If the page does not address tax at all, return empty (this is ABSENT, not "none").
"Tax holiday" for specific industries is NOT a personal tax regime.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // D.3.3 — Recall: Canada/Australia/UK/most OECD = worldwide; HK/SGP =
  // territorial. Most pages don't use the exact word "worldwide".
  // ────────────────────────────────────────────────────────────────────
  'D.3.3': withPreamble(
    `Extraction Task: D.3.3 — Territorial vs. worldwide taxation for residents
Question: What is the scope of taxation for tax residents?
Allowed values:

"worldwide": residents taxed on worldwide income.
"worldwide_with_remittance_basis": worldwide in principle but foreign income taxed only if remitted.
"territorial": residents taxed only on domestic-source income.
"hybrid": specific income types territorial, others worldwide.

Recall hints:

Country defaults to look up if the page mentions any of:
  * Canada / Australia / UK (post-2025) / USA / NZ / most OECD members → "worldwide".
  * Hong Kong / Singapore (foreign-sourced not remitted) → "territorial".
  * UK pre-April 2025 (non-dom remittance basis) → "worldwide_with_remittance_basis".
  * Malaysia → "territorial" generally; some hybrid carve-outs.
Phrases that map to worldwide:
  * "Canadian residents are taxed on their worldwide income"
  * "you must report income from all sources, both inside and outside [Country]"
  * "global income subject to tax"
Phrases that map to territorial:
  * "only [Country]-source income is taxable"
  * "foreign-source income is not taxed"
  * "income earned outside [Country] is generally exempt"

Edge cases:

If source distinguishes by domicile (UK pre-2025 style), report rule for typical new entrant on this visa and explain.
If the page is silent on income-source treatment but references the country's general rule, apply the country default (above) and lower confidence to ≤ 0.6.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // E.1.1 — Format / date-filter: tighten 5-year window enforcement.
  // ────────────────────────────────────────────────────────────────────
  'E.1.1': withPreamble(
    `Extraction Task: E.1.1 — Material policy changes in last 5 years
Question: Compute a severity-weighted count of material policy changes affecting this program in the last 5 years.

DATE FILTER (read first, apply throughout):
The current year is 2026. "Last 5 years" means changes with explicit dates in calendar years 2021, 2022, 2023, 2024, 2025, or 2026. Changes dated 2020 or earlier do not count, even if the page lists them.

Material change definition: change to eligibility criteria, quota/cap, fee schedule beyond inflation, rights granted, introduction/abolition of sub-stream, or processing time SLA.

Severity weights:
  * Major (eligibility/pathway change, abolition/reintroduction): 3
  * Moderate (quota change, fee restructure): 2
  * Minor (inflation-only fee adjustment, form/portal update): 1

Recall hints:

The source need not be a formal changelog. Count any of these as evidence of a change WITH AN EXPLICIT DATE 2021 OR LATER:
  * "introduced in [YYYY]", "replaced in [YYYY]", "renamed to ... in [YYYY]", "merged with ... in [YYYY]"
  * "from [YYYY]", "since [YYYY]", "as of [date]"
  * "previously [old value], now [new value]", "increased from X to Y in [YYYY]"
  * "reformed [YYYY]", "overhauled [YYYY]", "tightened [YYYY]", "expanded [YYYY]"
  * "this stream replaces the former [program] (introduced [YYYY])"
  * Migration Policy Institute, OECD migration outlook, IMD reports, third-party trackers covering policy timeline are valid evidence — extract their dated change list and apply the date filter.

Sum the severity-weighted points across all 2021+ changes you find. Report the integer total. The sourceSentence field should quote ONE representative dated change (preferably the highest-severity).

Edge cases:

If the source mentions "the program was last revised in [year < 2021]" with no later changes, return 0 with notes "no changes in the 2021-2026 window".
Do not count announced-but-not-implemented changes here (those belong to E.1.2).
Do not infer changes from tone or general policy commentary; only count explicitly dated changes.
If the page lists historical changes from before 2021 with NO 2021+ changes, return 0 — do not return empty.
If the source provides no dated change information at all (positive or negative), return empty with notes "no change information on this page".`
  ),

  // ────────────────────────────────────────────────────────────────────
  // E.1.2 — Negative-match: "vague" rejection threshold needs sharper
  // criteria.
  // ────────────────────────────────────────────────────────────────────
  'E.1.2': withPreamble(
    `Extraction Task: E.1.2 — Forward-announced pipeline changes
Question: Does the document announce any upcoming change with a specified future effective date?

Recall hints:

Specific future effective date REQUIRED — patterns that qualify:
  * "From 1 January 2027, the salary threshold will rise to ..."
  * "Effective 6 April 2026, dependants will ..."
  * "Beginning [quarter] [year], processing times for ..."
  * "The new requirement takes effect on [date]."
"Date window" qualifies only if narrower than 6 months and tied to a fiscal-year style trigger ("from 1 July 2026").

Patterns that DO NOT qualify (return false unless something else qualifies):
  * "We are reviewing the eligibility criteria"
  * "Changes may be introduced in due course"
  * "A consultation is open until [date]"
  * "We expect to publish updated guidance later this year"
  * "Policy is under review"

Edge cases:

Multiple changes: list all in notes; value is true if at least one qualifies.
"Indexed annually for inflation" is NOT a forward-announced change — it's an automatic adjustment.
Announcement must be in this official source; news/commentary references do not count toward this field.
If the page is silent on future changes, return false (not empty) — silence on forward changes is unambiguous.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // E.2.1 — Recall: linked annual reports / dashboards count.
  // ────────────────────────────────────────────────────────────────────
  'E.2.1': withPreamble(
    `Extraction Task: E.2.1 — Published approval rate or admission statistics
Question: Does the document publish approval rate or admission statistics for this program?

Recall hints:

Positive evidence — return true:
  * "Last year, [N] applicants were granted this visa."
  * "The approval rate for [program] in [year] was [X]%."
  * Linked tables or dashboards on the SAME official authority's domain that show admission counts or approval rates for this program.
  * "Express Entry rounds-of-invitations" data on canada.ca counts as admission statistics for Express Entry.
  * "Working holiday maker programme report" / "annual migration report" counts if it is for the same program.
  * Linked statistics portal goes to the same government authority (e.g., from immi.homeaffairs.gov.au to abs.gov.au is acceptable).

Edge cases:

Statistics must be from the last 3 years (2023+); older statistics alone = false.
Aggregated statistics covering many programs (not this specific one) do NOT count — must be program-specific or breakable-down by program.
"Annual migration update" without per-program breakdown does NOT count.
If the page has a "Statistics" or "Reporting" link to the same authority's data hub, follow that link's mention and count it as true with a note.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // E.2.3 — Recall: government policy guides / operational manuals.
  // ────────────────────────────────────────────────────────────────────
  'E.2.3': withPreamble(
    `Extraction Task: E.2.3 — Public guidance and decision criteria documentation
Question: How thoroughly does the government publish decision criteria and applicant guidance?
Allowed values:

"comprehensive": detailed decision criteria, worked examples/scenarios, explicit evidence requirements; OR a published operational/policy manual the public can read.
"substantive": clear decision criteria and evidence requirements, no worked examples.
"basic": eligibility and required documents stated; little guidance on how decisions are made.
"minimal": high-level overview with eligibility listed but little else.
"absent": does not address decision criteria.

Recall hints:

Positive evidence for "comprehensive":
  * Linked operational instructions / policy guides / caseworker manuals on the same authority's domain (UK Home Office "Modernised Guidance" suite, IRCC policy manuals, DOHA "Policy" pages).
  * "Workforce planning model" or "occupation list methodology" describing decision logic.
  * Worked illustrative scenarios ("Applicant A earns X — they qualify because ...").
Positive evidence for "substantive":
  * "How we assess your application" section with explicit weight-by-criterion breakdown.
  * Clear evidence requirements list per criterion.
FAQ counts as substantive only if it addresses decision criteria, not only procedural questions.

Edge cases:

Base rating on THIS document plus official guidance it directly links from the same authority. No third-party guides.
"Worked examples" = explicit illustrative scenarios.
If the page has a prominent "Read the policy guidance" link to the same authority that opens detailed criteria, treat as "comprehensive" even if the current page is itself summary-level.`
  ),
};

// ────────────────────────────────────────────────────────────────────
// PROMPT_UNCERTAIN — fields where the failure mode is BOUNDARY (data
// lives on a sibling page Stage 0 didn't discover) rather than RECALL
// or NEGATIVE_MATCH. The v1 prompt is kept; the underlying issue is
// page coverage, which Phase 3.2 (department-aware discovery) and a
// follow-up "deep-link discovery" pass will address.
//
// These keys are documented but NOT overridden:
//   D.1.3 — physical presence days/year (CAN: lives on PR-residency-
//           obligation page, not on Express Entry eligibility page)
//   D.1.4 — PR retention rules (same — lives on residency-obligation
//           page; the 730-days-in-5 rule for Canada).
//   D.2.2 — total years to citizenship (CAN: 3-of-5 years / 1,095 days
//           lives on the citizenship physical-presence calculator page,
//           which is JS-rendered and the canary scrape returned only the
//           bullet-point summary).
// ────────────────────────────────────────────────────────────────────
export const PHASE_3_3_PROMPT_UNCERTAIN: Record<string, string> = {
  'D.1.3':
    'Boundary failure — data lives on PR-residency-obligation page; Phase 3.2 deep-link discovery needed.',
  'D.1.4':
    'Boundary failure — data lives on PR-residency-obligation page; Phase 3.2 deep-link discovery needed.',
  'D.2.2':
    'Boundary failure — citizenship physical-presence calculator page is JS-rendered; thin scrape on canary.',
};

// ────────────────────────────────────────────────────────────────────
// Phase 3.5 / ADR-014 — APPROVED indicator dispositions.
//
// Five indicators are restructured:
//   B.2.3 — numeric → boolean_with_annotation (hasLevy + notes).
//   B.2.4 — numeric → boolean_with_annotation (hasMandatoryNonGovCosts + notes).
//   D.1.3 — numeric → boolean_with_annotation (required + daysPerYear + notes).
//   D.1.4 — numeric → boolean_with_annotation (required + daysPerYear + notes).
//   C.3.2 — categorical → country_substitute_regional (regional default
//           value when LLM extraction returns empty).
//
// Sub-factor weights are unchanged: each restructured indicator stays
// in its original sub-factor with its original weight. The data-type
// change does not require weight re-normalization.
//
// Each indicator override below specifies:
//   - dataType: 'json' for boolean_with_annotation; 'categorical' for C.3.2.
//   - normalizationFn: 'boolean_with_annotation' or 'country_substitute_regional'.
//   - direction: lower_is_better (presence of levy/cost/requirement is a penalty)
//     for B.2.3/B.2.4/D.1.3/D.1.4; higher_is_better for C.3.2 (more access better).
//   - scoringRubricJsonb: replaced for boolean_with_annotation with a
//     two-entry rubric so the dashboard can render rubric-aware
//     (the engine itself reads the structured boolean directly via
//     BOOLEAN_WITH_ANNOTATION_KEYS, not the rubric).
//   - extractionPromptMd: requests the structured JSON output shape.
// ────────────────────────────────────────────────────────────────────

interface MethodologyV1Indicator {
  key: string;
  label: string;
  dataType: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: number;
  extractionPromptMd: string;
  scoringRubricJsonb: unknown;
  normalizationFn: string;
  direction: string;
  sourceTierRequired: number;
}

interface IndicatorRestructure {
  dataType: string;
  normalizationFn: string;
  direction: string;
  scoringRubricJsonb: unknown;
  extractionPromptMd: string;
}

const STRUCTURED_BOOL_RUBRIC = {
  categories: [
    { value: 'true', score: 0, description: 'requirement / charge present (penalised)' },
    { value: 'false', score: 100, description: 'no requirement / charge (best case)' },
  ],
};

// Phase 3.8 / P0 reconciliation — the 4-value rubric is the single
// source of truth for C.3.2 vocabulary. REGIONAL_SUBSTITUTES (in
// packages/scoring/src/normalize.ts) writes a *subset* of these values
// (automatic for OECD, fee_paying for GCC) when extraction is empty;
// LLM-extracted values can be any of the four, scored via the rubric.
// 100 / 40 are analyst-set; 20 / 0 fill the gradient for restricted / none.
const C32_REGIONAL_RUBRIC = {
  categories: [
    {
      value: 'automatic',
      score: 100,
      description: 'public schooling available on the same basis as citizens/PRs.',
    },
    {
      value: 'fee_paying',
      score: 40,
      description: 'access available but foreign-student or fee-paying levy applies.',
    },
    {
      value: 'restricted',
      score: 20,
      description: 'case-by-case basis or local-authority approval, not guaranteed.',
    },
    {
      value: 'none',
      score: 0,
      description: 'no access to public education.',
    },
  ],
};

export const PHASE_3_5_INDICATOR_RESTRUCTURES: Record<string, IndicatorRestructure> = {
  // B.2.3 / B.2.4 boolean_with_annotation restructures removed in
  // methodology v3.0.0 — those Pillar B keys are retired (ADR-029).
  // The boolean_with_annotation pattern is still in force for D.1.3 / D.1.4.

  'D.1.3': {
    dataType: 'json',
    normalizationFn: 'boolean_with_annotation',
    direction: 'lower_is_better',
    scoringRubricJsonb: STRUCTURED_BOOL_RUBRIC,
    extractionPromptMd: withPreamble(
      `Extraction Task: D.1.3 — Physical presence requirement during PR accrual (boolean+annotation)
Question: Does this programme require the visa holder to physically be present in the country for some minimum number of days each year for that year to count toward PR-qualifying time?

Return value: a JSON object with this exact shape:
  { "required": boolean, "daysPerYear": number | null, "notes": string | null }

Recall hints:

If the page describes a physical-presence rule during accrual, set required=true and populate daysPerYear with the figure.
If the page describes the rule as "no more than X days outside the country", convert to required=true and daysPerYear = 365 - X.
If presence is not required during accrual (rare for talent visas), set required=false, daysPerYear=null.

Edge cases:

If the source is silent on accrual presence specifically but states a per-year retention rule (D.1.4), do NOT conflate the two — return null/null with notes "accrual rule not stated; D.1.4 retention rule documented separately".
notes can include qualifying-period framing ("e.g. 1,095 days within 5 years for Canada citizenship-from-PR" → required=true, daysPerYear=219).`
    ),
  },

  'D.1.4': {
    dataType: 'json',
    normalizationFn: 'boolean_with_annotation',
    direction: 'lower_is_better',
    scoringRubricJsonb: STRUCTURED_BOOL_RUBRIC,
    extractionPromptMd: withPreamble(
      `Extraction Task: D.1.4 — PR retention rules (boolean+annotation)
Question: After PR is granted, does this programme require the holder to maintain physical presence to keep PR status?

Return value: a JSON object with this exact shape:
  { "required": boolean, "daysPerYear": number | null, "notes": string | null }

Recall hints:

Common patterns to extract:
  * Canada: PR holders must be in Canada at least 730 days in any 5-year period → required=true, daysPerYear=146 (730/5), notes "730 days in 5 years (rolling)".
  * Australia: 5-year travel facility on PR; must apply for resident return visa to re-enter after 5 years → required=true, daysPerYear=null (binary travel-facility model), notes "RRV required after 5 years out".
  * UK ILR: lapses if absent from UK for 2 consecutive years → required=true, daysPerYear=null, notes "ILR lapses after 2 years' absence".
If PR is not available from this programme, return required=false, daysPerYear=null, notes "PR not available".

Edge cases:

If the page mentions PR as a pathway endpoint but does NOT describe the retention rule, return null/null/null with notes "retention rule not on this page".`
    ),
  },

  'C.3.2': {
    dataType: 'categorical',
    normalizationFn: 'country_substitute_regional',
    direction: 'higher_is_better',
    scoringRubricJsonb: C32_REGIONAL_RUBRIC,
    // Phase 3.8 / P0.5 — first prompt rewritten to use the rubric-driven
    // "Allowed values" generator. The {{ALLOWED_VALUES}} marker is
    // replaced at build time with the C32_REGIONAL_RUBRIC categories,
    // so prompt and rubric can never drift apart again.
    extractionPromptMd: withRubricVocab(
      'C.3.2',
      C32_REGIONAL_RUBRIC,
      `Extraction Task: C.3.2 — Public education access for children of visa holders
Question: Do children of this programme's visa holders have automatic access to the public education system (free schooling) on the same terms as citizen children?

{{ALLOWED_VALUES}}

Edge cases:

If the page is silent, the publish stage will substitute the regional default
('automatic' for OECD high-income, 'fee_paying' for GCC) — do NOT guess. Return
empty so the substitution mechanism can fire cleanly.`
    ),
  },
};

/**
 * Apply Phase 3.5 indicator restructures on top of an indicator with
 * Phase 3.3 prompt overrides already applied.
 */
function applyPhase3_5(ind: MethodologyV1Indicator): MethodologyV1Indicator {
  const restructure = PHASE_3_5_INDICATOR_RESTRUCTURES[ind.key];
  if (!restructure) return ind;
  return {
    ...ind,
    dataType: restructure.dataType,
    normalizationFn: restructure.normalizationFn,
    direction: restructure.direction,
    scoringRubricJsonb: restructure.scoringRubricJsonb,
    extractionPromptMd: restructure.extractionPromptMd,
  };
}

/**
 * Compose v2 = v1
 *   + Phase 3.3 prompt overrides (applied first)
 *   + Phase 3.5 indicator restructures (applied second).
 *
 * Identical shape to v1 — same indicators array, same per-indicator
 * weights, same sub-factor and pillar weights. Phase 3.5 changes
 * dataType / normalizationFn / direction / scoringRubricJsonb /
 * extractionPromptMd for 5 indicators (B.2.3, B.2.4, D.1.3, D.1.4,
 * C.3.2) but does NOT change weights.
 */
export const methodologyV2 = {
  ...methodologyV1,
  // Phase 3.5 / ADR-014: methodology version bump from 1.0.1 (prompt
  // marker only) to 2.0.0 (data-type changes for 5 indicators).
  version_tag: '2.0.0',
  indicators: methodologyV1.indicators.map((ind) => {
    // Phase 3.3 prompt overlay first.
    const promptOverride = PHASE_3_3_PROMPT_OVERRIDES[ind.key];
    const withPromptV2 = promptOverride ? { ...ind, extractionPromptMd: promptOverride } : ind;
    // Phase 3.5 structural change second (Phase 3.5 prompt replaces 3.3
    // prompt for the 5 restructured fields).
    return applyPhase3_5(withPromptV2);
  }),
};

/** List of indicator keys whose prompts were rewritten in Phase 3.3. */
export const PHASE_3_3_REWRITTEN_KEYS: string[] = Object.keys(PHASE_3_3_PROMPT_OVERRIDES);

/** List of indicator keys whose data-type was restructured in Phase 3.5. */
export const PHASE_3_5_RESTRUCTURED_KEYS: string[] = Object.keys(PHASE_3_5_INDICATOR_RESTRUCTURES);
