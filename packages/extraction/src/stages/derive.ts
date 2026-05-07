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
//
// Methodology v5.0.0 (ADR-031) — DerivedD22Input / DerivedD23Input /
// DerivedD13Input / DerivedD14Input / DerivedD12Input / DerivedD24Input
// / DerivedD31Input / DerivedD33Input all removed. Eight Pillar D
// deriveDxx functions deleted; D.1.2 / D.2.2 / D.2.3 are now LLM-
// extracted; D.1.3 / D.1.4 / D.2.4 / D.3.1 / D.3.3 retired entirely.
// The policy-entry types (DualCitizenshipPolicyEntry,
// NonGovCostsPolicyEntry, PrPresenceFieldEntry, PrPresencePolicyEntry)
// are retained because the corresponding country-data modules
// continue to be exported as analyst reference.

/** Phase 3.6.1 / FIX 6 — D.2.3 input shape. */
export interface DualCitizenshipPolicyEntry {
  iso3: string;
  permitted: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

/**
 * Phase 3.6.2 / ITEM 2 — country-level non-government costs policy entry.
 * Methodology v3.0.0 (ADR-029): the deriveB24 stage was deleted; this
 * interface is retained only because the COUNTRY_NON_GOV_COSTS_POLICY
 * data module continues to be exported as analyst reference.
 */
export interface NonGovCostsPolicyEntry {
  iso3: string;
  hasMandatoryNonGovCosts: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

/** Phase 3.6.2 / ITEM 2 — D.1.3 / D.1.4 derive inputs (functions deleted in v5.0.0). */
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
// Methodology v5.0.0 (ADR-031) — orphaned policy-entry types retained
// for the COUNTRY_PR_TIMELINE / COUNTRY_CIVIC_TEST_POLICY /
// COUNTRY_TAX_RESIDENCY / COUNTRY_TAX_BASIS / COUNTRY_CITIZENSHIP_RESIDENCE_YEARS
// data modules. The corresponding deriveD12 / deriveD22 / deriveD24 /
// deriveD31 / deriveD33 functions were deleted alongside D.2.4 /
// D.3.1 / D.3.3 retirement and the Pillar D LLM-extraction shift.
// Data modules continue to exist as analyst reference; cleanup
// deferred to a follow-up PR.
// ────────────────────────────────────────────────────────────────────

export interface PrTimelinePolicyEntry {
  iso3: string;
  d12MinYearsToPr: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface CivicTestPolicyEntry {
  iso3: string;
  burden: 'none' | 'light' | 'moderate' | 'heavy' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface TaxResidencyPolicyEntry {
  iso3: string;
  triggerDays: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export interface TaxBasisPolicyEntry {
  iso3: string;
  basis: 'worldwide' | 'worldwide_with_remittance_basis' | 'territorial' | 'hybrid' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
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
    // Methodology v5.0.0 (ADR-031) — all 8 Pillar D deriveDxx calls
    // removed. D.1.2 / D.2.2 / D.2.3 are LLM-extracted; the other 5
    // Pillar D keys (D.1.3, D.1.4, D.2.4, D.3.1, D.3.3) are retired.
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
