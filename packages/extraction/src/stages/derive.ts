// Phase 3.6 / Fix D / ADR-016 (superseded for Pillar A by methodology v2.0.0)
// — Stage 6.5: Derive.
//
// Pure deterministic computation of PAQ indicators that cannot be sourced
// as a literal sentence on any government page:
//
//   D.2.2 — Total minimum years from initial visa entry to citizenship eligibility
//   plus the Pillar D / E knowledge-derived rows below.
//
// The Pillar A derive (A.1.2 % of median) was removed in methodology
// v2.0.0 — % of median is now extracted directly as A.1.1 by the LLM
// stage. See the superseding ADR for ADR-016.
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

// Methodology v2.0.0 — DerivedA12Input removed. Pillar A no longer has a
// derived field: % of median is now extracted directly as A.1.1 by the
// LLM stage. See ADR superseding ADR-016.

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
   * Convenience: the numeric output for arithmetic derives (D.2.2)
   * or 0 for non-numeric derives (D.2.3 — categorical 'permitted'/'not_permitted').
   */
  numericValue: number;
}

// ────────────────────────────────────────────────────────────────────
// Pure functions: zero side effects, return null on any skip condition.
// ────────────────────────────────────────────────────────────────────

function buildBaseProvenance(args: {
  fieldKey: 'D.2.2';
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
// Phase 3.9 / W20 — E-pillar derives: E.1.3 (program age) and E.1.1
// (severity-weighted policy-change count, 5-yr window).
//
// E.1.3 is fully deterministic: current_year - launch_year, capped at
// 20. The launch_year lives on the programs table; canary-run resolves
// it before calling. derived-computation model.
//
// E.1.1 is per-program curated data — change events with severity
// buckets — summed via the methodology-defined weights. Country-
// agnostic: the mechanism keys off programId, not country code.
// derived-knowledge model.
// ────────────────────────────────────────────────────────────────────

export interface DerivedE13Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  /** programs.launch_year for this program. null if not set. */
  launchYear: number | null;
  /** Current calendar year used for the subtraction (typically Date.now()'s year). */
  currentYear: number;
  /**
   * Optional source URL (the programme's official launch announcement
   * if known). When null, the derive uses a sentinel
   * 'derived-from-programs-table' string so provenance is still
   * non-empty.
   */
  sourceUrl?: string | null;
}

export function deriveE13(input: DerivedE13Input): DerivedRow | null {
  if (input.launchYear === null) {
    console.log(
      `  [E.1.3] derived skip — programs.launch_year is null for program ${input.programId}`
    );
    return null;
  }
  const rawYears = input.currentYear - input.launchYear;
  if (rawYears < 0) {
    console.log(
      `  [E.1.3] derived skip — launch_year ${input.launchYear} is in the future relative to currentYear ${input.currentYear}`
    );
    return null;
  }
  const years = Math.min(rawYears, 20);
  const valueRaw = String(years);
  const sourceSentence = `Program age = ${input.currentYear} − ${input.launchYear} = ${rawYears} year(s), capped at 20 → ${years}.`;
  const sourceUrl = input.sourceUrl ?? 'urn:gtmi:derived:programs-table:launch_year';

  const derivedInputs = {
    'E.1.3': {
      currentYear: input.currentYear,
      launchYear: input.launchYear,
      cappedAt: 20,
      result: years,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-computation:E.1.3:${input.programId}:${input.launchYear}:${input.currentYear}`,
        'utf8'
      )
      .digest('hex'),
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractionConfidence: DERIVE_CONFIDENCE,
    validationModel: DERIVE_EXTRACTION_MODEL,
    validationConfidence: DERIVE_CONFIDENCE,
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
    fieldDefinitionKey: 'E.1.3',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_CONFIDENCE,
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: years };
}

export interface PolicyChangeEventEntry {
  year: number;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
}

export interface ProgramPolicyHistoryEntry {
  programId: string;
  programName: string;
  windowStartYear: number;
  windowEndYear: number;
  events: PolicyChangeEventEntry[];
  sourceUrl: string;
  notes?: string;
}

export interface DerivedE11Input {
  programId: string;
  countryIso: string;
  methodologyVersion: string;
  history: ProgramPolicyHistoryEntry | null;
}

function severityWeightInternal(s: 'major' | 'moderate' | 'minor'): number {
  switch (s) {
    case 'major':
      return 3;
    case 'moderate':
      return 2;
    case 'minor':
      return 1;
  }
}

/**
 * Phase 3.9 / W20 — Compute E.1.1 (severity-weighted count of material
 * policy changes over a 5-year window). Per-program curated data;
 * country-agnostic mechanism. Returns null when no history is curated
 * for the programme (LLM extraction will run instead).
 */
export function deriveE11(input: DerivedE11Input): DerivedRow | null {
  if (input.history === null) {
    console.log(
      `  [E.1.1] derived skip — no PROGRAM_POLICY_HISTORY entry for program ${input.programId}`
    );
    return null;
  }
  const sum = input.history.events.reduce((acc, e) => acc + severityWeightInternal(e.severity), 0);
  const valueRaw = String(sum);
  const representative = input.history.events[0];
  const sourceSentence = representative
    ? `${representative.year} (${representative.severity}): ${representative.description}`
    : `No material changes recorded in window ${input.history.windowStartYear}-${input.history.windowEndYear}.`;

  const derivedInputs = {
    'E.1.1': {
      windowStartYear: input.history.windowStartYear,
      windowEndYear: input.history.windowEndYear,
      eventCount: input.history.events.length,
      severitySum: sum,
      events: input.history.events,
    },
  };

  const crossCheckResult: CrossCheckOutcome = 'not_checked';
  const provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> } = {
    sourceUrl: input.history.sourceUrl,
    geographicLevel: 'national',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256')
      .update(
        `derived-knowledge:E.1.1:${input.programId}:${sum}:${input.history.events.length}`,
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
    fieldDefinitionKey: 'E.1.1',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_KNOWLEDGE_CONFIDENCE,
    extractionModel: DERIVE_KNOWLEDGE_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: sum };
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
    if (inputs.e13) {
      const e13 = deriveE13(inputs.e13);
      if (e13) out.push(e13);
    }
    if (inputs.e11) {
      const e11 = deriveE11(inputs.e11);
      if (e11) out.push(e11);
    }
    return out;
  }
}
