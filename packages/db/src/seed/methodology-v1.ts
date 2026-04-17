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
      'A.1': ['A.1.1', 'A.1.2', 'A.1.3'],
      'A.2': ['A.2.1', 'A.2.2', 'A.2.3'],
      'A.3': ['A.3.1', 'A.3.2', 'A.3.3'],
    },
    B: {
      'B.1': ['B.1.1', 'B.1.2', 'B.1.3'],
      'B.2': ['B.2.1', 'B.2.2', 'B.2.3', 'B.2.4'],
      'B.3': ['B.3.1', 'B.3.2', 'B.3.3'],
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
    'A.1': 0.4,
    'A.2': 0.35,
    'A.3': 0.25,
    'B.1': 0.4,
    'B.2': 0.35,
    'B.3': 0.25,
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
    'A.1.1': 0.5,
    'A.1.2': 0.3,
    'A.1.3': 0.2,
    'A.2.1': 0.35,
    'A.2.2': 0.35,
    'A.2.3': 0.3,
    'A.3.1': 0.4,
    'A.3.2': 0.35,
    'A.3.3': 0.25,
    'B.1.1': 0.5,
    'B.1.2': 0.3,
    'B.1.3': 0.2,
    'B.2.1': 0.4,
    'B.2.2': 0.25,
    'B.2.3': 0.2,
    'B.2.4': 0.15,
    'B.3.1': 0.4,
    'B.3.2': 0.35,
    'B.3.3': 0.25,
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
    'A.1.1': 'z_score',
    'A.1.2': 'min_max',
    'A.1.3': 'categorical',
    'A.2.1': 'categorical',
    'A.2.2': 'min_max',
    'A.2.3': 'categorical',
    'A.3.1': 'categorical',
    'A.3.2': 'categorical',
    'A.3.3': 'min_max',
    'B.1.1': 'min_max',
    'B.1.2': 'categorical',
    'B.1.3': 'min_max',
    'B.2.1': 'z_score',
    'B.2.2': 'z_score',
    'B.2.3': 'z_score',
    'B.2.4': 'z_score',
    'B.3.1': 'categorical',
    'B.3.2': 'min_max',
    'B.3.3': 'categorical',
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
  version_tag: '1.0.0',
  indicators: [
    {
      key: 'A.1.1',
      label: 'Minimum salary threshold (USD-equivalent)',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.1 — Minimum salary threshold
Question: What is the minimum annual salary, in the local currency as stated in the source, that a principal applicant must earn to qualify for this program?
Output format:
{
"value": <number, annual salary in local currency>,
"currency": "<ISO 4217 code>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If the program has multiple salary tiers, report the standard/core threshold and describe alternatives in notes.
Report raw local-currency figure; USD normalization happens downstream.
If the threshold is expressed only as a multiple of median wage, return value: null and notes: "expressed as multiple of median — see A.1.2".`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.2',
      label: 'Salary threshold as % of local median wage',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.2 — Salary threshold as % of local median wage
Question: Is the salary threshold for this program defined or benchmarked as a percentage of the local median wage or equivalent statistical reference?
Output format:
{
"value": <number, percent>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If the threshold is a fixed amount (not a percentage), return null.
If the source gives both (e.g., "the greater of X or Y% of median"), report the percentage.
If expressed as a multiple (e.g., "1.5x median"), convert to a percentage (150).`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.1.3',
      label: 'Alternative qualification pathways (points, capital, patent)',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.1.3 — Alternative qualification pathways
Question: Besides salary, how many alternative qualifying routes does this program offer?
Allowed values:

"salary_only": only qualifying route is the salary threshold.
"salary_plus_one": salary plus one alternative (points, investment, patent).
"salary_plus_multiple": salary plus two or more alternatives.
"no_salary_route": qualification does not require a salary threshold at all.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

A "fast-track" for high salaries is NOT an alternative pathway; it's a salary-based variant.
Alternative must be a genuinely different criterion (points, investment, patent, extraordinary ability, endorsement).`,
      scoringRubricJsonb: {
        categories: [
          { value: 'salary_only', description: 'only qualifying route is the salary threshold.' },
          {
            value: 'salary_plus_one',
            description: 'salary plus one alternative (points, investment, patent).',
          },
          {
            value: 'salary_plus_multiple',
            description: 'salary plus two or more alternatives.',
          },
          {
            value: 'no_salary_route',
            description: 'qualification does not require a salary threshold at all.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.2.1',
      label: 'Minimum educational requirement',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.35,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.1 — Minimum educational requirement
Question: What is the minimum formal educational qualification a principal applicant must hold?
Allowed values:

"none": no minimum education stated.
"secondary": high school or equivalent.
"vocational": post-secondary vocational or associate-level qualification.
"bachelor": bachelor's degree or equivalent.
"master": master's degree or equivalent.
"doctorate": doctoral degree or equivalent.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If "equivalent work experience in lieu of degree" is accepted, report the formal floor (what is required if one cannot substitute) and note the substitution option.`,
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
      key: 'A.2.2',
      label: 'Minimum work experience (years)',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.35,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.2 — Minimum work experience (years)
Question: What is the minimum years of relevant professional work experience required of a principal applicant?
Output format:
{
"value": <number, years>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If experience is required only in the absence of a degree, report the experience floor that applies when the degree IS held (often 0).
If there is no experience requirement, return 0.
If experience varies by occupation, report the standard/core requirement and describe variation in notes.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.2.3',
      label: 'Language proficiency requirement (level + acceptance list)',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.2',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.2.3 — Language proficiency requirement
Question: What is the language proficiency level required of a principal applicant?
Allowed values:

"none": no language requirement.
"basic": A1-A2 CEFR or equivalent (IELTS 4.0-4.5).
"intermediate": B1 CEFR or equivalent (IELTS 5.0-5.5).
"upper_intermediate": B2 CEFR or equivalent (IELTS 6.0-6.5).
"advanced": C1+ CEFR or equivalent (IELTS 7.0+).

Output format:
{
"value": <string from allowed values>,
"accepted_tests": ["<list of accepted test providers>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If components have different minima, report the highest required.
Note degree-taught-in-local-language exemptions.
Report the strictest standard scenario.`,
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
      key: 'A.3.1',
      label: 'Occupation list constraint (open / restricted list / shortage list)',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.3',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.3.1 — Occupation list constraint
Question: How restrictive is the occupation list governing this program?
Allowed values:

"open": any occupation accepted.
"broad_list": broad published list covering most skilled occupations (hundreds).
"restricted_list": narrower list (under 100 occupations), targeted at specific sectors.
"shortage_list_only": only occupations on a periodically updated shortage/critical list.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If the program has multiple streams with different constraints, report for the stream targeted by this extraction and note others.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'open', description: 'any occupation accepted.' },
          {
            value: 'broad_list',
            description: 'broad published list covering most skilled occupations (hundreds).',
          },
          {
            value: 'restricted_list',
            description: 'narrower list (under 100 occupations), targeted at specific sectors.',
          },
          {
            value: 'shortage_list_only',
            description: 'only occupations on a periodically updated shortage/critical list.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'A.3.2',
      label: 'Annual quota presence and size',
      dataType: 'categorical',
      pillar: 'A',
      subFactor: 'A.3',
      weightWithinSubFactor: 0.35,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.3.2 — Annual quota presence and size
Question: Does this program have an annual numerical cap, and how restrictive is it?
Allowed values:

"no_quota": no annual cap on this program.
"large_quota": cap exists but substantially larger than historical demand (rarely exhausted).
"moderate_quota": cap sometimes exhausted but generally adequate.
"tight_quota": cap regularly exhausted or demand exceeds supply.
"quota_undisclosed": cap exists but size is not published in this source.

Output format:
{
"value": <string from allowed values>,
"cap_number": <integer or null>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If document does not characterize demand-vs-supply, default to "moderate_quota" when a number is published without context.
Record the raw cap number in notes or in cap_number where published.`,
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
      key: 'A.3.3',
      label: 'Applicant age cap',
      dataType: 'numeric',
      pillar: 'A',
      subFactor: 'A.3',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: A.3.3 — Applicant age cap
Question: What is the maximum age at which a principal applicant can qualify for this program?
Output format:
{
"value": <number, years>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If no age cap exists, return 999 and note "no age cap".
If points decline after a certain age, return the age at which points reach zero (effective cap) and describe the curve.
Return null only if age is not addressed at all.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.1.1',
      label: 'Published SLA processing time (days)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.1',
      weightWithinSubFactor: 0.5,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.1.1 — Published SLA processing time (days)
Question: What is the official published service level agreement for processing a complete application on this program, in calendar days from submission to decision?
Output format:
{
"value": <number, calendar days>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If SLA is expressed as a range or percentile ("90% within 30 days"), report the median/point estimate and describe the original framing.
If expressed in business days, convert to calendar days (multiply by 7/5, round up) and note the conversion.
If no published SLA, return null with notes "no published SLA".`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.1.2',
      label: 'Fast-track option availability and SLA',
      dataType: 'categorical',
      pillar: 'B',
      subFactor: 'B.1',
      weightWithinSubFactor: 0.3,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.1.2 — Fast-track option availability and SLA
Question: Does this program offer a fast-track option, and if so how fast?
Allowed values:

"none": no fast-track available.
"available_slow": fast-track available, SLA 15-30 days.
"available_fast": fast-track available, SLA under 15 days.
"available_undisclosed_sla": fast-track exists but SLA not published.

Output format:
{
"value": <string from allowed values>,
"fast_track_fee": <number or null>,
"currency": "<ISO code or null>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Fast-track must be a formal option with a stated accelerated SLA, not merely "priority handling".
If employer-initiated only, note that.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'none', description: 'no fast-track available.' },
          { value: 'available_slow', description: 'fast-track available, SLA 15-30 days.' },
          { value: 'available_fast', description: 'fast-track available, SLA under 15 days.' },
          {
            value: 'available_undisclosed_sla',
            description: 'fast-track exists but SLA not published.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.1.3',
      label: 'Number of application steps',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.1',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.1.3 — Number of application steps
Question: How many discrete formal steps must an applicant complete to obtain the visa?
Output format:
{
"value": <integer>,
"steps": ["<list of named steps>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Count distinct procedural milestones from applicant's perspective (sponsorship request, skills assessment, visa application, biometrics, health check, decision).
Do not count sub-forms within a single step.
Include pre-arrival steps and required post-arrival activations.
Do not count optional steps.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.1',
      label: 'Principal applicant fees (USD)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.1 — Principal applicant fees
Question: What is the total government fee a principal applicant must pay to the issuing authority for a standard application?
Output format:
{
"value": <number, local currency>,
"currency": "<ISO 4217 code>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Include application fee, issuance fee, and mandatory levies to the issuing authority.
Exclude employer-borne levies (see B.2.3) and non-government costs (see B.2.4).
If fees vary by stream or duration, report the standard 2-4 year visa case and note variations.`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.2',
      label: 'Per-dependant fees (USD)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.2 — Per-dependant fees
Question: What is the government fee per accompanying dependant paid to the issuing authority?
Output format:
{
"value": <number, local currency per dependant>,
"currency": "<ISO 4217 code>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

If spouse and child fees differ, report the higher (common adult dependant case) and note the other.
If dependants not permitted, return null with notes "no dependants permitted".`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.3',
      label: 'Employer-borne levies and skill charges (USD)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.2,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.3 — Employer-borne levies and skill charges
Question: What government levies or charges are paid by the sponsoring employer for this program?
Output format:
{
"value": <number, local currency>,
"currency": "<ISO 4217 code>",
"basis": "<annual per visa | one-off | other>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Include skills levies, training charges, immigration skills charges, similar employer-only government fees.
If per-year, report annual cost. If one-off, report total.
If no employer sponsorship requirement, return 0.`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.2.4',
      label: 'Mandatory non-government costs (agents, translation, medicals)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.2',
      weightWithinSubFactor: 0.15,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.2.4 — Mandatory non-government costs
Question: What is the approximate total cost of mandatory non-government requirements (medical exam, translation, health insurance during application) for a standard principal applicant?
Output format:
{
"value": <number, USD-equivalent estimate>,
"components": ["<list of cost components>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Exclude optional agent/lawyer fees.
Include only program-required expenses.
If source does not quantify (common), report a conservative standard-case estimate and describe the basis; flag confidence below 0.5 if estimated.`,
      scoringRubricJsonb: null,
      normalizationFn: 'z_score',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.3.1',
      label: 'Online application availability',
      dataType: 'categorical',
      pillar: 'B',
      subFactor: 'B.3',
      weightWithinSubFactor: 0.4,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.3.1 — Online application availability
Question: How digital-native is the application process?
Allowed values:

"fully_online": application, document upload, payment, and status tracking all online.
"mostly_online": application and payment online, but one step requires in-person or paper.
"hybrid": online initiation but substantial in-person or paper steps remain.
"offline_only": primarily paper-based or requires in-person submission.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Biometrics appointments do not count against "fully_online" (inherently in-person).
Paper-only requirements for specific document types (e.g., couriered sworn translations) reduce to "mostly_online".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'fully_online',
            description: 'application, document upload, payment, and status tracking all online.',
          },
          {
            value: 'mostly_online',
            description:
              'application and payment online, but one step requires in-person or paper.',
          },
          {
            value: 'hybrid',
            description: 'online initiation but substantial in-person or paper steps remain.',
          },
          {
            value: 'offline_only',
            description: 'primarily paper-based or requires in-person submission.',
          },
        ],
      },
      normalizationFn: 'categorical',
      direction: 'higher_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.3.2',
      label: 'In-person / biometric requirement (count of visits)',
      dataType: 'numeric',
      pillar: 'B',
      subFactor: 'B.3',
      weightWithinSubFactor: 0.35,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.3.2 — In-person / biometric visits required
Question: How many in-person visits (consulate, visa application center, government office) are required during application?
Output format:
{
"value": <integer>,
"visit_types": ["<list of required visit types>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Single biometrics = 1.
Pre-submission document verification visits count.
Visa collection counts only if it requires in-person visit (not if emailed/couriered).
Post-arrival registration required to activate the visa counts.`,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'lower_is_better',
      sourceTierRequired: 1,
    },
    {
      key: 'B.3.3',
      label: 'Appeal and refusal process clarity',
      dataType: 'categorical',
      pillar: 'B',
      subFactor: 'B.3',
      weightWithinSubFactor: 0.25,
      extractionPromptMd:
        SHARED_PREAMBLE +
        '\n\n' +
        `Extraction Task: B.3.3 — Appeal and refusal process clarity
Question: How clearly does this program document its appeal and refusal process?
Allowed values:

"comprehensive": appeal rights, grounds, deadlines, procedures clearly documented; refusal reasons provided in writing.
"substantive": appeal rights and procedures documented; refusal reasons provided but less detailed.
"basic": appeal exists but procedure/deadlines unclear in this source.
"limited": appeal is discretionary, narrow, or not clearly available.
"absent": no appeal right or not addressed.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Administrative review for specific categories (e.g., in-country refusals) should be noted.
Judicial review alone, without administrative appeal, is "limited".`,
      scoringRubricJsonb: {
        categories: [
          {
            value: 'comprehensive',
            description:
              'appeal rights, grounds, deadlines, procedures clearly documented; refusal reasons provided in writing.',
          },
          {
            value: 'substantive',
            description:
              'appeal rights and procedures documented; refusal reasons provided but less detailed.',
          },
          {
            value: 'basic',
            description: 'appeal exists but procedure/deadlines unclear in this source.',
          },
          {
            value: 'limited',
            description: 'appeal is discretionary, narrow, or not clearly available.',
          },
          { value: 'absent', description: 'no appeal right or not addressed.' },
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

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

Output format:
{
"value": <string from allowed values>,
"grace_period_days": <integer or null>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <boolean>,
"exemptions": ["<list of exemption cases if any>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

"automatic_with_full_work_rights": included and has unrestricted work rights.
"automatic_with_limited_work_rights": included but work rights limited (sector, hours, separate permit).
"automatic_no_work_rights": included but cannot work.
"by_permit_with_work_rights": applies separately; if approved, can work.
"by_permit_no_work_rights": applies separately; if approved, cannot work.
"not_permitted": spouse cannot accompany.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

This indicator reflects a married opposite-sex spouse. Same-sex partner recognition is C.2.4; unmarried partner variations go in notes.`,
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
Output format:
{
"value": <number, years>,
"student_extension_age": <number or null>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <boolean>,
"eligible_relatives": ["<list if true>"],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <boolean>,
"recognition_basis": "<marriage | de_facto | civil_partnership | foreign_marriage | null>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

"full_access": same basis as citizens/PRs.
"levy_required": access upon payment of a health levy/contribution.
"insurance_required": access contingent on private insurance.
"emergency_only": only emergency care covered publicly.
"no_access": no public healthcare access.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Hybrid regimes (e.g., levy + private top-up): map to the primary requirement, note secondary.
Employer-provided insurance does not change the underlying regime.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'full_access', description: 'same basis as citizens/PRs.' },
          {
            value: 'levy_required',
            description: 'access upon payment of a health levy/contribution.',
          },
          {
            value: 'insurance_required',
            description: 'access contingent on private insurance.',
          },
          { value: 'emergency_only', description: 'only emergency care covered publicly.' },
          { value: 'no_access', description: 'no public healthcare access.' },
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

"full_access": same basis as citizens/PRs.
"fee_based": access granted but foreign-student or fee-paying levy applies.
"limited": access in specific circumstances only (age bands, regions).
"no_access": no access to public education.

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Right to attend does not mean right to free attendance: if tuition applies, "fee_based" not "full_access".
Higher-education access is separate and not required here.`,
      scoringRubricJsonb: {
        categories: [
          { value: 'full_access', description: 'same basis as citizens/PRs.' },
          {
            value: 'fee_based',
            description: 'access granted but foreign-student or fee-paying levy applies.',
          },
          {
            value: 'limited',
            description: 'access in specific circumstances only (age bands, regions).',
          },
          { value: 'no_access', description: 'no access to public education.' },
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
Output format:
{
"value": <boolean>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <number, years>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <number, days per year>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <number, days per year>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <boolean>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <number, years>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Include time spent under PR if that's part of the pathway.
Report the standard route for a principal applicant (not spouse-of-citizen accelerations).
If citizenship not available, return null.`,
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
Output format:
{
"value": <boolean>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Exemptions for age/disability do not change category.
If citizenship not available, return null.`,
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
Output format:
{
"value": <number, days per year>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

Output format:
{
"value": <string from allowed values>,
"regime_name": "<official name if stated>",
"duration_years": <integer or null>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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

Output format:
{
"value": <string from allowed values>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Question: Count the number of material policy changes in the last 5 years, weighted by severity.
Material change definition: change to eligibility criteria, quota/cap, fee schedule beyond inflation, rights granted, introduction/abolition of sub-stream, or processing time SLA.
Severity weights:

Major (eligibility/pathway change, abolition/reintroduction): 3
Moderate (quota change, fee restructure): 2
Minor (inflation-only fee adjustment, form/portal update): 1

Output format:
{
"value": <number, weighted sum>,
"changes": [
{"date": "YYYY-MM-DD", "description": "<short>", "severity": "major|moderate|minor"}
],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

Only count changes evidenced in THIS document (changelog, "what's new", dated announcements).
Do not count announced-but-not-implemented here (those go to E.1.2).
If no change history disclosed, return null with notes "change history not disclosed in source".`,
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
Output format:
{
"value": <boolean>,
"announced_changes": [
{"effective_date": "YYYY-MM-DD or window", "description": "<short>"}
],
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <integer, 0-20>,
"introduced_date": "YYYY or YYYY-MM or YYYY-MM-DD",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
Output format:
{
"value": <boolean>,
"statistics_present": ["approval_rate | applications_received | visas_granted"],
"most_recent_period": "YYYY or YYYY-QN",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
"not_addressed": document silent on whether a cap exists.

Output format:
{
"value": <string from allowed values>,
"cap_number": <integer or null>,
"cap_period": "<e.g., annual, per fiscal year, one-off>",
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
Edge cases:

cap_number populated only for "published_current" or "published_historical_only".
"no_cap" requires affirmative statement. Absence of mention = "not_addressed".
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
          {
            value: 'not_addressed',
            description: 'document silent on whether a cap exists.',
          },
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

Output format:
{
"value": <string from allowed values>,
"has_evidence_requirements": <boolean>,
"has_worked_examples": <boolean>,
"has_decision_criteria": <boolean>,
"source_sentence": "...",
"confidence": <0.0-1.0>,
"notes": "<optional>"
}
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
      sourceTierRequired: 3,
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
      sourceTierRequired: 3,
    },
  ],
};
