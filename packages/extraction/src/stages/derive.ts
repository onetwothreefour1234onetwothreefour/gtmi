// Phase 3.6 / Fix D / ADR-016 — Stage 6.5: Derive.
//
// Pure deterministic computation of two PAQ indicators that cannot be
// sourced as a literal sentence on any government page:
//
//   A.1.2 — Salary threshold as % of local median wage
//   D.2.2 — Total minimum years from initial visa entry to citizenship eligibility
//
// THIS FILE CONTAINS ZERO LLM CALLS. Same inputs → same output, byte-
// identical across runs. extractionModel is hard-coded to the literal
// string 'derived-computation'. extractionConfidence and
// validationConfidence are hard-coded to 0.6 so derived rows ALWAYS
// route to /review (auto-approve threshold is 0.85). Skip conditions
// log a one-line message and return null — no row is written, no
// error is thrown.

import { createHash } from 'crypto';
import type { ExtractionOutput } from '../types/extraction';
import type { CrossCheckOutcome, ProvenanceRecord } from '../types/provenance';

/** Hard-coded per ADR-016. Forces /review for every derived row. */
export const DERIVE_CONFIDENCE = 0.6;
/** Hard-coded per ADR-016. */
export const DERIVE_EXTRACTION_MODEL = 'derived-computation';

/**
 * Phase 3.6.1 / FIX 6 — D.2.3 dual-citizenship derive constants.
 * The derived row carries a slightly higher confidence than the
 * derived-computation rows because the underlying source is a published
 * citizenship act rather than a calculation.
 */
export const DERIVE_KNOWLEDGE_CONFIDENCE = 0.7;
export const DERIVE_KNOWLEDGE_MODEL = 'derived-knowledge';

// ────────────────────────────────────────────────────────────────────
// Input shapes (all values resolved by the orchestrator from the
// extraction map / DB / static lookup tables before calling the pure
// derive functions).
// ────────────────────────────────────────────────────────────────────

export interface MedianWageEntry {
  iso3: string;
  usdYear: number;
  medianWageUsd: number;
  source: 'OECD' | 'ILO';
  sourceUrl: string;
}

export interface FxRateEntry {
  code: string;
  year: number;
  lcuPerUsd: number;
  sourceUrl: string;
}

export interface CitizenshipResidenceEntry {
  iso3: string;
  yearsAsPr: number | null;
  sourceUrl: string;
  notes?: string;
}

export interface DerivedA12Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  /** A.1.1 raw value from field_values (e.g. "AUD 73,150" or "73150"). null if A.1.1 is not POPULATED. */
  a11ValueRaw: string | null;
  /** A.1.1 ISO 4217 currency from provenance.valueCurrency. null if absent. */
  a11ValueCurrency: string | null;
  /** A.1.1 source URL from provenance (recorded in derivedInputs for /review audit). */
  a11SourceUrl: string | null;
  /**
   * Phase 3.6.5 — A.1.1 source sentence from provenance. Used to
   * disambiguate monthly vs annual salary thresholds (immigration
   * pages routinely state monthly figures, e.g. SGP S Pass S$3,300/mo,
   * while COUNTRY_MEDIAN_WAGE is annual). Optional for backwards
   * compatibility; missing → ambiguous → annualised (safe default).
   */
  a11SourceSentence?: string | null;
  /**
   * Phase 3.6.6 / FIX 1 — A.1.3 raw value from field_values. When the
   * programme is points-based ("no_salary_route" / "points_only" /
   * "not_required") OR A.1.1 was extracted as "0", deriveA12 emits a
   * `not_applicable` derived-knowledge row instead of attempting the
   * percentage calculation. Country-agnostic — applies to CAN Express
   * Entry FSW, NZL SMC, AUT RWR Card, AUS 189 Points Tested, and any
   * future points-based programme. Optional for backwards compatibility.
   */
  a13ValueRaw?: string | null;
  /** Median-wage table entry for this country, null if missing. */
  medianWage: MedianWageEntry | null;
  /** FX rate for the A.1.1 currency, null if missing or currency null. */
  fxRate: FxRateEntry | null;
}

export interface DerivedD22Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  /** D.1.1 — PR provision available. null = D.1.1 not POPULATED. */
  d11Boolean: boolean | null;
  /** D.1.2 — Years to PR. null = D.1.2 not POPULATED. */
  d12Years: number | null;
  /** D.1.2 source URL from provenance. */
  d12SourceUrl: string | null;
  /** Citizenship-residence table entry, null if missing. */
  citizenshipResidence: CitizenshipResidenceEntry | null;
}

/** Phase 3.6.1 / FIX 6 — D.2.3 input shape. */
export interface DualCitizenshipPolicyEntry {
  iso3: string;
  permitted: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD23Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  /** Citizenship-policy table entry, null if no entry for the country. */
  policy: DualCitizenshipPolicyEntry | null;
}

/** Phase 3.6.2 / ITEM 2 — B.2.4 derive input. */
export interface NonGovCostsPolicyEntry {
  iso3: string;
  hasMandatoryNonGovCosts: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedB24Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: NonGovCostsPolicyEntry | null;
}

/** Phase 3.6.2 / ITEM 2 — D.1.3 / D.1.4 derive inputs. */
export interface PrPresenceFieldEntry {
  required: boolean | null;
  daysPerYear: number | null;
  notes: string;
}

export interface PrPresencePolicyEntry {
  iso3: string;
  d13: PrPresenceFieldEntry;
  d14: PrPresenceFieldEntry;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD13Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: PrPresencePolicyEntry | null;
}

export interface DerivedD14Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: PrPresencePolicyEntry | null;
}

export interface DerivedRow {
  /** Pre-built ExtractionOutput suitable for humanReview.enqueue. */
  extraction: ExtractionOutput;
  /** Pre-built ProvenanceRecord (passes checkProvenanceRow). */
  provenance: ProvenanceRecord;
  /**
   * Convenience: the numeric output for arithmetic derives (A.1.2 / D.2.2)
   * or 0 for non-numeric derives (D.2.3 — categorical 'permitted'/'not_permitted').
   */
  numericValue: number;
}

// ────────────────────────────────────────────────────────────────────
// Pure functions: zero side effects, return null on any skip condition.
// ────────────────────────────────────────────────────────────────────

/** Strip non-numeric chars (currency codes, commas, whitespace) and parse. */
function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Phase 3.6.5 — detect whether an A.1.1 salary value is monthly or annual
 * by scanning the provenance source sentence for cue words. Country-
 * agnostic.
 *
 * Returns 'monthly' / 'annual' / 'ambiguous'. Ambiguous resolves to
 * monthly upstream (the safe default — most immigration salary
 * thresholds are stated monthly; an annualised value 12× too small is
 * obvious at /review, while a monthly value 12× too large is plausible
 * for high-end visas and harder to catch).
 */
export function detectSalaryUnit(
  sourceSentence: string | null | undefined
): 'monthly' | 'annual' | 'ambiguous' {
  if (!sourceSentence) return 'ambiguous';
  const lower = sourceSentence.toLowerCase();
  // Test annual cues first — "year"/"annual" tokens appear in some
  // monthly-context strings ("…per month, equivalent to 39600 per year"),
  // but in those cases the EXTRACTED valueRaw is the monthly figure and
  // the annualised reference is parenthetical. We bias to monthly when
  // BOTH cues appear to avoid double-counting.
  const monthlyCue = /\bmonth\b|\bmonthly\b|per\s*month|\/\s*month|\bp\.?\s*m\.?\b/i.test(lower);
  const annualCue =
    /\byear\b|\bannual\b|\bannually\b|\bper\s*annum\b|\bp\.?\s*a\.?\b|\/\s*year|\byr\b/i.test(
      lower
    );
  if (monthlyCue) return 'monthly';
  if (annualCue) return 'annual';
  return 'ambiguous';
}

function buildBaseProvenance(args: {
  fieldKey: 'A.1.2' | 'D.2.2';
  contentHashSeed: string;
  sourceSentence: string;
  methodologyVersion: string;
  derivedInputs: Record<string, unknown>;
}): ProvenanceRecord {
  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: `derived-computation:${args.fieldKey}`,
    geographicLevel: 'global',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256').update(args.contentHashSeed, 'utf8').digest('hex'),
    sourceSentence: args.sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractionConfidence: DERIVE_CONFIDENCE,
    validationModel: DERIVE_EXTRACTION_MODEL,
    validationConfidence: DERIVE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: args.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs: args.derivedInputs,
  };
  return provenance;
}

/**
 * Phase 3.6.6 / FIX 1 — A.1.3 categorical values that signal a
 * points-based or salary-free pathway. Country-agnostic.
 */
const POINTS_BASED_A13_VALUES: ReadonlySet<string> = new Set([
  'no_salary_route',
  'points_only',
  'not_required',
]);

/**
 * Phase 3.6.6 / FIX 1 — emit A.1.2 as a `not_applicable` derived-
 * knowledge row. Used when the programme has no minimum salary
 * threshold (points-based selection or zero-floor pathways).
 */
function buildA12NotApplicableRow(input: DerivedA12Input): DerivedRow {
  const sourceSentence =
    'This programme uses a points-based selection system with no minimum salary threshold requirement.';
  const valueRaw = 'not_applicable';

  const derivedInputs = {
    'A.1.1': {
      valueRaw: input.a11ValueRaw,
      valueCurrency: input.a11ValueCurrency,
      sourceUrl: input.a11SourceUrl,
    },
    'A.1.3': {
      valueRaw: input.a13ValueRaw ?? null,
    },
    rule: 'points_based_no_salary_threshold',
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: 'derived:points-based-program-type',
    geographicLevel: 'global',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:A.1.2:not_applicable:${input.programId}:${input.countryIso}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: 0.9,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: 0.9,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: input.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'A.1.2',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: 0.9,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: 0 };
}

/**
 * Compute A.1.2 (salary as % of local median wage). Pure. Returns null
 * on any skip condition. Skips emit a one-line console.log.
 */
export function deriveA12(input: DerivedA12Input): DerivedRow | null {
  // Phase 3.6.6 / FIX 1 — points-based / salary-free programmes get a
  // derived-knowledge `not_applicable` row instead of skipping. Triggers:
  //   - A.1.1 valueRaw === "0" (no salary threshold, e.g. CAN Express
  //     Entry FSW where the LLM correctly returns 0 + "no salary route"),
  //   - A.1.3 in {"no_salary_route", "points_only", "not_required"}.
  // Country-agnostic. Runs BEFORE the currency/median-wage gates so
  // points-based programmes never get classified ABSENT for A.1.2.
  const a11IsZero = input.a11ValueRaw !== null && input.a11ValueRaw.trim() === '0';
  const a13Trimmed = (input.a13ValueRaw ?? '').trim().toLowerCase();
  const a13IsPointsBased = POINTS_BASED_A13_VALUES.has(a13Trimmed);
  if (a11IsZero || a13IsPointsBased) {
    console.log(
      `  [A.1.2] derived not_applicable — points-based programme for ${input.countryIso} (a11Zero=${a11IsZero}, a13="${a13Trimmed}")`
    );
    return buildA12NotApplicableRow(input);
  }

  if (input.a11ValueRaw === null || input.a11ValueRaw === '') {
    console.log(`  [A.1.2] derived skip — A.1.1 not POPULATED for ${input.countryIso}`);
    return null;
  }
  if (input.a11ValueCurrency === null || input.a11ValueCurrency === '') {
    console.log(`  [A.1.2] derived skip — A.1.1 has no valueCurrency for ${input.countryIso}`);
    return null;
  }
  if (input.medianWage === null) {
    console.log(`  [A.1.2] derived skip — no COUNTRY_MEDIAN_WAGE entry for ${input.countryIso}`);
    return null;
  }
  if (input.fxRate === null) {
    console.log(
      `  [A.1.2] derived skip — no FX_RATES entry for currency ${input.a11ValueCurrency}`
    );
    return null;
  }

  const a11Numeric = parseNumeric(input.a11ValueRaw);
  if (a11Numeric === null || a11Numeric <= 0) {
    console.log(
      `  [A.1.2] derived skip — A.1.1 valueRaw "${input.a11ValueRaw}" did not parse to a positive number`
    );
    return null;
  }

  // Phase 3.6.5 — monthly vs annual detection. COUNTRY_MEDIAN_WAGE is
  // annual; if A.1.1 was extracted as a monthly figure (typical for
  // immigration salary thresholds), multiply by 12 before the percent
  // calculation. Ambiguous → monthly (safe default — see detectSalaryUnit
  // doc comment).
  const detectedUnit = detectSalaryUnit(input.a11SourceSentence ?? null);
  const annualisationFactor = detectedUnit === 'annual' ? 1 : 12;
  const a11Annualised = a11Numeric * annualisationFactor;
  if (detectedUnit === 'annual') {
    console.log(`  [A.1.2 derive] A.1.1 unit: annual → used as-is ${a11Annualised}`);
  } else if (detectedUnit === 'monthly') {
    console.log(`  [A.1.2 derive] A.1.1 unit: monthly → annualised to ${a11Annualised} (×12)`);
  } else {
    console.log(
      `  [A.1.2 derive] A.1.1 unit: ambiguous → annualised to ${a11Annualised} (×12, safe default)`
    );
  }

  const amountUsd =
    input.a11ValueCurrency.toUpperCase() === 'USD'
      ? a11Annualised
      : a11Annualised / input.fxRate.lcuPerUsd;

  const percent = Math.round((amountUsd / input.medianWage.medianWageUsd) * 1000) / 10;

  const unitLabel =
    detectedUnit === 'annual'
      ? 'annual'
      : detectedUnit === 'monthly'
        ? 'monthly × 12'
        : 'ambiguous → assumed monthly × 12';
  const sourceSentence =
    `Derived from A.1.1 (${input.a11ValueCurrency} ${a11Numeric.toLocaleString('en-US')} [${unitLabel}] = ${a11Annualised.toLocaleString('en-US')} annual) ` +
    `÷ ${input.countryIso} median wage USD ${input.medianWage.medianWageUsd.toLocaleString('en-US')} ` +
    `(${input.medianWage.source} ${input.medianWage.usdYear}) × 100 = ${percent}%`;

  const derivedInputs = {
    'A.1.1': {
      valueRaw: input.a11ValueRaw,
      valueCurrency: input.a11ValueCurrency,
      sourceUrl: input.a11SourceUrl,
      detectedUnit,
      annualisationFactor,
    },
    medianWage: {
      value: input.medianWage.medianWageUsd,
      year: input.medianWage.usdYear,
      source: input.medianWage.source,
      sourceUrl: input.medianWage.sourceUrl,
    },
    fxRate: {
      code: input.fxRate.code,
      year: input.fxRate.year,
      lcuPerUsd: input.fxRate.lcuPerUsd,
      sourceUrl: input.fxRate.sourceUrl,
    },
  };

  const valueRaw = String(percent);
  const provenance = buildBaseProvenance({
    fieldKey: 'A.1.2',
    contentHashSeed: `derived-computation:A.1.2:${input.programId}:${input.a11ValueRaw}:${input.a11ValueCurrency}:${input.medianWage.medianWageUsd}:${input.fxRate.lcuPerUsd}`,
    sourceSentence,
    methodologyVersion: input.methodologyVersion,
    derivedInputs,
  });

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'A.1.2',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_CONFIDENCE,
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: percent };
}

/**
 * Compute D.2.2 (total years to citizenship). Pure. Returns null on any
 * skip condition. Skips emit a one-line console.log.
 */
export function deriveD22(input: DerivedD22Input): DerivedRow | null {
  if (input.d12Years === null) {
    console.log(`  [D.2.2] derived skip — D.1.2 not POPULATED for ${input.countryIso}`);
    return null;
  }
  if (input.d11Boolean === false) {
    console.log(`  [D.2.2] derived skip — D.1.1 is false (no PR pathway) for ${input.countryIso}`);
    return null;
  }
  if (input.citizenshipResidence === null) {
    console.log(
      `  [D.2.2] derived skip — no COUNTRY_CITIZENSHIP_RESIDENCE_YEARS entry for ${input.countryIso}`
    );
    return null;
  }
  if (input.citizenshipResidence.yearsAsPr === null) {
    console.log(
      `  [D.2.2] derived skip — ${input.countryIso} has no realistic citizenship pathway (yearsAsPr=null)`
    );
    return null;
  }

  const total = Math.round((input.d12Years + input.citizenshipResidence.yearsAsPr) * 2) / 2;

  const sourceSentence =
    `Derived from D.1.2 (${input.d12Years} yrs to PR) + ` +
    `${input.countryIso} citizenship residence requirement ` +
    `(${input.citizenshipResidence.yearsAsPr} yrs as PR) = ${total} yrs`;

  const derivedInputs = {
    'D.1.2': {
      years: input.d12Years,
      sourceUrl: input.d12SourceUrl,
    },
    'D.1.1': { boolean: input.d11Boolean },
    citizenshipResidence: {
      yearsAsPr: input.citizenshipResidence.yearsAsPr,
      sourceUrl: input.citizenshipResidence.sourceUrl,
      notes: input.citizenshipResidence.notes ?? null,
    },
  };

  const provenance = buildBaseProvenance({
    fieldKey: 'D.2.2',
    contentHashSeed: `derived-computation:D.2.2:${input.programId}:${input.d12Years}:${input.citizenshipResidence.yearsAsPr}`,
    sourceSentence,
    methodologyVersion: input.methodologyVersion,
    derivedInputs,
  });

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'D.2.2',
    valueRaw: String(total),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_CONFIDENCE,
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: total };
}

/**
 * Phase 3.6.1 / FIX 6 — Compute D.2.3 (dual citizenship permitted).
 *
 * Pure deterministic legal-fact lookup. No LLM. Returns a derived row
 * when COUNTRY_DUAL_CITIZENSHIP_POLICY has a non-null `permitted` value
 * for the country. Skips (returns null + logs) when:
 *   - no policy entry exists for the country, OR
 *   - permitted is null (policy is contested/partial/undocumented)
 *
 * Confidence is hard-coded to DERIVE_KNOWLEDGE_CONFIDENCE (0.7) — slightly
 * higher than the arithmetic derives because the source is a published
 * citizenship act rather than a calculation, but still below the 0.85
 * auto-approve threshold so every row routes to /review.
 *
 * The provenance carries:
 *   - extractionModel: 'derived-knowledge'
 *   - sourceTier: null (matches country-substitute / derived-computation)
 *   - sourceUrl: the citizenship-act URL from the lookup
 *   - sourceSentence: the notes field from the lookup
 *   - derivedInputs: { 'D.2.3': { permitted, sourceUrl, sourceYear } }
 */
export function deriveD23(input: DerivedD23Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [D.2.3] derived skip — no COUNTRY_DUAL_CITIZENSHIP_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  if (input.policy.permitted === null) {
    console.log(
      `  [D.2.3] derived skip — ${input.countryIso} dual-citizenship policy is contested/partial`
    );
    return null;
  }

  const valueRaw = input.policy.permitted ? 'permitted' : 'not_permitted';
  const sourceSentence = input.policy.notes;

  const derivedInputs = {
    'D.2.3': {
      permitted: input.policy.permitted,
      sourceUrl: input.policy.sourceUrl,
      sourceYear: input.policy.sourceYear,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: input.policy.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:D.2.3:${input.programId}:${input.countryIso}:${input.policy.permitted}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: input.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'D.2.3',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: 0 };
}

/**
 * Phase 3.6.2 / ITEM 2 — Compute B.2.4 (mandatory non-government costs).
 *
 * Same pattern as deriveD23 — country-level derived-knowledge lookup.
 * Writes a `boolean_with_annotation` shape `{hasMandatoryNonGovCosts, notes}`
 * matching the methodology-v2 rubric. The publish layer's
 * `BOOLEAN_WITH_ANNOTATION_KEYS` already maps B.2.4 → `'hasMandatoryNonGovCosts'`.
 */
export function deriveB24(input: DerivedB24Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [B.2.4] derived skip — no COUNTRY_NON_GOV_COSTS_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  if (input.policy.hasMandatoryNonGovCosts === null) {
    console.log(
      `  [B.2.4] derived skip — ${input.countryIso} non-gov-costs policy is unknown/null`
    );
    return null;
  }

  const valueRaw = JSON.stringify({
    hasMandatoryNonGovCosts: input.policy.hasMandatoryNonGovCosts,
    notes: input.policy.notes,
  });
  const sourceSentence = input.policy.notes;

  const derivedInputs = {
    'B.2.4': {
      hasMandatoryNonGovCosts: input.policy.hasMandatoryNonGovCosts,
      sourceUrl: input.policy.sourceUrl,
      sourceYear: input.policy.sourceYear,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: input.policy.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:B.2.4:${input.programId}:${input.countryIso}:${input.policy.hasMandatoryNonGovCosts}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: input.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'B.2.4',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: 0 };
}

function buildPrPresenceRow(
  fieldKey: 'D.1.3' | 'D.1.4',
  input: DerivedD13Input | DerivedD14Input,
  entry: PrPresenceFieldEntry
): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [${fieldKey}] derived skip — no COUNTRY_PR_PRESENCE_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  if (entry.required === null) {
    console.log(
      `  [${fieldKey}] derived skip — ${input.countryIso} PR presence policy is null (no PR pathway / contested)`
    );
    return null;
  }

  const valueRaw = JSON.stringify({
    required: entry.required,
    daysPerYear: entry.daysPerYear,
    notes: entry.notes,
  });
  const sourceSentence = entry.notes;

  const derivedInputs = {
    [fieldKey]: {
      required: entry.required,
      daysPerYear: entry.daysPerYear,
      sourceUrl: input.policy.sourceUrl,
      sourceYear: input.policy.sourceYear,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: input.policy.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:${fieldKey}:${input.programId}:${input.countryIso}:${entry.required}:${entry.daysPerYear}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: input.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: fieldKey,
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: 0 };
}

/**
 * Phase 3.6.2 / ITEM 2 — Compute D.1.3 (PR-accrual physical presence).
 */
export function deriveD13(input: DerivedD13Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [D.1.3] derived skip — no COUNTRY_PR_PRESENCE_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  return buildPrPresenceRow('D.1.3', input, input.policy.d13);
}

/**
 * Phase 3.6.2 / ITEM 2 — Compute D.1.4 (PR retention physical presence).
 */
export function deriveD14(input: DerivedD14Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [D.1.4] derived skip — no COUNTRY_PR_PRESENCE_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  return buildPrPresenceRow('D.1.4', input, input.policy.d14);
}

/**
 * Phase 3.6.4 / FIX 2 — D.1.2 (minimum years of residence to PR
 * eligibility). Country-deterministic in the cohort: the rule is set by
 * the immigration / citizenship authority. Same pattern as D.2.3 / B.2.4
 * — derived-knowledge, confidence 0.7, routes to /review. valueRaw is
 * the integer-year as a string (e.g. "2"); valueNormalized is the bare
 * number, matching the min_max numeric path the scoring engine expects
 * for D.1.2.
 *
 * Skips when:
 *   - no entry exists for the country
 *   - the entry's d12MinYearsToPr is null (no realistic PR pathway,
 *     e.g. GCC monarchies)
 */
export interface PrTimelinePolicyEntry {
  iso3: string;
  d12MinYearsToPr: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD12Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: PrTimelinePolicyEntry | null;
}

export function deriveD12(input: DerivedD12Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(`  [D.1.2] derived skip — no COUNTRY_PR_TIMELINE entry for ${input.countryIso}`);
    return null;
  }
  if (input.policy.d12MinYearsToPr === null) {
    console.log(
      `  [D.1.2] derived skip — ${input.countryIso} has no realistic PR pathway (d12MinYearsToPr=null)`
    );
    return null;
  }

  const years = input.policy.d12MinYearsToPr;
  const valueRaw = String(years);
  const sourceSentence = input.policy.notes;

  const derivedInputs = {
    'D.1.2': {
      years,
      sourceUrl: input.policy.sourceUrl,
      sourceYear: input.policy.sourceYear,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: input.policy.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(`derived-knowledge:D.1.2:${input.programId}:${input.countryIso}:${years}`, 'utf8')
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: input.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: input.programId,
    fieldDefinitionKey: 'D.1.2',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: years };
}

// ────────────────────────────────────────────────────────────────────
// Phase 3.9 / W21 — country-level derives for D.2.4, D.3.1, D.3.3.
//
// All three are country-deterministic (citizenship-test burden, tax
// residency-trigger day-count, and tax-base scope are set by national
// citizenship/tax law, not the visa programme). Same pattern as the
// D.1.2 / B.2.4 / D.2.3 derives — country-level lookup, deterministic
// output, derived-knowledge confidence (0.7) routing to /review.
// ────────────────────────────────────────────────────────────────────

export interface CivicTestPolicyEntry {
  iso3: string;
  burden: 'none' | 'light' | 'moderate' | 'heavy' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD24Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: CivicTestPolicyEntry | null;
}

export interface TaxResidencyPolicyEntry {
  iso3: string;
  triggerDays: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD31Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: TaxResidencyPolicyEntry | null;
}

export interface TaxBasisPolicyEntry {
  iso3: string;
  basis: 'worldwide' | 'worldwide_with_remittance_basis' | 'territorial' | 'hybrid' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface DerivedD33Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  policy: TaxBasisPolicyEntry | null;
}

function buildCountryDerivedRow(args: {
  fieldKey: string;
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  valueRaw: string;
  numericValue: number;
  sourceUrl: string;
  sourceSentence: string;
  derivedInputs: Record<string, unknown>;
}): DerivedRow {
  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: args.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:${args.fieldKey}:${args.programId}:${args.countryIso}:${args.valueRaw}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence: args.sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    validationModel: DERIVE_KNOWLEDGE_MODEL,
    validationConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    crossCheckResult,
    crossCheckUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    methodologyVersion: args.methodologyVersion,
    reviewDecision: 'approve',
    derivedInputs: args.derivedInputs,
  };

  const extraction: ExtractionOutput = {
    programId: args.programId,
    fieldDefinitionKey: args.fieldKey,
    valueRaw: args.valueRaw,
    sourceSentence: args.sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: args.numericValue };
}

/**
 * Phase 3.9 / W21 — Compute D.2.4 (civic / language / integration test
 * burden for citizenship). Country-deterministic, set by citizenship law.
 *
 * Skips when:
 *   - no entry exists for the country
 *   - the entry's burden is null (no realistic naturalisation pathway,
 *     e.g. GCC monarchies)
 */
export function deriveD24(input: DerivedD24Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(
      `  [D.2.4] derived skip — no COUNTRY_CIVIC_TEST_POLICY entry for ${input.countryIso}`
    );
    return null;
  }
  if (input.policy.burden === null) {
    console.log(
      `  [D.2.4] derived skip — ${input.countryIso} has no realistic naturalisation pathway`
    );
    return null;
  }
  return buildCountryDerivedRow({
    fieldKey: 'D.2.4',
    programId: input.programId,
    countryIso: input.countryIso,
    methodologyVersion: input.methodologyVersion,
    valueRaw: input.policy.burden,
    numericValue: 0,
    sourceUrl: input.policy.sourceUrl,
    sourceSentence: input.policy.notes,
    derivedInputs: {
      'D.2.4': {
        burden: input.policy.burden,
        sourceUrl: input.policy.sourceUrl,
        sourceYear: input.policy.sourceYear,
      },
    },
  });
}

/**
 * Phase 3.9 / W21 — Compute D.3.1 (tax-residency trigger, days/year).
 * Country-deterministic, set by national tax code. Skips when no entry
 * for the country, or when the country uses a non-day-count primary
 * mechanism (territorial / domicile-based — handled by D.3.3 instead).
 */
export function deriveD31(input: DerivedD31Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(`  [D.3.1] derived skip — no COUNTRY_TAX_RESIDENCY entry for ${input.countryIso}`);
    return null;
  }
  if (input.policy.triggerDays === null) {
    console.log(
      `  [D.3.1] derived skip — ${input.countryIso} uses non-day-count primary mechanism (see D.3.3)`
    );
    return null;
  }
  const days = input.policy.triggerDays;
  return buildCountryDerivedRow({
    fieldKey: 'D.3.1',
    programId: input.programId,
    countryIso: input.countryIso,
    methodologyVersion: input.methodologyVersion,
    valueRaw: String(days),
    numericValue: days,
    sourceUrl: input.policy.sourceUrl,
    sourceSentence: input.policy.notes,
    derivedInputs: {
      'D.3.1': {
        triggerDays: days,
        sourceUrl: input.policy.sourceUrl,
        sourceYear: input.policy.sourceYear,
      },
    },
  });
}

/**
 * Phase 3.9 / W21 — Compute D.3.3 (territorial vs. worldwide taxation
 * for residents). Country-deterministic, set by national tax code.
 */
export function deriveD33(input: DerivedD33Input): DerivedRow | null {
  if (input.policy === null) {
    console.log(`  [D.3.3] derived skip — no COUNTRY_TAX_BASIS entry for ${input.countryIso}`);
    return null;
  }
  if (input.policy.basis === null) {
    console.log(`  [D.3.3] derived skip — ${input.countryIso} basis unknown/contested`);
    return null;
  }
  return buildCountryDerivedRow({
    fieldKey: 'D.3.3',
    programId: input.programId,
    countryIso: input.countryIso,
    methodologyVersion: input.methodologyVersion,
    valueRaw: input.policy.basis,
    numericValue: 0,
    sourceUrl: input.policy.sourceUrl,
    sourceSentence: input.policy.notes,
    derivedInputs: {
      'D.3.3': {
        basis: input.policy.basis,
        sourceUrl: input.policy.sourceUrl,
        sourceYear: input.policy.sourceYear,
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Stage orchestrator. Pure inputs (no DB) — the canary / Trigger.dev
// caller resolves DB-backed fields and the static-table entries before
// calling execute().
// ────────────────────────────────────────────────────────────────────

import type { DeriveStage, DeriveStageInputs } from '../types/pipeline';

export class DeriveStageImpl implements DeriveStage {
  execute(inputs: DeriveStageInputs): DerivedRow[] {
    const out: DerivedRow[] = [];
    const a12 = deriveA12(inputs.a12);
    if (a12) out.push(a12);
    const d22 = deriveD22(inputs.d22);
    if (d22) out.push(d22);
    if (inputs.d23) {
      const d23 = deriveD23(inputs.d23);
      if (d23) out.push(d23);
    }
    if (inputs.b24) {
      const b24 = deriveB24(inputs.b24);
      if (b24) out.push(b24);
    }
    if (inputs.d13) {
      const d13 = deriveD13(inputs.d13);
      if (d13) out.push(d13);
    }
    if (inputs.d14) {
      const d14 = deriveD14(inputs.d14);
      if (d14) out.push(d14);
    }
    if (inputs.d12) {
      const d12 = deriveD12(inputs.d12);
      if (d12) out.push(d12);
    }
    if (inputs.d24) {
      const d24 = deriveD24(inputs.d24);
      if (d24) out.push(d24);
    }
    if (inputs.d31) {
      const d31 = deriveD31(inputs.d31);
      if (d31) out.push(d31);
    }
    if (inputs.d33) {
      const d33 = deriveD33(inputs.d33);
      if (d33) out.push(d33);
    }
    return out;
  }
}
