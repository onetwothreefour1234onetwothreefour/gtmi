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
  // A.1.1 — Negative-match: model returns empty when programme has no
  // fixed salary threshold (Express Entry FSW: CRS points-based, not
  // salary-gated). Fix: explicit "return 0 with notes" path.
  // ────────────────────────────────────────────────────────────────────
  'A.1.1': withPreamble(
    `Extraction Task: A.1.1 — Minimum salary threshold
Question: What is the minimum annual salary, in the local currency as stated in the source, that a principal applicant must earn to qualify for this program?

Recall hints:

If the program qualifies via a points-based system (Canada Express Entry CRS, NZ Skilled Migrant Points, AU points test) where salary contributes points but is not a hard threshold, return value: 0 and notes: "no fixed salary threshold; points-based system".
If the program has multiple named tiers (Core / Specialist / Talent), report the standard/core threshold and describe alternatives in notes.
Salary thresholds are sometimes published as "above the [TSMIT/CIW/median wage] threshold" — extract the numeric figure if any is given anywhere on the page (TSMIT for Australia 482; CIW high-skilled threshold for Canada).

Edge cases:

Report raw local-currency figure; USD normalization happens downstream.
If the threshold is expressed only as a multiple of median wage, return value: null and notes: "expressed as multiple of median — see A.1.2".
"Proof of funds" requirements are NOT salary thresholds — they are the funds you must show on hand. Do not extract those.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // A.1.2 — Recall: weak by design (% of median rarely stated explicitly
  // on government pages). Strengthen with explicit "implied %" pathway
  // when both the absolute amount AND a contemporaneous median figure
  // appear in the same page.
  // ────────────────────────────────────────────────────────────────────
  'A.1.2': withPreamble(
    `Extraction Task: A.1.2 — Salary threshold as % of local median wage
Question: Is the salary threshold for this program defined or benchmarked as a percentage of the local median wage or equivalent statistical reference?

Recall hints:

If the source explicitly states the threshold is calibrated against, set at, derived from, or matched to a percentage of national/local median earnings — even alongside an absolute amount — report that percentage.
Examples that should yield a value: "TSMIT is set at the median earnings for full-time workers", "salary equal to 80% of full-time median", "matched annually to ABS earnings data", "indexed to the going rate", "tracks the prevailing wage".
If the page states an absolute threshold AND also cites the relevant median (e.g., "minimum salary £38,700 — the median for skilled jobs is £38,400"), compute the implied percentage to one decimal place and report it.
"Going rate" / "prevailing wage" methodologies (UK Skilled Worker, US H-1B style) are explicit median-anchor references — extract whatever percentage value the page assigns to the threshold.

Edge cases:

If the threshold is purely a fixed amount with no percentage anchor stated anywhere AND no median figure is cited on the page, return empty (no value).
If the source gives both (e.g., "the greater of X or Y% of median"), report the percentage.
If expressed as a multiple (e.g., "1.5x median"), convert to a percentage (150).
If only a benchmarking statement is given without a numeric percentage and no nearby median figure to compute against, do not infer; return empty.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // A.1.3 — Recall: points-based programmes don't fit the salary_only/
  // salary_plus_one taxonomy cleanly. Fix: name the points-only case.
  // ────────────────────────────────────────────────────────────────────
  'A.1.3': withPreamble(
    `Extraction Task: A.1.3 — Alternative qualification pathways
Question: Besides salary, how many alternative qualifying routes does this program offer?
Allowed values:

"salary_only": only qualifying route is the salary threshold.
"salary_plus_one": salary plus one alternative (points, investment, patent).
"salary_plus_multiple": salary plus two or more alternatives.
"no_salary_route": qualification does not require a salary threshold at all.

Recall hints:

Points-based programmes where salary contributes to a points score but is not a hard floor (Canada Express Entry CRS, NZ Skilled Migrant Visa, AU Skilled Independent 189 points test) → "no_salary_route".
"Distinguished talent" / "exceptional ability" / "global talent" / "endorsement-based" sub-streams that bypass salary entirely count as alternative routes.
"Investor" sub-streams within an otherwise salary-based program count as one alternative.

Edge cases:

A "fast-track" for high salaries is NOT an alternative pathway; it's a salary-based variant.
Alternative must be a genuinely different criterion (points, investment, patent, extraordinary ability, endorsement).
"Public-interest exemption" or ministerial discretion is NOT an alternative pathway.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // A.3.3 — Recall: Express Entry CRS age-points decline isn't always
  // labelled "age cap" on the source page. Add explicit known patterns.
  // ────────────────────────────────────────────────────────────────────
  'A.3.3': withPreamble(
    `Extraction Task: A.3.3 — Applicant age cap
Question: What is the maximum age at which a principal applicant can qualify for this program?

Recall hints:

If the source describes a points table where age points decline to zero at a specific age, that age is the effective cap.
Example: Canada Express Entry CRS — age points 0 at age 45 (single applicant) → effective cap 45.
Example: Australia 189/190 — age points 0 from 45 → effective cap 45.
Example: NZ SMV — age cap explicitly 55.
The "cap" can be implicit: "Applicants over [X] receive no age points and rarely meet the CRS cutoff" → still 45 if 45 is the zero-point age.
Look for phrases: "minimum age", "maximum age", "must be under [X]", "applicants aged X to Y", "age points table", "no age points awarded after [X]".

Edge cases:

If no age cap exists, return 999 and note "no age cap".
If points decline gradually after a certain age, return the age at which points reach zero (effective cap) and describe the curve in notes.
Return null only if age is not addressed at all on the page.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // B.2.3 — Negative-match: model returns empty for points-based
  // programmes with no employer sponsorship. Reinforce the 0 path.
  // ────────────────────────────────────────────────────────────────────
  'B.2.3': withPreamble(
    `Extraction Task: B.2.3 — Employer-borne levies and skill charges
Question: What government levies or charges are paid by the sponsoring employer for this program?

Recall hints:

If the program has NO employer sponsorship requirement (Canada Express Entry FSW/CEC, NZ Skilled Migrant, AU Skilled Independent 189), return 0 with notes "no employer sponsorship requirement".
Common levy names: "Skilling Australians Fund (SAF) levy", "Immigration Skills Charge (ISC)", "training levy", "skills surcharge".
Australian SAF levy: AUD 1,800/yr small business or AUD 5,000/yr large business per nominee.
UK ISC: £364/yr small charity, £1,000/yr large company per skilled worker.
Singapore: levies on lower-tier work passes (S Pass) but not Employment Pass — note tier.

Edge cases:

Include skills levies, training charges, immigration skills charges, similar employer-only government fees.
If per-year, report annual cost. If one-off, report total.
If the source distinguishes "small" vs "large" employer rates, report the small-employer rate and note the alternative.
Visa application fee paid by employer is NOT a "levy" for this purpose — that belongs in B.2.1.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // B.2.4 — Format: model returns empty rather than estimate. Permit
  // standard-case estimates with low confidence.
  // ────────────────────────────────────────────────────────────────────
  'B.2.4': withPreamble(
    `Extraction Task: B.2.4 — Mandatory non-government costs
Question: What is the approximate total cost of mandatory non-government requirements (medical exam, translation, health insurance during application) for a standard principal applicant, in local currency?

Recall hints:

Common mandatory costs to include: medical/panel-physician examination (~USD 200–400), police certificate fees (~USD 30–80), document translation/notarisation (~USD 50–200), biometric fee if not already in the gov fee, health insurance for the application period.
If specific amounts are not stated, report a conservative standard-case estimate based on these typical ranges and set confidence ≤ 0.5.
"Immigration Health Surcharge" (UK) is a government fee — belongs in B.2.1, not here.

Edge cases:

Exclude optional agent/lawyer fees.
Include only program-required expenses; do not pad with discretionary costs (translation of optional documents, premium courier).
If the source explicitly says "no third-party costs are required" (rare, but possible for some online-only programs), return 0 with confidence 0.9.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // B.3.1 — Recall: portal name set is incomplete. Add CAN/UKVI/etc.
  // ────────────────────────────────────────────────────────────────────
  'B.3.1': withPreamble(
    `Extraction Task: B.3.1 — Online application availability
Question: How digital-native is the application process?
Allowed values:

"fully_online": application, document upload, payment, and status tracking all online.
"mostly_online": application and payment online, but one step requires in-person or paper.
"hybrid": online initiation but substantial in-person or paper steps remain.
"offline_only": primarily paper-based or requires in-person submission.

Recall hints:

If the source describes applying through a named online portal and does not mention any paper-only or in-person submission step, treat that as evidence for "fully_online".
Recognised online portals (positive evidence — extend this list, don't restrict to it):
  * Australia: ImmiAccount.
  * UK: GOV.UK / "apply online" / UKVI online / myUKVI.
  * Canada: IRCC Portal, Permanent Residence Portal, PR Portal, Authorized Paid Representative Portal, Express Entry profile (Express Entry submission is itself an online process — profile creation and Invitation-to-Apply are entirely online).
  * Singapore: MOM EP Online, ICA myICA, EP Online.
  * Hong Kong: ImmD eVisa.
  * USA: USCIS online filing, ELIS.
If the source says "apply online" with no caveat, that is "fully_online".
"Express Entry is an online system" or equivalent IS positive evidence — do not require enumeration of features.
Document upload and online payment being supported counts as positive evidence even if not enumerated as separate steps.

Edge cases:

Required biometrics or in-person identity check are allowed under "fully_online" — do not downgrade for that alone.
Paper-only requirements for specific document types (couriered sworn translations, originals only) reduce to "mostly_online".
"Submit forms in person at a Visa Application Centre" — that is "hybrid" or "offline_only" depending on whether the form itself is filled online.
If the source is silent on application channel, return empty.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // B.3.2 — Format: clarify counting rules for common patterns.
  // ────────────────────────────────────────────────────────────────────
  'B.3.2': withPreamble(
    `Extraction Task: B.3.2 — In-person / biometric visits required
Question: How many in-person visits (consulate, visa application center, biometric center, government office) are required during application?

Recall hints:

Single biometrics appointment = 1 visit.
Mail-in or pickup biometrics (rare) = 0.
Pre-submission document verification appointment = 1 additional visit.
Visa collection in person = 1 additional visit; if visa is emailed/couriered = 0 for that step.
Post-arrival registration in person to activate the visa = 1 additional visit.
Sum the visits. Common patterns:
  * Australia 482, fully online with biometrics in country = 1.
  * UK Skilled Worker, biometrics + visa collection at VAC = 2.
  * Canada Express Entry from outside Canada = 1 (biometrics) + landing at port of entry (not counted as application visit).
  * Singapore EP/S Pass, biometrics on issuance + Pass collection at MOM SCP = 2.

Edge cases:

If applying from inside the country and no biometrics required (renewal often), return 0.
If "in-person interview is at the discretion of the case officer" but not routinely required, return the routine count (interview as 0 unless mandatory) and note discretion in notes.`
  ),

  // ────────────────────────────────────────────────────────────────────
  // B.3.3 — Recall: Federal Court judicial review without admin appeal
  // (CAN pattern) classified as "limited" but model returns empty.
  // ────────────────────────────────────────────────────────────────────
  'B.3.3': withPreamble(
    `Extraction Task: B.3.3 — Appeal and refusal process clarity
Question: How clearly does this program document its appeal and refusal process?
Allowed values:

"comprehensive": appeal rights, grounds, deadlines, procedures clearly documented; refusal reasons provided in writing.
"substantive": appeal rights and procedures documented; refusal reasons provided but less detailed.
"basic": appeal exists but procedure/deadlines unclear in this source.
"limited": appeal is discretionary, narrow, or judicial-review only.
"absent": no appeal right or not addressed at all.

Recall hints:

If the source describes any of: "request for reconsideration", "administrative review", "tribunal review", "Migration Review Tribunal (MRT)", "Administrative Appeals Tribunal (AAT)", "First-tier Tribunal (Immigration and Asylum)", "Immigration Appeal Division", that is at minimum "basic" — do not return empty.
Federal Court / High Court judicial review without an administrative appeal step (the Canada Express Entry pattern) → "limited".
"Pre-removal risk assessment" is NOT an appeal — it's a separate humanitarian channel.
"Reapply" is NOT an appeal.
A documented internal-review step before judicial review = at least "basic".

Edge cases:

Administrative review for specific categories (e.g., in-country refusals) should be noted.
If only a general "you can apply for judicial review" sentence appears with no procedure details, that is "limited" not "absent".`
  ),

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

const C32_REGIONAL_RUBRIC = {
  categories: [
    {
      value: 'automatic',
      score: 100,
      description: 'public schooling automatic for visa-holder dependants',
    },
    {
      value: 'fee_paying',
      score: 40,
      description: 'fee-paying access only (Gulf-style)',
    },
  ],
};

export const PHASE_3_5_INDICATOR_RESTRUCTURES: Record<string, IndicatorRestructure> = {
  'B.2.3': {
    dataType: 'json',
    normalizationFn: 'boolean_with_annotation',
    direction: 'lower_is_better',
    scoringRubricJsonb: STRUCTURED_BOOL_RUBRIC,
    extractionPromptMd: withPreamble(
      `Extraction Task: B.2.3 — Employer-borne levies and skill charges (boolean+annotation)
Question: Does this programme require the sponsoring employer to pay any government levy or skill charge?

OUTPUT SHAPE — STRICT. The valueRaw field MUST be a JSON OBJECT, NOT a currency string. Wrong: "AUD 1,800". Right: { "hasLevy": true, "notes": "Skilling Australians Fund (SAF) levy AUD 1,800 / year for 4-year stream." }. If you find a currency amount in the page, embed it inside the notes field; never return the bare amount as valueRaw.

Return value: a JSON object with this exact shape (and no other top-level keys):
  { "hasLevy": boolean, "notes": string | null }

Recall hints (extends Phase 3.3 v2 prompt):

If the program has NO employer sponsorship requirement (Canada Express Entry FSW/CEC, NZ Skilled Migrant 189-style, AU Skilled Independent 189), return { "hasLevy": false, "notes": "no employer sponsorship requirement" }.
Common levy names that indicate hasLevy=true: "Skilling Australians Fund (SAF) levy", "Immigration Skills Charge (ISC)", "training levy", "skills surcharge".
notes is a one-sentence summary of the levy name and amount when present, or null when none.

Edge cases:

If the page is silent on employer levies but employer sponsorship IS required, do not infer hasLevy=false; return null with notes "page silent on levies".
"Visa application fee paid by employer" is NOT a levy — it's a B.2.1 fee. Do not include.`
    ),
  },

  'B.2.4': {
    dataType: 'json',
    normalizationFn: 'boolean_with_annotation',
    direction: 'lower_is_better',
    scoringRubricJsonb: STRUCTURED_BOOL_RUBRIC,
    extractionPromptMd: withPreamble(
      `Extraction Task: B.2.4 — Mandatory non-government costs (boolean+annotation)
Question: Does this programme require any mandatory non-government costs (medical exam, document translation, police check fees, application-period health insurance) for a standard principal applicant?

Return value: a JSON object with this exact shape:
  { "hasMandatoryNonGovCosts": boolean, "notes": string | null }

Recall hints:

Almost every programme has at least one mandatory non-government cost (police certificate, panel-physician medical, statutory translation). Return hasMandatoryNonGovCosts=true unless the page explicitly states "no third-party costs are required".
notes is a one-sentence summary listing the mandatory non-gov requirement(s).

Edge cases:

Optional agent/lawyer fees do NOT count.
Government health surcharges (UK IHS) do NOT count — those are B.2.1 government fees.
If the page is silent on non-gov costs entirely (rare for a major programme), return null with notes "page silent on third-party costs".`
    ),
  },

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
    // The prompt is unchanged from v1 — extraction still runs first; the
    // country-substitute mechanism only fires at publish time IF
    // extraction returns empty AND the country has a regional default.
    extractionPromptMd: withPreamble(
      `Extraction Task: C.3.2 — Public education access for children of visa holders
Question: Do children of this programme's visa holders have automatic access to the public education system (free schooling) on the same terms as citizen children?

Allowed values:

"automatic": yes, public-school enrolment available with no extra fees.
"fee_paying": access available but fees apply (Gulf-style international school requirement).
"restricted": case-by-case basis or local-authority approval.
"none": children have no public-school access.

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
