/**
 * Canonical GTMI Methodology V1
 * Note: Keep this file in parity with docs/METHODOLOGY.md manually.
 * This is the source-of-truth for the extraction pipeline and scoring engine.
 */

const SHARED_PREAMBLE = `Context
You are extracting a single indicator for the Global Talent Mobility Index (GTMI). The program is {program_name} ({program_country}). The source document is an official Tier 1 government page describing this program.
Required fields in every response

"value": the extracted value (type depends on indicator)
"source_sentence": the exact verbatim sentence(s) from the document that support the value. Must be a substring of the document. Do not paraphrase.
"confidence": a self-assessed score 0.0-1.0 for how confidently you can answer from this document alone.
"notes": optional, short, for edge cases or ambiguity only. Empty string if none.

Universal rules

Use ONLY the provided document. Do not bring in outside knowledge.
If the document does not contain the information, return {"value": null, "source_sentence": "", "confidence": 0.0, "notes": "not found in source"}.
If the document is ambiguous or contradicts itself, return confidence below 0.6 and explain in notes.
Do not interpret beyond what the document states. If the document says "typically 90 days" do not report 90 days as definitive.`;

export const methodologyV1 = {
  framework_structure: {
    A: {
      'A.1': ['A.1.1', 'A.1.2', 'A.1.3', 'A.1.4', 'A.1.5'],
      'A.2': ['A.2.1', 'A.2.2', 'A.2.3'],
      'A.3': ['A.3.1'],
    },
    B: {
      'B.1': ['B.1.1', 'B.1.2'],
      'B.2': ['B.2.1', 'B.2.2'],
      'B.3': ['B.3.1'],
      'B.4': ['B.4.1', 'B.4.2'],
    },
    C: {
      'C.1': ['C.1.1', 'C.1.2', 'C.1.3', 'C.1.4'],
      'C.2': ['C.2.1', 'C.2.2', 'C.2.3', 'C.2.4'],
      'C.3': ['C.3.1', 'C.3.2'],
    },
    D: {
      'D.1': ['D.1.1', 'D.1.2', 'D.1.3', 'D.1.4'],
      'D.2': ['D.2.1', 'D.2.2', 'D.2.3', 'D.2.4'],
      'D.3': ['D.3.1', 'D.3.2', 'D.3.3'],
    },
    E: {
      'E.1': ['E.1.1', 'E.1.2', 'E.1.3'],
      'E.2': ['E.2.1', 'E.2.2', 'E.2.3'],
      'E.3': ['E.3.1', 'E.3.2'],
    },
  },
  pillar_weights: { A: 0.28, B: 0.15, C: 0.2, D: 0.22, E: 0.15 },
  sub_factor_weights: {
    'A.1': 0.5,
    'A.2': 0.3,
    'A.3': 0.2,
    'B.1': 0.3,
    'B.2': 0.2,
    'B.3': 0.3,
    'B.4': 0.2,
    'C.1': 0.45,
    'C.2': 0.35,
    'C.3': 0.2,
    'D.1': 0.5,
    'D.2': 0.35,
    'D.3': 0.15,
    'E.1': 0.5,
    'E.2': 0.3,
    'E.3': 0.2,
  },
  indicator_weights: {
    'A.1.1': 0.25,
    'A.1.2': 0.2,
    'A.1.3': 0.2,
    'A.1.4': 0.2,
    'A.1.5': 0.15,
    'A.2.1': 0.35,
    'A.2.2': 0.4,
    'A.2.3': 0.25,
    'A.3.1': 1.0,
    'B.1.1': 0.7,
    'B.1.2': 0.3,
    'B.2.1': 0.5,
    'B.2.2': 0.5,
    'B.3.1': 1.0,
    'B.4.1': 0.5,
    'B.4.2': 0.5,
    'C.1.1': 0.3,
    'C.1.2': 0.3,
    'C.1.3': 0.25,
    'C.1.4': 0.15,
    'C.2.1': 0.4,
    'C.2.2': 0.25,
    'C.2.3': 0.2,
    'C.2.4': 0.15,
    'C.3.1': 0.5,
    'C.3.2': 0.5,
    'D.1.1': 0.3,
    'D.1.2': 0.3,
    'D.1.3': 0.2,
    'D.1.4': 0.2,
    'D.2.1': 0.3,
    'D.2.2': 0.3,
    'D.2.3': 0.2,
    'D.2.4': 0.2,
    'D.3.1': 0.36,
    'D.3.2': 0.44,
    'D.3.3': 0.2,
    'E.1.1': 0.5,
    'E.1.2': 0.3,
    'E.1.3': 0.2,
    'E.2.1': 0.4,
    'E.2.2': 0.3,
    'E.2.3': 0.3,
    'E.3.1': 0.5,
    'E.3.2': 0.5,
  },
  normalization_choices: {
    'A.1.1': 'min_max',
    'A.1.2': 'categorical',
    'A.1.3': 'min_max',
    'A.1.4': 'categorical',
    'A.1.5': 'min_max',
    'A.2.1': 'min_max',
    'A.2.2': 'categorical',
    'A.2.3': 'min_max',
    'A.3.1': 'categorical',
    'B.1.1': 'min_max',
    'B.1.2': 'boolean',
    'B.2.1': 'min_max',
    'B.2.2': 'min_max',
    'B.3.1': 'min_max',
    'B.4.1': 'categorical',
    'B.4.2': 'categorical',
    'C.1.1': 'categorical',
    'C.1.2': 'categorical',
    'C.1.3': 'categorical',
    'C.1.4': 'boolean',
    'C.2.1': 'categorical',
    'C.2.2': 'min_max',
    'C.2.3': 'boolean',
    'C.2.4': 'boolean',
    'C.3.1': 'categorical',
    'C.3.2': 'categorical',
    'D.1.1': 'boolean',
    'D.1.2': 'min_max',
    'D.1.3': 'min_max',
    'D.1.4': 'min_max',
    'D.2.1': 'boolean',
    'D.2.2': 'min_max',
    'D.2.3': 'boolean',
    'D.2.4': 'categorical',
    'D.3.1': 'min_max',
    'D.3.2': 'categorical',
    'D.3.3': 'categorical',
    'E.1.1': 'z_score',
    'E.1.2': 'boolean',
    'E.1.3': 'min_max',
    'E.2.1': 'boolean',
    'E.2.2': 'categorical',
    'E.2.3': 'categorical',
    'E.3.1': 'min_max',
    'E.3.2': 'min_max',
  },
  cme_paq_split: { cme: 0.3, paq: 0.7 },
  version_tag: '3.0.0',
  indicators: [
    {
      key: 'A.1.1',
      label: 'Salary threshold as % of local median wage',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.1 — Salary threshold as % of local median wage
Question: What is the minimum salary required of a principal applicant, expressed as a percentage of the local median wage (or the equivalent national statistical reference cited by the program)?

Recall hints:

If the source explicitly states the threshold is calibrated against, set at, derived from, or matched to a percentage of national/local median earnings — even alongside an absolute amount — report that percentage as a number (e.g. 100, 80, 150).
Examples that should yield a value: "TSMIT is set at the median earnings for full-time workers" → 100; "salary equal to 80% of full-time median" → 80; "matched annually to ABS earnings data" → 100; "indexed to the going rate" → 100.
"Going rate" / "prevailing wage" methodologies (UK Skilled Worker, US H-1B style) are explicit median-anchor references — extract whatever percentage the page assigns to the threshold. If the page states a threshold AND a contemporaneous median figure for the same labour market, compute the implied percentage to one decimal place.
If expressed as a multiple (e.g. "1.5x median"), convert to a percentage (150).

Edge cases:

If the threshold is purely a fixed amount with no percentage anchor stated anywhere AND no median figure is cited on the page to compute against, return null with notes "no median anchor".
If the source gives both (e.g. "the greater of X or Y% of median"), report the percentage.
For points-based programs with no fixed salary floor, return null with notes "points-based; no salary threshold".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.2',
      label: 'Minimum educational requirement',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.2 — Minimum educational requirement
Question: What is the minimum formal educational qualification a principal applicant must hold?
Allowed values:

"none": no minimum education stated.
"secondary": high school or equivalent.
"vocational": post-secondary vocational or associate-level qualification.
"bachelor": bachelor's degree or equivalent.
"master": master's degree or equivalent.
"doctorate": doctoral degree or equivalent.

Edge cases:

If "equivalent work experience in lieu of degree" is accepted, report the formal floor (what is required if one cannot substitute) and note the substitution option.
If the program is points-based and education contributes points without a hard floor, report the lowest education level at which any points are awarded.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no minimum education stated.' },
          { value: 'secondary', description: 'high school or equivalent.' },
          {
            value: 'vocational',
            description: 'post-secondary vocational or associate-level qualification.',
          },
          { value: 'bachelor', description: "bachelor's degree or equivalent." },
          { value: 'master', description: "master's degree or equivalent." },
          { value: 'doctorate', description: 'doctoral degree or equivalent.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.3',
      label: 'Minimum work experience (years)',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.3 — Minimum work experience (years)
Question: What is the minimum years of relevant professional work experience required of a principal applicant?
Edge cases:

If experience is required only in the absence of a degree, report the experience floor that applies when the degree IS held (often 0).
If there is no experience requirement, return 0.
If experience varies by occupation, report the standard/core requirement and describe variation in notes.
For points-based programs where experience contributes points without a hard floor, return 0 and describe the points scaling in notes.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.4',
      label: 'Language proficiency requirement',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.4 — Language proficiency requirement
Question: What is the language proficiency level required of a principal applicant?
Allowed values:

"none": no language requirement.
"basic": A1-A2 CEFR or equivalent (IELTS 4.0-4.5).
"intermediate": B1 CEFR or equivalent (IELTS 5.0-5.5).
"upper_intermediate": B2 CEFR or equivalent (IELTS 6.0-6.5).
"advanced": C1+ CEFR or equivalent (IELTS 7.0+).

Edge cases:

If components have different minima, report the highest required.
Note degree-taught-in-local-language exemptions.
Report the strictest standard scenario.
For points-based programs where language contributes points without a hard floor, report the lowest level at which any points are awarded.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no language requirement.' },
          { value: 'basic', description: 'A1-A2 CEFR or equivalent (IELTS 4.0-4.5).' },
          { value: 'intermediate', description: 'B1 CEFR or equivalent (IELTS 5.0-5.5).' },
          {
            value: 'upper_intermediate',
            description: 'B2 CEFR or equivalent (IELTS 6.0-6.5).',
          },
          { value: 'advanced', description: 'C1+ CEFR or equivalent (IELTS 7.0+).' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.5',
      label: 'Applicant age cap',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.15,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.5 — Applicant age cap
Question: What is the maximum age at which a principal applicant can qualify for this program?

Recall hints:

If the source describes a points table where age points decline to zero at a specific age, that age is the effective cap.
Example: Canada Express Entry CRS — age points 0 at age 45 → effective cap 45.
Example: Australia 189/190 — age points 0 from 45 → effective cap 45.
Example: NZ SMV — age cap explicitly 55.
Look for phrases: "minimum age", "maximum age", "must be under [X]", "applicants aged X to Y", "age points table", "no age points awarded after [X]".

Edge cases:

If no age cap exists, return 999 and note "no age cap".
If points decline gradually after a certain age, return the age at which points reach zero (effective cap) and describe the curve.
Return null only if age is not addressed at all on the page.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.2.1',
      label: 'Number of mandatory qualifying criteria',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.35,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.1 — Number of mandatory qualifying criteria
Question: How many distinct mandatory criteria must a principal applicant satisfy simultaneously to qualify for this program (i.e. the number of "must meet" gates, not the number of points categories)?

Counting rules:

Count each independent gate that the applicant MUST satisfy (a failure on any one disqualifies them) as 1.
Typical gates to count: salary threshold, education floor, work experience floor, language floor, age cap, occupation eligibility, sponsorship/employer requirement, character/health, points-test minimum score.
Do NOT count optional bonus criteria, tie-breakers, or sub-stream-specific add-ons that don't apply to the standard pathway.
Do NOT count administrative requirements (fees, application format, biometrics) — only substantive eligibility gates.
A points-test minimum total counts as 1 gate, regardless of how many sub-categories feed into it.

Edge cases:

If the program publishes an explicit numbered list of "eligibility requirements", use that count when each item is a hard gate.
For purely points-based programs with only a points-floor and no other hard gates, return 1.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.2.2',
      label: 'System type: compensatory vs. conjunctive',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.2 — System type: compensatory vs. conjunctive
Question: How does this program combine its qualifying criteria — does it allow strong scores on one criterion to compensate for weak scores on another (compensatory), or must every gate be cleared independently (conjunctive)?
Allowed values:

"conjunctive": every mandatory criterion must be satisfied independently; failure on any one disqualifies (e.g. UK Skilled Worker, EU Blue Card with hard floors on all of salary/education/contract).
"compensatory": a points/score system where a high score on one factor can offset a low score on another (e.g. Canada Express Entry CRS, Australia points test, NZ SMV).
"hybrid": a small set of hard gates (e.g. age cap, language floor) PLUS a compensatory points score across the remaining factors (most modern points-tested programs that retain absolute floors).

Edge cases:

If the source describes a points test with a minimum total score AND no separate hard floors, that is "compensatory".
If every requirement is described as "must" / "required" / "mandatory" with no points trade-off language, that is "conjunctive".
If the program has a points test PLUS one or more independent hard gates that cannot be compensated for (typical age cap, language floor), that is "hybrid".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'conjunctive',
            description: 'every mandatory criterion must be satisfied independently.',
          },
          {
            value: 'compensatory',
            description:
              'points/score system; strong scores on one factor offset weak scores on another.',
          },
          {
            value: 'hybrid',
            description:
              'small set of hard gates plus a compensatory points score across remaining factors.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.2.3',
      label: 'Number of distinct qualifying tracks',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.3 — Number of distinct qualifying tracks
Question: How many genuinely distinct sub-streams or qualifying tracks does this program offer to a principal applicant (each with its own eligibility criteria)?

Counting rules:

Count each named sub-stream the source describes as a separate qualifying track if it has its own independent set of eligibility criteria.
Examples that yield a count: Canada Express Entry — 3 (FSW + CEC + FST); UK Global Talent — typically 2 (exceptional talent + exceptional promise) per endorsing body; Australia Skilled — 3 (189/190/491) per page; Singapore Tech.Pass / EP / ONE Pass each count as 1 if covered separately.
A "fast-track for high salary" within an otherwise single-track program is NOT a separate track; it is a variant of the same track.
Tie-breaker bonus categories are NOT tracks.

Edge cases:

If the program is a single visa with no sub-streams, return 1.
If the source enumerates streams in a list/table, prefer that count.
If the source is silent on stream count, return 1 with notes "single track inferred — no sub-streams described".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.3.1',
      label: 'Annual quota presence and size',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.3',
      weightWithinSubFactor: 1.0,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.3.1 — Annual quota presence and size
Question: Does this program have an annual numerical cap, and how restrictive is it?
Allowed values:

"no_quota": no annual cap on this program.
"large_quota": cap exists but substantially larger than historical demand (rarely exhausted).
"moderate_quota": cap sometimes exhausted but generally adequate.
"tight_quota": cap regularly exhausted or demand exceeds supply.
"quota_undisclosed": cap exists but size is not published in this source.

Edge cases:

If document does not characterize demand-vs-supply, default to "moderate_quota" when a number is published without context.
Record the raw cap number in notes or in cap_number where published.

If the document is silent on quotas entirely, return the universal "not found in source" response ({"value": null, ...}) — DO NOT return a category value. Only the five allowed values above are valid; any other token will be rejected.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'no_quota', description: 'no annual cap on this program.' },
          {
            value: 'large_quota',
            description:
              'cap exists but substantially larger than historical demand (rarely exhausted).',
          },
          {
            value: 'moderate_quota',
            description: 'cap sometimes exhausted but generally adequate.',
          },
          {
            value: 'tight_quota',
            description: 'cap regularly exhausted or demand exceeds supply.',
          },
          {
            value: 'quota_undisclosed',
            description: 'cap exists but size is not published in this source.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.1.1',
      label: 'Standard SLA (days)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.1',
      weightWithinSubFactor: 0.7,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.1.1 — Standard SLA (days)
Question: What is the standard published processing time for this program, in calendar days from a complete application's submission to a decision being issued?

Recall hints:

Extract the numeric figure verbatim. If stated in weeks, multiply by 7. If stated in months, multiply by 30 (and note "month → 30 days conversion" in notes).
If the page gives a range ("4–6 weeks", "60 to 90 days"), report the midpoint (rounded to the nearest day) and capture the original range in notes.
If the page expresses the SLA as a percentile ("90% of applications decided within 30 days"), report that point estimate and note the percentile framing.
If expressed in business days, convert to calendar days (× 7/5, round up) and note the conversion.

Edge cases:

If the page is genuinely silent on processing time, return null with notes "no published SLA". Do NOT infer; the scoring engine treats "not published" as the cohort-worst observed value at score time.
"Currently experiencing delays" disclaimers do not override the published SLA; report the published figure.
Fast-track / priority routes are extracted separately at B.1.2 — only the standard SLA goes here.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.1.2',
      label: 'Fast track availability',
      dataType: 'boolean',
      pillar: 'B',
      subFactor: 'B.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.1.2 — Fast track availability
Question: Does this program offer any expedited or priority processing track, regardless of name?

Return value: a boolean — true if any expedited / priority / premium / fast-track / accelerated processing route exists for the program; false if none is published.

Recall hints:

Names to look for: "priority service", "premium processing", "fast track", "express stream", "expedited", "accelerated", "ultra fast", "super priority", "Tier 1 priority", "platinum service".
The fast-track does NOT need to be free or universally available — sponsor-only or fee-paying fast tracks count as true.
"In-flight upgrade to priority" options that an applicant can pay for after submission count as true.

Edge cases:

A general "we are processing faster than usual right now" notice is NOT a fast track — return false.
Fast-track for specific occupation lists (e.g. shortage-occupation streams) counts as true.
If the page is silent on processing tracks at all, return false with notes "no fast-track mentioned" — never null.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.1',
      label: 'Number of mandatory application steps',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.1 — Number of mandatory application steps
Question: How many discrete, named stages must the applicant traverse from submission to visa-in-hand, as published in the official application guide?

Counting rules:

Count each named stage where the applicant must take a distinct action as 1 step.
Typical countable stages: sponsorship request, skills assessment, online application form, document upload, payment, biometrics appointment, medical exam, interview, decision, visa collection, post-arrival registration.
Do NOT count sub-forms or sub-screens within a single named stage (e.g., the form's individual pages).
Do NOT count optional stages or stages the program merely "may require" — only mandatory.
Do NOT count stages the visa authority performs internally (e.g., "background check" if the applicant has no action).

Edge cases:

If the page has no enumerated guide, count from the procedure narrative.
If the page is silent on the application procedure entirely, return null with notes "no procedure described".
Pre-arrival visa stamping at a consulate counts. Post-arrival biometric residence permit collection counts.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.2',
      label: 'Mandatory in-person touchpoints',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.2 — Mandatory in-person touchpoints
Question: Across the full application process, in how many distinct stages must the applicant be physically present at a government office, consulate, visa application centre, panel-physician clinic, or other in-person location?

Counting rules:

Count each mandatory in-person touchpoint as 1: biometrics, medical exam, interview, document verification visit, in-person submission, in-person visa collection, post-arrival registration.
Remote / waived stages count as 0. If biometrics can be waived for an enrolled applicant, do not count it.
A single visit that combines multiple steps (e.g., biometrics + interview at the same VAC appointment) counts as 1.

Edge cases:

If the page describes the process as "fully online" without enumerating offline steps, return 0 unless biometrics are explicitly required (then 1).
"Couriered passport return" is NOT an in-person touchpoint.
If the page is silent on procedure, return null with notes "no procedure described".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.3.1',
      label: 'Total applicant cost (USD; principal + 1 spouse + 2 children)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.3',
      weightWithinSubFactor: 1.0,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.3.1 — Total applicant cost (USD; principal + 1 spouse + 2 children)
Question: What is the total approximate cost in USD-equivalent for a standard family of 4 (principal applicant, 1 spouse, 2 children) to obtain this visa, summing government fees and any mandatory non-government costs explicitly stated on official sources?

Components to sum:

Principal applicant government fee (application + issuance + mandatory levies to the issuing authority).
Spouse fee × 1.
Child fee × 2 (if a separate child fee is published; otherwise treat children as additional dependants at the published per-dependant rate).
Mandatory non-government costs ONLY where explicitly itemised on official sources: biometrics service charge (if separate), medical exam fee (if a published official rate exists), skills-assessment fee, statutory translation fee.
Do NOT include: optional agent/lawyer fees, immigration health surcharges already counted as government fees, employer-borne levies, post-arrival residency-card fees outside the visa application.

Currency handling (IMPORTANT):

Capture the original currency on each component, sum within currency, convert to USD inline using a single date-stamped rate. Report the USD total as the value, and quote the source currency, the conversion rate used, and the rate's date in notes.
If the page lists fees in multiple currencies (e.g., a USD-equivalent in parentheses), prefer the source local currency for the component, then convert.
The downstream scoring engine treats this value as opaque USD — do NOT defer conversion to score time.

Edge cases:

If non-government costs are NOT disclosed on official sources, sum government fees only and set extractionConfidence ≤ 0.7. Add notes "non-gov costs not disclosed on official source — government fees only".
If dependants are not permitted on this program, sum principal-only and note "no dependants permitted; principal-only total".
If a published fee covers the whole family unit (single all-inclusive figure), report it as-is and note the all-inclusive framing.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.4.1',
      label: 'Appeal and refusal process clarity',
      dataType: 'categorical',
      pillar: 'B',
      subFactor: 'B.4',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.4.1 — Appeal and refusal process clarity
Question: How clearly does the official program page document what happens on refusal and what appeal or reconsideration mechanism, if any, is available?

Allowed values:

"none": no information about refusal or appeal is published.
"partial": the page mentions refusal or appeal exists, but the procedure, grounds, or timeframes are not clearly published.
"full": an explicit appeal or reconsideration process is documented, including at least one of: steps to lodge the appeal, deadlines, grounds for review, decision-maker.

Edge cases:

A blanket "decisions are final" statement with no review mechanism is "none" if it does not explain why refusals occur or what the applicant can do; "partial" if it explains refusal grounds.
Generic ministerial-discretion or ombudsman-route mentions without process detail are "partial".
Judicial review alone, without an administrative appeal/reconsideration, is "partial" unless the page explicitly documents the judicial route.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no information about refusal or appeal is published.' },
          {
            value: 'partial',
            description:
              'refusal or appeal mentioned, but procedure, grounds, or timeframes are not clearly published.',
          },
          {
            value: 'full',
            description:
              'explicit appeal or reconsideration process documented with steps, deadlines, grounds, or decision-maker.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.4.2',
      label: 'Application status tracking',
      dataType: 'categorical',
      pillar: 'B',
      subFactor: 'B.4',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.4.2 — Application status tracking
Question: After submission, can the applicant track the status of their application?

Allowed values:

"none": no published method of checking status; applicant waits for the final decision letter.
"email_only": the program publishes that applicants will receive email updates at key stages (received, under review, decided), but no self-service lookup is offered.
"online_portal": the program offers a self-service portal where the applicant can log in and view current status at any time.

Edge cases:

A general government contact number / helpline used to ask "what's happening" is NOT status tracking — that is "none".
SMS/text notifications without an online portal map to "email_only".
A portal that only shows "submitted" / "decided" with no intermediate stages still counts as "online_portal".`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no published method of checking status.' },
          {
            value: 'email_only',
            description: 'email updates at key stages; no self-service lookup.',
          },
          {
            value: 'online_portal',
            description: 'self-service portal where the applicant can view current status.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.1',
      label: 'Employer-sponsorship requirement',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.1 — Employer-sponsorship requirement
Question: Does this program require an employer sponsor, and if so, throughout the visa duration?
Allowed values:

"not_required": no employer sponsor needed at any stage.
"required_initial_only": sponsor required for initial application; holder independent afterward.
"required_throughout": sponsor required for the duration; losing sponsor jeopardizes status.

Edge cases:

Endorsing bodies (Tech Nation, professional bodies) that are not employers: count as "not_required" if endorsement is one-time; "required_throughout" if endorsement must be maintained.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'not_required', description: 'no employer sponsor needed at any stage.' },
          {
            value: 'required_initial_only',
            description: 'sponsor required for initial application; holder independent afterward.',
          },
          {
            value: 'required_throughout',
            description: 'sponsor required for the duration; losing sponsor jeopardizes status.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.2',
      label: 'Ability to switch employers (no re-application vs. re-application)',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.2 — Ability to switch employers
Question: How freely can the visa holder change employers?
Allowed values:

"free_switching": switch without permission or re-application.
"notification_only": switching requires notifying the authority, no re-application.
"re_application": switching requires new sponsorship application or substantial re-filing.
"not_permitted": employer switching not permitted.

Edge cases:

Grace periods after job loss should be noted (and captured in grace_period_days where stated).
Restrictions to same occupational classification should be noted.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'free_switching',
            description: 'switch without permission or re-application.',
          },
          {
            value: 'notification_only',
            description: 'switching requires notifying the authority, no re-application.',
          },
          {
            value: 're_application',
            description: 'switching requires new sponsorship application or substantial re-filing.',
          },
          { value: 'not_permitted', description: 'employer switching not permitted.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.3',
      label: 'Self-employment and secondary income rights',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.3 — Self-employment and secondary income rights
Question: Can the visa holder engage in self-employment and secondary income activities?
Allowed values:

"full_rights": both fully permitted.
"limited_secondary": secondary employment permitted but self-employment restricted/prohibited.
"permitted_with_permission": permitted only with prior authorization.
"prohibited": self-employment and secondary income not permitted.

Edge cases:

Passive investment income (dividends, rental) generally outside these rules unless addressed.
Sector/occupation restrictions should be noted.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'full_rights', description: 'both fully permitted.' },
          {
            value: 'limited_secondary',
            description:
              'secondary employment permitted but self-employment restricted/prohibited.',
          },
          {
            value: 'permitted_with_permission',
            description: 'permitted only with prior authorization.',
          },
          {
            value: 'prohibited',
            description: 'self-employment and secondary income not permitted.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.4',
      label: 'Labor market test requirement',
      dataType: 'boolean',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.15,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.4 — Labor market test requirement
Question: Is a labor market test (LMT), resident labor market test, or "no suitable local candidate" certification required before visa issuance?
Edge cases:

LMT waived for shortage-list occupations: report true for standard case, note the waiver.
LMT waived for high salaries: same.
If program explicitly exempted from LMT, report false.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.1',
      label: 'Spouse inclusion and work rights (automatic / by permit / none)',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.1 — Spouse inclusion and work rights
Question: Can a spouse accompany the principal applicant, and what are the spouse's work rights?
Allowed values:

"automatic_with_full_work_rights": included on the same application/visa and has unrestricted work rights.
"automatic_with_limited_work_rights": included on the same visa but work rights limited (sector, hours, separate permit).
"automatic_no_work_rights": included on the same visa but cannot work.
"by_permit_with_work_rights": must apply separately on a dependant pass; if approved, can work.
"by_permit_no_work_rights": must apply separately; if approved, cannot work.
"not_permitted": spouse cannot accompany.

Recall hints:

The category names use the literal word "automatic" but the source rarely does. Use these decision rules:

  - "Family members can be included on this visa" + no separate dependant pass mentioned → automatic.
  - Source describes a separate "Dependant Pass", "Spouse Visa", or "DP application" required → by_permit.
  - "Family members can work" / "spouse has work rights" / "no condition on family member's employment" → with_full_work_rights.
  - "Family members can work but require a separate work permit / Letter of Consent" → with_limited_work_rights.
  - Source is silent on work rights but covers inclusion → return only the inclusion half if confident; if uncertain, return empty.

Edge cases:

This indicator reflects a married opposite-sex spouse. Same-sex partner recognition is C.2.4; unmarried partner variations go in notes.
If source explicitly references "secondary applicants" or "subsequent entrants" without specifying spouse, do not use that for this field.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'automatic_with_full_work_rights',
            description: 'included and has unrestricted work rights.',
          },
          {
            value: 'automatic_with_limited_work_rights',
            description: 'included but work rights limited (sector, hours, separate permit).',
          },
          { value: 'automatic_no_work_rights', description: 'included but cannot work.' },
          {
            value: 'by_permit_with_work_rights',
            description: 'applies separately; if approved, can work.',
          },
          {
            value: 'by_permit_no_work_rights',
            description: 'applies separately; if approved, cannot work.',
          },
          { value: 'not_permitted', description: 'spouse cannot accompany.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.2',
      label: 'Dependent child age cap and inclusion terms',
      dataType: 'numeric',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.2 — Dependent child age cap
Question: Up to what age can a dependent child be included on the principal's visa?
Edge cases:

If cap differs for full-time students, report the higher cap and note the condition (populate student_extension_age).
If no age cap, return 999.
If children age out mid-visa, note this.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.3',
      label: 'Parent or extended family inclusion option',
      dataType: 'boolean',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.3 — Parent or extended family inclusion option
Question: Does this program permit inclusion of parents, grandparents, or other extended family as dependants?
Edge cases:

"Dependant parent" provisions requiring financial dependency qualify as true.
Separate parent visas (not dependants on this visa) do not count.
Siblings generally don't count unless explicitly addressed.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.4',
      label: 'Same-sex partner recognition',
      dataType: 'boolean',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.15,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.4 — Same-sex partner recognition
Question: Does this program recognize same-sex spouses or same-sex de facto partners as eligible dependants?
Edge cases:

Recognition of a foreign same-sex marriage counts as true even if the country doesn't itself perform them.
De facto / civil partnership recognition with similar rights to marriage counts as true.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.3.1',
      label: 'Public healthcare access',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.3',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.3.1 — Public healthcare access
Question: What is the visa holder's access to the public healthcare system?
Allowed values:

"automatic" (alias of "full_access"): the document states unconditionally that the visa holder is entitled to the same public-health benefits as citizens or permanent residents.
"full_access": same basis as citizens/PRs (legacy alias of "automatic"; either is acceptable).
"conditional_rhca": the document states the visa holder's access is contingent on a bilateral or reciprocal health agreement between countries — phrasing such as "eligible for [public health system] if [country] has a Reciprocal Health Care Agreement", "bilateral health agreement", or "covered only if your country of citizenship has signed a [agreement-name]".
"levy_required": access conditional on payment of a health levy or contribution (e.g. an annual surcharge, employer-paid contribution, or means-tested premium).
"insurance_required": access conditional on the visa holder holding private health insurance.
"emergency_only": only emergency care is publicly covered; routine care is not.
"no_access": the document explicitly excludes the visa holder from public health coverage — phrasing such as "not eligible", "must arrange private health insurance", or "not covered".
"not_stated": the page mentions this visa program but does NOT discuss healthcare access at all. Use this when the document is silent — not when access is denied. (This produces a row that scores null and surfaces the gap explicitly rather than silently.)

Edge cases:
- Hybrid regimes (e.g., levy + private top-up): map to the primary requirement, note secondary.
- Employer-provided insurance does not change the underlying regime.
- Use the generic patterns above. Apply the same pattern logic to whatever public health system the document references.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'full_access', score: 100, description: 'same basis as citizens/PRs.' },
          {
            value: 'automatic',
            score: 100,
            description: 'same basis as citizens/PRs (alias of full_access).',
          },
          {
            value: 'conditional_rhca',
            score: 70,
            description: 'access contingent on a reciprocal/bilateral health agreement.',
          },
          {
            value: 'levy_required',
            score: 70,
            description: 'access upon payment of a health levy/contribution.',
          },
          {
            value: 'insurance_required',
            score: 50,
            description: 'access contingent on private insurance.',
          },
          {
            value: 'emergency_only',
            score: 20,
            description: 'only emergency care covered publicly.',
          },
          { value: 'no_access', score: 0, description: 'no public healthcare access.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.3.2',
      label: 'Public education access for children',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.3',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.3.2 — Public education access for children
Question: What is the dependent child's access to public education?
Allowed values:

"automatic": public schooling available on the same basis as citizens/PRs (no extra fees).
"fee_paying": access available but foreign-student or fee-paying levy applies.
"restricted": case-by-case basis or local-authority approval, not guaranteed.
"none": no access to public education.

Edge cases:

Right to attend does not mean right to free attendance: if tuition applies, "fee_paying" not "automatic".
Higher-education access is separate and not required here.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'automatic',
            description: 'public schooling available on the same basis as citizens/PRs.',
          },
          {
            value: 'fee_paying',
            description: 'access available but foreign-student or fee-paying levy applies.',
          },
          {
            value: 'restricted',
            description: 'case-by-case basis or local-authority approval, not guaranteed.',
          },
          { value: 'none', description: 'no access to public education.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.1.1',
      label: 'PR provision available (yes / no)',
      dataType: 'boolean',
      pillar: 'D',
      subFactor: 'D.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.1 — PR provision available
Question: Does this program provide a direct pathway to permanent residence (PR) or equivalent indefinite-stay status?
Edge cases:

Indefinite leave to remain (ILR) or equivalent permanent status counts as true.
Pathway requiring switch to a different visa counts as true only if the switch is explicitly documented as a standard transition.
Temporary-only program with no documented PR route = false.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.1.2',
      label: 'Minimum years of residence to PR eligibility',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.2 — Minimum years of residence to PR eligibility
Question: Minimum cumulative years of residence under this program (or explicitly described combined pathway) before PR eligibility?
Edge cases:

If combined pathway described (e.g., 2 years on this visa + 2 on successor), report the total.
If PR not available, return null.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.1.3',
      label: 'Physical presence requirement during accrual (days/yr)',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.3 — Physical presence requirement during accrual (days/year)
Question: How many days per year must the visa holder physically be present for that year to count toward PR qualifying period?
Edge cases:

If expressed as maximum-absence (e.g., "no more than 180 days outside"), convert to minimum-presence (365 minus 180 = 185).
If presence not required during accrual, return 0.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.1.4',
      label: 'PR retention rules (days/yr to keep PR)',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.4 — PR retention rules (days/year to keep PR)
Question: After PR is granted, how many days per year must the holder physically remain to retain PR status?
Edge cases:

If stated per multi-year period ("no more than 2 consecutive years absent"), convert to average days-per-year equivalent and note original framing.
If PR not available, return null.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.1',
      label: 'Citizenship provision available from this track (yes / no)',
      dataType: 'boolean',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.1 — Citizenship provision available from this track
Question: Does the pathway originating from this program lead to eligibility for citizenship, directly or via PR?
Edge cases:

Temporary/indefinite-stay-only program without citizenship eligibility = false.
Requires-switching-tracks is true only if the switch is documented in official materials.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.2',
      label: 'Total minimum years from initial visa entry to citizenship eligibility',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.2 — Total minimum years from initial visa entry to citizenship eligibility
Question: Total minimum years from date of initial entry on this program to the earliest date a holder can apply for citizenship?

Recall hints:

The total is usually given indirectly as a sum of two segments. Compose the answer when both segments are stated:

  - "Years to PR on this visa" + "Years as PR before citizenship" = total minimum years.
  - If the source gives only one segment (e.g. "must be a permanent resident for 4 years" or "4 years residence in Australia"), report that single number — it is the residence requirement at the citizenship stage and is the conventional way the threshold is published.
  - Phrases that map to the total: "minimum residence requirement", "lawfully resident for X years", "X years' residence including X as a permanent resident", "X years in Australia of which X as PR".

If the source explicitly publishes "X years from arrival to citizenship" or equivalent, use that directly.

Edge cases:

Include time spent under PR if that's part of the pathway.
Report the standard route for a principal applicant (not spouse-of-citizen accelerations, military service, or extraordinary contribution).
If citizenship is not available from this track at all, return empty.
If the source describes an indefinite-leave / PR step but is silent on the citizenship-from-PR requirement, return only the years-to-PR figure and note in source sentence that this is the PR component only.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.3',
      label: 'Dual citizenship permitted',
      dataType: 'boolean',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.3 — Dual citizenship permitted
Question: Does the country permit dual or multiple citizenship for naturalizing applicants from this program?
Edge cases:

"Permitted in practice but requires renunciation formalism not enforced" is true only if source explicitly acknowledges this.
If source silent and general rule not stated here, return null.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.4',
      label: 'Civic / language / integration test burden',
      dataType: 'categorical',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.4 — Civic, language, integration test burden for citizenship
Question: How burdensome are the civic, language, or integration tests required for citizenship from this track?
Allowed values:

"none": no test required.
"light": single test of single type (language A2/B1 OR short civics quiz).
"moderate": multiple tests or one substantial test (language B2+ and civics).
"heavy": multiple substantial tests including language above B2, civics, and integration/history.

Recall hints:

CEFR levels (A1, A2, B1, B2, C1, C2) are rarely stated by name on government pages. Use these mappings:

  - "basic English" / "everyday English" / "functional English" → A2/B1 → light if it's the only test.
  - "good knowledge of English" / "competent English" / IELTS 6 / TOEFL ~80 → B2 → moderate.
  - "advanced English" / IELTS 7+ → C1+ → heavy.
  - "Life in the UK test", "Australian citizenship test", "naturalisation test", "civics test" all count as a civics test.
  - If both a language requirement AND a civics test are required, the answer is at least "moderate".

Edge cases:

Exemptions for age/disability do not change category.
If citizenship is not available from this track, return empty.
If the source describes only "must understand basic English" with no civics test mentioned, return "light".`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no test required.' },
          {
            value: 'light',
            description: 'single test of single type (language A2/B1 OR short civics quiz).',
          },
          {
            value: 'moderate',
            description: 'multiple tests or one substantial test (language B2+ and civics).',
          },
          {
            value: 'heavy',
            description:
              'multiple substantial tests including language above B2, civics, and integration/history.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.3.1',
      label: 'Tax residency trigger (days/yr before worldwide tax applies)',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.3',
      weightWithinSubFactor: 0.36,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.3.1 — Tax residency trigger (days/year)
Question: How many days of physical presence trigger full tax residency (worldwide income taxation)?
Edge cases:

If test is non-pure-day-count (substantial presence with prior-year weighting, center of vital interests), report primary day-count threshold and describe additional test.
If taxed territorially regardless of presence, return null with notes "territorial regime — see D.3.3".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.3.2',
      label: 'Special regime available (non-dom, expat bonus, flat-rate)',
      dataType: 'categorical',
      pillar: 'D',
      subFactor: 'D.3',
      weightWithinSubFactor: 0.44,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.3.2 — Special regime available
Question: What special/preferential tax regime, if any, is available to holders of this visa?
Allowed values:

"none": no special regime.
"time_limited_bonus": fixed-term reduction/exemption (e.g., 30% expat ruling for 5 years).
"time_limited_flat_rate": fixed-term flat/lump-sum tax regime (e.g., Italy's 100k flat tax).
"non_dom": regime exempting foreign-source income, typically domicile-based.
"indefinite_preferential": preferential regime for duration of residence, no time cap.

Edge cases:

If regime is general (not tied to this visa) but accessible to holders, it qualifies; note eligibility conditions.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no special regime.' },
          {
            value: 'time_limited_bonus',
            description: 'fixed-term reduction/exemption (e.g., 30% expat ruling for 5 years).',
          },
          {
            value: 'time_limited_flat_rate',
            description: "fixed-term flat/lump-sum tax regime (e.g., Italy's 100k flat tax).",
          },
          {
            value: 'non_dom',
            description: 'regime exempting foreign-source income, typically domicile-based.',
          },
          {
            value: 'indefinite_preferential',
            description: 'preferential regime for duration of residence, no time cap.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.3.3',
      label: 'Territorial vs. worldwide taxation for residents',
      dataType: 'categorical',
      pillar: 'D',
      subFactor: 'D.3',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.3.3 — Territorial vs. worldwide taxation for residents
Question: What is the scope of taxation for tax residents?
Allowed values:

"worldwide": residents taxed on worldwide income.
"worldwide_with_remittance_basis": worldwide in principle but foreign income taxed only if remitted.
"territorial": residents taxed only on domestic-source income.
"hybrid": specific income types territorial, others worldwide.

Edge cases:

If source distinguishes by domicile (UK pre-2025 style), report rule for typical new entrant on this visa and explain.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'worldwide', description: 'residents taxed on worldwide income.' },
          {
            value: 'worldwide_with_remittance_basis',
            description: 'worldwide in principle but foreign income taxed only if remitted.',
          },
          {
            value: 'territorial',
            description: 'residents taxed only on domestic-source income.',
          },
          {
            value: 'hybrid',
            description: 'specific income types territorial, others worldwide.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.1.1',
      label: 'Material policy changes in last 5 years (count, weighted by severity)',
      dataType: 'numeric',
      pillar: 'E',
      subFactor: 'E.1',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.1.1 — Material policy changes in last 5 years
Question: Compute a severity-weighted count of material policy changes affecting this program in the last 5 years.
Material change definition: change to eligibility criteria, quota/cap, fee schedule beyond inflation, rights granted, introduction/abolition of sub-stream, or processing time SLA.
Severity weights:

Major (eligibility/pathway change, abolition/reintroduction): 3
Moderate (quota change, fee restructure): 2
Minor (inflation-only fee adjustment, form/portal update): 1

Recall hints:

The source need not be a formal changelog. Count any of these as evidence of a change:

  - "introduced in YYYY", "replaced in YYYY", "renamed to ... in YYYY", "merged with ... in YYYY"
  - "from YYYY", "since YYYY", "as of [date within last 5 years]"
  - "previously [old value], now [new value]", "increased from X to Y in YYYY"
  - "reformed", "overhauled", "tightened", "expanded", "this stream replaces the former [program]"
  - News-format sources tracking the program's history (Migration Policy Institute, OECD migration outlook chapters, IMD reports) often provide explicit change counts — use them when present.

The current date is 2026; "last 5 years" means changes dated 2021 or later.

Sum the severity-weighted points across all changes you find. Report the integer total. The sourceSentence field should quote one representative change.

Edge cases:

Do not count announced-but-not-implemented changes here (those belong to E.1.2).
Do not infer changes from tone or general policy commentary; only count explicitly dated changes.
If the source provides no dated change information, return empty.`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.1.2',
      label: 'Forward-announced pipeline changes (positive predictability signal)',
      dataType: 'boolean',
      pillar: 'E',
      subFactor: 'E.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.1.2 — Forward-announced pipeline changes
Question: Does the document announce any upcoming change with a specified future effective date?
Edge cases:

Vague forward-looking statements ("we are reviewing", "changes may be introduced") do NOT qualify. Specific effective date or date window is required.
Announcement must be in this official source; news/commentary references do not count.
Multiple changes: list all; value is true if at least one qualifies.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.1.3',
      label: 'Program age (years since introduction, capped at 20)',
      dataType: 'numeric',
      pillar: 'E',
      subFactor: 'E.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.1.3 — Program age (years since introduction, capped at 20)
Question: Years since this program was introduced in its current form. Cap at 20.
"Current form" means: first established under current name and structure. Major reforms changing program name or creating distinct legal basis reset the clock. Minor amendments do not.
Edge cases:

Compute as (current year) minus (introduction year). Cap at 20. If introduced this year, value is 0.
Predecessor programs under different names: do NOT use predecessor date.
If silent on introduction date, return null with notes "introduction date not disclosed".
Year only (no month/day) acceptable; use January 1 for calculation.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.2.1',
      label: 'Published approval rate or admission statistics',
      dataType: 'boolean',
      pillar: 'E',
      subFactor: 'E.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.2.1 — Published approval rate or admission statistics
Question: Does the document publish approval rate or admission statistics for this program?
Edge cases:

Statistics must be from the last 3 years; older statistics alone = false.
Linked statistics portal counts only if it goes to the same government authority; note in notes.
Aggregated statistics covering many programs (not this specific one) do NOT count.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.2.2',
      label: 'Published quota / cap information',
      dataType: 'categorical',
      pillar: 'E',
      subFactor: 'E.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.2.2 — Published quota / cap information
Question: How transparent is the program about quota/cap information?
Allowed values:

"no_cap": program explicitly has no numerical cap.
"published_current": cap exists and current period's number is published in this document.
"published_historical_only": cap exists, only past years' numbers published; current undisclosed.
"exists_undisclosed": cap exists, number not published.

If the document is silent on whether a cap exists, return the universal "not found in source" response ({"value": null, ...}) — DO NOT guess and DO NOT return a category value.

Edge cases:

cap_number populated only for "published_current" or "published_historical_only".
"no_cap" requires affirmative statement. Absence of mention → return null.
Sub-caps on specific streams qualify as published caps.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'no_cap',
            description: 'program explicitly has no numerical cap.',
          },
          {
            value: 'published_current',
            description: "cap exists and current period's number is published in this document.",
          },
          {
            value: 'published_historical_only',
            description: "cap exists, only past years' numbers published; current undisclosed.",
          },
          { value: 'exists_undisclosed', description: 'cap exists, number not published.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.2.3',
      label: 'Public guidance and decision criteria documentation',
      dataType: 'categorical',
      pillar: 'E',
      subFactor: 'E.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: E.2.3 — Public guidance and decision criteria documentation
Question: How thoroughly does the government publish decision criteria and applicant guidance?
Allowed values:

"comprehensive": detailed decision criteria, worked examples/scenarios, explicit evidence requirements.
"substantive": clear decision criteria and evidence requirements, no worked examples.
"basic": eligibility and required documents stated; little guidance on how decisions are made.
"minimal": high-level overview with eligibility listed but little else.
"absent": does not address decision criteria.

Edge cases:

Base rating on THIS document plus official guidance it directly links from the same authority (caseworker manual, policy guide). No third-party guides.
"Worked examples" = explicit illustrative scenarios ("Applicant A earns X and has Y — they qualify because...").
FAQ counts as substantive guidance only if it addresses decision criteria, not only procedural questions.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'comprehensive',
            description:
              'detailed decision criteria, worked examples/scenarios, explicit evidence requirements.',
          },
          {
            value: 'substantive',
            description: 'clear decision criteria and evidence requirements, no worked examples.',
          },
          {
            value: 'basic',
            description:
              'eligibility and required documents stated; little guidance on how decisions are made.',
          },
          {
            value: 'minimal',
            description: 'high-level overview with eligibility listed but little else.',
          },
          { value: 'absent', description: 'does not address decision criteria.' },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.3.1',
      label: 'Rule of law (V-Dem / World Bank WGI)',
      dataType: 'numeric',
      pillar: 'E',
      subFactor: 'E.3',
      weightWithinSubFactor: 0.5,
      extractionPromptMd: `Data Ingestion Stub: E.3.1 — Rule of law
This indicator is NOT extracted from program documents. It is ingested from external published indices at the country level.
Source
World Bank Worldwide Governance Indicators (WGI), Rule of Law estimate. Fallback: V-Dem Liberal Democracy Index, Rule of Law component.
Value
Country's most recent published score, on the source's native scale.

WGI Rule of Law: approximately -2.5 to +2.5.
V-Dem: 0 to 1.

Ingestion notes

Shared across ALL programs for a given country.
Ingestion is a Phase 2 task. No LLM prompt required.
Fetch annually when WGI publishes (typically September).
If WGI unavailable, fall back to V-Dem and record source choice in provenance.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'E.3.2',
      label: 'Government effectiveness (World Bank WGI)',
      dataType: 'numeric',
      pillar: 'E',
      subFactor: 'E.3',
      weightWithinSubFactor: 0.5,
      extractionPromptMd: `Data Ingestion Stub: E.3.2 — Government effectiveness
This indicator is NOT extracted from program documents. It is ingested from an external published index at the country level.
Source
World Bank Worldwide Governance Indicators (WGI), Government Effectiveness estimate.
Value
Country's most recent published score, WGI native scale (approximately -2.5 to +2.5).
Ingestion notes

Shared across ALL programs for a given country.
Ingestion is a Phase 2 task. No LLM prompt required.
Fetch annually when WGI publishes (typically September).`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
  ],
};
