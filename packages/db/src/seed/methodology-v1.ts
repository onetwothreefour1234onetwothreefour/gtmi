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
      'C.1': ['C.1.1', 'C.1.2', 'C.1.3'],
      'C.2': ['C.2.1', 'C.2.2', 'C.2.3'],
      'C.3': ['C.3.1', 'C.3.2'],
    },
    D: {
      'D.1': ['D.1.1', 'D.1.2'],
      'D.2': ['D.2.1', 'D.2.2', 'D.2.3'],
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
    'C.1': 0.4,
    'C.2': 0.4,
    'C.3': 0.2,
    'D.1': 0.4,
    'D.2': 0.6,
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
    'C.1.1': 0.4,
    'C.1.2': 0.3,
    'C.1.3': 0.3,
    'C.2.1': 0.5,
    'C.2.2': 0.3,
    'C.2.3': 0.2,
    'C.3.1': 0.5,
    'C.3.2': 0.5,
    'D.1.1': 0.5,
    'D.1.2': 0.5,
    'D.2.1': 0.4,
    'D.2.2': 0.4,
    'D.2.3': 0.2,
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
    'C.2.1': 'categorical',
    'C.2.2': 'min_max',
    'C.2.3': 'boolean',
    'C.3.1': 'categorical',
    'C.3.2': 'categorical',
    'D.1.1': 'boolean',
    'D.1.2': 'min_max',
    'D.2.1': 'boolean',
    'D.2.2': 'min_max',
    'D.2.3': 'boolean',
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
  version_tag: '5.0.0',
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

No-cap pattern (IMPORTANT):

If the source explicitly states there is no age cap (no upper age limit, "applicants of any age"), return the sentinel token "no_cap" as valueRaw. The scoring engine treats this as the maximum-score outcome under higher_is_better.

DO NOT return the integer 999 or any other sentinel integer. Return one of: "no_cap", "no_limit", or "none". The downstream normalizer recognises all three.

Edge cases:

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
      label: 'Employer switching',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.1 — Employer switching
Question: After the visa is granted, can the holder change employers, and how onerous is that switch? Focus on the post-grant permission, not the original sponsorship application.

Allowed values:

"open": the holder can change employers freely without any new permission, notification, or application — same visa continues unchanged.
"notification_only": the holder must inform the immigration authority (or sponsor registry) of the change, but no new application is required and no decision is made on the move.
"new_application_required": the holder must submit a new sponsorship application, change-of-employer petition, or similar process before the move can take effect.

Edge cases:

A grace period after job loss to find a new employer is documentable but does not by itself change the category.
"You may switch within the same occupation classification" without further process → "open".
"Sponsor must lodge a new nomination / Certificate of Sponsorship" → "new_application_required".
Open work permits / spouse open permits → "open".
If the visa is non-employer-tied entirely (points-based, talent visas without sponsor), → "open".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'open',
            description: 'change employers freely without any new permission or application.',
          },
          {
            value: 'notification_only',
            description: 'must inform the authority/sponsor registry; no new application required.',
          },
          {
            value: 'new_application_required',
            description:
              'must submit a new sponsorship application or change-of-employer petition.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.2',
      label: 'Self-employment and secondary income',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.2 — Self-employment and secondary income
Question: Can the visa holder engage in self-employment, freelance work, or earn secondary income (directorship fees, consulting, investments) while holding this visa?

Allowed values:

"full": no restrictions on income sources — self-employment, freelance, secondary employment, and investment income all permitted.
"restricted": permitted with conditions (employer permission required, sector limited, hours capped, or specific income types only).
"none": employment must be through a single sponsoring employer only; no self-employment or secondary income permitted.

Edge cases:

Passive investment income (dividends, rental) is generally outside these rules unless the source explicitly addresses it.
Volunteer / unpaid work is generally permitted regardless — do not factor in.
"Self-employment is not permitted on the Skilled Worker visa" + secondary employment allowed → "restricted".
Open work permit / PR-track post-grant → "full".
Single-employer-tied visas with no exception path → "none".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'full',
            description:
              'no restrictions on income sources — self-employment, freelance, secondary employment all permitted.',
          },
          {
            value: 'restricted',
            description:
              'permitted with conditions (employer permission, sector limit, income-type limit).',
          },
          {
            value: 'none',
            description:
              'single sponsoring employer only; no self-employment or secondary income permitted.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.1.3',
      label: 'Visa duration and renewability',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.1.3 — Visa duration and renewability
Question: What is the initial grant period for this visa, and is it renewable?

Allowed values:

"permanent": indefinite leave to remain or permanent-residency-equivalent status granted as the initial grant or convertible at first renewal.
"long_term_renewable": initial grant of 5 years or more, renewable on the same visa.
"short_term_renewable": initial grant under 5 years, renewable on the same visa.
"non_renewable": fixed-term visa with no renewal pathway on this visa (holder must switch tracks or leave).

Edge cases:

Use the standard / typical grant period; if there are stream-specific variations (e.g. 2-year vs 4-year vs 5-year tiers under the same visa), report the longest standard route and note the variants.
"Initial grant 4 years, renewable indefinitely subject to ongoing eligibility" → "short_term_renewable".
"Indefinite leave granted on application" or "permanent residency from day 1" → "permanent".
"Granted for 1 year only, no extension possible — must switch to PR or depart" → "non_renewable".
A visa that *leads to* PR but is itself short-term is "short_term_renewable" or "long_term_renewable" depending on the grant length, NOT "permanent".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'permanent',
            description:
              'indefinite leave or permanent-residency-equivalent at initial grant or first renewal.',
          },
          {
            value: 'long_term_renewable',
            description: 'initial grant of 5 years or more, renewable on the same visa.',
          },
          {
            value: 'short_term_renewable',
            description: 'initial grant under 5 years, renewable on the same visa.',
          },
          {
            value: 'non_renewable',
            description:
              'fixed-term visa with no renewal pathway; holder must switch tracks or leave.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.1',
      label: 'Spouse inclusion and work access',
      dataType: 'categorical',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.1 — Spouse inclusion and work access
Question: Can the principal applicant's spouse or partner be included on the same application or a linked application, and what work access do they have?

Allowed values:

"automatic_full": spouse is included on the same visa application by default (or via a linked dependant pass with no extra eligibility test) AND has unrestricted work access in the host country.
"automatic_limited_or_permit": spouse can be included (either on the same visa or via a linked dependant pass) but work access is restricted (sector limit, hours cap, requires a separate permit, or no work permitted).
"not_permitted": spouse cannot be included as a dependant on this visa; spouse must apply on a separate independent visa.

Edge cases:

This indicator covers a married opposite-sex spouse as the standard case. De facto / civil partner inclusion variations should be captured in notes but mapped to the closest category for this field.
A spouse who must apply on a separate "Dependant Pass" but is granted by default once on the principal's record → "automatic_limited_or_permit" if any work limitation; "automatic_full" if work is unrestricted.
"Spouse may apply for an independent work permit" → that's NOT spouse inclusion on this visa — map to the work-access status the spouse gets via the dependant pass, not via the independent route.
If the source is silent on spouse work access but covers inclusion, report "automatic_limited_or_permit" with notes "work access not stated — defaulted to limited".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'automatic_full',
            description: 'spouse included by default with unrestricted work access.',
          },
          {
            value: 'automatic_limited_or_permit',
            description:
              'spouse included but work access restricted, requires separate permit, or not permitted.',
          },
          {
            value: 'not_permitted',
            description: 'spouse cannot be included as a dependant on this visa.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.2',
      label: 'Dependent child age cap',
      dataType: 'numeric',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.2 — Dependent child age cap
Question: What is the maximum age for a dependent child to be included on or linked to this visa?

Recall hints:

Common patterns to look for: "child under [X]", "dependent child", "minor", "unmarried son/daughter under [X]", "locked-in age".
Australia 482 / 189: under 18 (or under 23 if dependent full-time student).
UK Skilled Worker: under 18 at first application; can stay until current visa expires.
Canada Express Entry / IRCC: under 22 at the time of application (locked-in age).
Singapore EP/S Pass DP: unmarried child under 21.
Hong Kong: under 18 (or 21 for full-time students).

No-cap pattern (IMPORTANT):

If the source explicitly states there is no age cap (e.g. "dependent child of any age permitted", "no upper age limit"), return the sentinel token "no_cap" as valueRaw. The scoring engine treats this as the maximum-score outcome under higher_is_better.

DO NOT return the integer 999 or any other sentinel integer. Return one of: "no_cap", "no_limit", or "none". The downstream normalizer recognises all three.

Edge cases:

If the cap differs for full-time students, report the higher cap and note the condition (populate student_extension_age in notes).
"Locked-in age" (age frozen at time of application) is a CAP — report the lock-in age (Canada: 22).
If children age out mid-visa, note this in notes — but report the entry-eligibility cap as the value.
If the source is silent on the age cap, return null with notes "child age cap not stated on official source".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'C.2.3',
      label: 'Extended family inclusion',
      dataType: 'boolean',
      pillar: 'C',
      subFactor: 'C.2',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: C.2.3 — Extended family inclusion
Question: Does the program offer any pathway for parents, grandparents, or other extended family members beyond spouse and dependent children to be included or sponsored?

Return value: a boolean — true if any pathway exists (dependant parent, financial-dependency parent inclusion, ascending-family sponsorship). false otherwise.

Recall hints:

"Dependent parent" provisions requiring financial dependency qualify as true.
"Parent visa" mentioned but as a separate visa (not a dependant on this visa) does NOT count — return false for this indicator.
Grandparents, siblings, adult children of the principal: these count as extended family if the source explicitly permits inclusion as dependants.

Edge cases:

If the program page is silent on extended family at all, return false with notes "not mentioned on official source".
Parent / extended-family visas that exist as separate independent visas (e.g. UK Adult Dependent Relative) → false.
"Other family members may be considered on a case-by-case basis" → true with notes capturing the discretionary nature.`,
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
Question: Does the visa holder have access to the host country's public healthcare system?

Allowed values:

"full": equivalent access to citizens with no surcharge beyond standard contributions (taxes, payroll deductions that all residents pay).
"partial": access with one or more conditions — waiting periods, surcharges, levies, reciprocal-agreement gating, contribution requirements, emergency-only coverage, or restriction to certain treatment categories.
"none": no public healthcare access on this visa; private cover is required.

Recall hints:

"Same access as citizens" / "entitled to [public health system]" / "covered by Medicare/NHS/Medicare/etc." → "full".
"Subject to Immigration Health Surcharge" / "must pay an annual health levy" / "covered if your country has a Reciprocal Health Care Agreement" → "partial".
"Not eligible for [public health system]" / "must arrange private health insurance" → "none".
"Emergency care only" → "partial".

Edge cases:

If the visa-program page is silent on healthcare access, escalate to a Tier-2 source (this indicator is on the tier-2 allowlist for that reason).
Employer-provided private insurance does not change the underlying public-system regime.
Hybrid regimes (e.g. levy + private top-up): map to "partial" and capture the structure in notes.`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'full',
            description:
              'equivalent access to citizens with no surcharge beyond standard contributions.',
          },
          {
            value: 'partial',
            description:
              'access with conditions: waiting periods, surcharges, levies, reciprocal agreement, or restricted scope.',
          },
          {
            value: 'none',
            description: 'no public healthcare access; private cover required.',
          },
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
Question: Do dependent children included on this visa have access to state-funded public education?

Allowed values:

"full": unrestricted access equivalent to citizen children — same enrolment process, same fees (or no fees), same school choice.
"partial": access with conditions or limited to certain levels (foreign-student fees apply, restricted to specific schools, case-by-case, primary-only).
"none": no access to public education; private schooling only.

Recall hints:

"Children may attend public schools on the same basis as citizens" → "full".
"International student fees apply" / "foreign-student levy" / "case-by-case approval by local authority" → "partial".
"Must enrol in private school" / "no access to state-funded education" → "none".
Right to attend ≠ right to free attendance. If tuition applies to the dependant child, → "partial".

Edge cases:

Higher-education access is separate and out of scope for this indicator — focus on K-12 (primary + secondary).
If the source is silent on dependant access specifically but the country is one where state schools are universally fee-free for residents, report "full" with notes "inferred from country-wide policy; visa-page silent".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'full',
            description: 'unrestricted access equivalent to citizen children.',
          },
          {
            value: 'partial',
            description:
              'access with conditions: foreign-student fees, restricted to specific schools, case-by-case, primary-only.',
          },
          {
            value: 'none',
            description: 'no access to public education; private schooling only.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.1.1',
      label: 'PR pathway available',
      dataType: 'boolean',
      pillar: 'D',
      subFactor: 'D.1',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.1 — PR pathway available
Question: Does this visa program offer a direct pathway to permanent residency, or does holding this visa count toward PR eligibility under a linked track?

Return value: a boolean — true if any PR pathway exists from this visa (including a documented switch to a successor PR-eligible visa). false if the visa is explicitly temporary with no PR route.

Recall hints:

"Indefinite leave to remain", "permanent residency", "indefinite stay", "永久居留" → PR pathway exists.
"This visa leads to PR after [N] years" → true.
"Holders of this visa may apply for PR" → true.
"Holders may switch to [PR-eligible visa] after [N] years" → true (documented switch counts).
"Temporary visa only — no PR pathway" / "Holders must depart at end of term" → false.
GCC monarchies (UAE, KSA, Bahrain, Kuwait, Oman, Qatar) generally have no realistic PR pathway for non-citizens — return false unless the source explicitly describes one (e.g. UAE Golden Visa has long-term residence but is itself a renewable visa, not PR).

Edge cases:

A pathway requiring switch to a different visa counts as true ONLY if the switch is explicitly documented as a standard transition; speculative pathways do not count.
"Permanent" wording in the visa name does NOT automatically mean PR — Australia's "permanent resident" is PR; Singapore's "Long-Term Visit Pass" is not.
If the source is silent on PR, return null with notes "PR pathway not addressed on this page".`,
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
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.1.2 — Minimum years of residence to PR eligibility
Question: What is the minimum number of years of qualifying residence required before the holder can apply for PR? Report the lowest threshold available from this visa track.

Recall hints:

The threshold is usually expressed as "after [N] years on this visa" or "[N] years cumulative residence required for PR".
If a combined pathway is described (e.g., "2 years on this visa + 3 years on successor visa = 5 years total to PR"), report the total.
If multiple PR streams are available (e.g. fast-track for high earners, standard track for everyone else), report the LOWEST eligibility threshold and capture the variant in notes.
If expressed in months, convert to years to one decimal place.

Conditional pattern (IMPORTANT):

If D.1.1 is false (no PR pathway exists), return the sentinel string "not_applicable" as valueRaw. The scoring engine will assign 0 to this indicator — absence of pathway is the worst outcome, not missing data.

DO NOT return null when PR is unavailable — null means "not extracted", which excludes the indicator from scoring. The "not_applicable" sentinel scores 0 and stays in the cohort.

Edge cases:

Some PR tracks have ongoing income / employment / character requirements stretched over the residence period — these do not change the minimum-years figure.
"Minimum 5 years residence" + "applications typically processed in 6 months" → report 5 (years TO eligibility, not years to grant).
"3 years physical presence in any 5-year window" → report 3.
If the source is silent on the years-to-PR figure but D.1.1 is true, return null with notes "years-to-PR not stated on this page".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.1',
      label: 'Citizenship pathway available from this track',
      dataType: 'boolean',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.1 — Citizenship pathway available
Question: Does holding this visa, or the PR status it leads to, create a pathway to citizenship eligibility?

Return value: a boolean — true if any citizenship route exists for the standard principal applicant (via PR, via direct naturalisation, or via any documented chain originating in this visa). false if citizenship is explicitly unavailable, or if the country does not permit naturalisation of foreign-born adults under any standard route.

Recall hints:

"Eligible for citizenship after [N] years of residence" / "may apply for naturalisation" → true.
"This visa leads to PR; PR holders may apply for citizenship after [N] years" → true.
GCC monarchies generally do not permit naturalisation of non-Arab non-citizens under standard routes — return false unless the source explicitly states a path.
Singapore: PR holders may apply for citizenship at the discretion of the ICA; document this as true (a discretionary route still counts as a pathway).
Switzerland, Liechtenstein, Andorra, Monaco have very long residence requirements but DO permit naturalisation — return true.

Edge cases:

Acceleration routes (spouse-of-citizen, military service, extraordinary contribution) are NOT the standard pathway — exclude them from the answer for this indicator.
Investment-citizenship programs that bypass residence (Malta, Cyprus pre-2020, Caribbean CBI) count as true if the source documents them.
"Citizenship is not available to holders of this visa" → false.
If the source is silent, return null with notes "citizenship pathway not addressed on this page".`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'D.2.2',
      label: 'Total minimum years from visa entry to citizenship eligibility',
      dataType: 'numeric',
      pillar: 'D',
      subFactor: 'D.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: D.2.2 — Total minimum years from visa entry to citizenship eligibility
Question: What is the total minimum number of years from the date of initial visa entry to the earliest possible citizenship application? Report the minimum across all available standard tracks for the principal applicant.

Counting rules:

Sum the full chain:
  1. Years on this visa accruing toward PR eligibility, PLUS
  2. Years as PR before naturalisation eligibility (if PR is on the path), PLUS
  3. Any additional residence/character/language requirement years that must elapse before the earliest citizenship application.

Recall hints:

The total is usually stated as a sum of two segments:
  - "Years to PR on this visa" (D.1.2 figure) + "Years as PR before citizenship" = total minimum years.
  - If the source publishes "X years from arrival to citizenship" / "X years' lawful residence including X as PR" / "minimum residence requirement of X years" directly, use that.
Common patterns:
  - Australia: 4 years lawful residence including 1 year as PR → 4 (the source publishes the total).
  - Canada: 3 years physical presence in 5 (must hold PR) → varies by visa-to-PR time + 3 years PR.
  - UK: 5 years lawful residence + 1 year ILR = 6 years from initial entry.
  - Switzerland: 10 years lawful residence (federal) + cantonal requirements → 10.

Conditional pattern (IMPORTANT):

If D.2.1 is false (no citizenship pathway exists), return the sentinel string "not_applicable" as valueRaw. The scoring engine will assign 0 to this indicator — absence of pathway is the worst outcome, not missing data.

DO NOT return null when citizenship is unavailable — null means "not extracted", which excludes the indicator from scoring. The "not_applicable" sentinel scores 0 and stays in the cohort.

Edge cases:

Use the standard route for a principal applicant — exclude spouse-of-citizen, military, or extraordinary contribution accelerations.
If the source describes only the years-to-PR portion and is silent on PR-to-citizenship, return null with notes "PR-to-citizenship segment not stated on this page; partial figure only".
If PR holders on this visa can apply for citizenship BEFORE the standard PR-to-citizenship interval elapses (a citizenship-track visa), report the actual minimum interval.
If multiple tracks exist (e.g. fast-track via investment + slow-track standard), report the LOWEST total and note the variant.`,
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
Question: Does the host country permit the applicant to hold dual citizenship — retaining their original nationality while naturalising?

Return value: a boolean — true if dual citizenship is permitted for naturalised citizens. false if the country requires renunciation of prior nationality as a condition of naturalisation.

Recall hints:

"Dual citizenship is permitted" / "applicants need not renounce" / "[country] permits dual or multiple citizenship" → true.
"Applicants must renounce their previous citizenship" / "single nationality required" → false.
"Permitted in practice but renunciation is a formal requirement that is not enforced" → true (with notes capturing the formality).
Common patterns:
  - Australia, Canada, UK, USA, France, Italy, Ireland, NZ, Switzerland — true.
  - Singapore, Japan (after 22), India, China, Saudi Arabia — generally false.
  - Germany — true since the 2024 reform.

Country-of-origin variation:

If the policy varies by the applicant's country of origin (some countries are exempt, treaty-based exceptions exist), return true with a note capturing the variation.

Edge cases:

If the source is silent on dual citizenship and the country is not on a well-known list, return null with notes "dual citizenship policy not addressed on this page".
"Permitted by birth but not by naturalisation" → false (this indicator covers naturalisation specifically).
If only the applicant's country-of-origin's rule on losing citizenship matters (the host accepts dual; the applicant's home country may strip them), this indicator measures the HOST country's policy → true if the host accepts dual.`,
      scoringRubricJsonb: null,
      normalizationFn: 'boolean',
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
