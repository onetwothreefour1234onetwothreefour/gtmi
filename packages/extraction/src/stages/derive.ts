// Phase 3.6 / Fix D / ADR-016 (superseded for Pillar A by ADR-028, B by
// ADR-029, D by ADR-031, E by ADR-032) — Stage 6.5: Derive.
//
// Methodology v6.0.0 (ADR-032) — only one derive remains: program age
// (now keyed E.1.1, was E.1.3). All Pillar D deriveDxx functions were
// deleted in ADR-031; the severity-weighted policy-change derive
// (deriveE11) was deleted in ADR-032 in favour of LLM extraction
// against the same recall hints.
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
 * Methodology v6.0.0 (ADR-032): the only remaining derive is
 * `derived-computation` for program age (E.1.1). The
 * derived-knowledge constants are retained as dormant exports because
 * downstream consumers (the /review provenance drawer test fixtures
 * and a few historical extraction snapshots) still import them.
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
// Methodology v6.0.0 / ADR-032 — E-pillar derive: program age.
//
// Under v5 this derive wrote to E.1.3; under v6 it writes to E.1.1
// (program age semantics moved keys; the 20-year ceiling moved from
// the derive to the scoring engine via the placeholder min_max
// params.max=20). The function still returns the raw uncapped year
// count in numericValue for audit; valueRaw is the same uncapped
// integer the engine then clamps via min_max.
//
// Fully deterministic: current_year - launch_year. Source is
// programs.launch_year on the programs table; the canary / Trigger.dev
// caller resolves it before invoking. derived-computation model.
//
// The severity-weighted policy-change derive (deriveE11) was deleted
// in ADR-032 — that data is now LLM-extracted as the new E.2.1 from
// the same recall hints (Migration Policy Institute, OECD migration
// outlook, IMD reports).
// ────────────────────────────────────────────────────────────────────

export interface DerivedProgramAgeInput {
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

export function deriveProgramAge(input: DerivedProgramAgeInput): DerivedRow | null {
  if (input.launchYear === null) {
    console.log(
      `  [E.1.1] derived skip — programs.launch_year is null for program ${input.programId}`
    );
    return null;
  }
  const rawYears = input.currentYear - input.launchYear;
  if (rawYears < 0) {
    console.log(
      `  [E.1.1] derived skip — launch_year ${input.launchYear} is in the future relative to currentYear ${input.currentYear}`
    );
    return null;
  }
  // ADR-032 — emit the uncapped raw integer; the scoring engine
  // enforces the 20-year ceiling at score time via min_max params.max.
  const valueRaw = String(rawYears);
  const sourceSentence = `Program age = ${input.currentYear} − ${input.launchYear} = ${rawYears} year(s).`;
  const sourceUrl = input.sourceUrl ?? 'urn:gtmi:derived:programs-table:launch_year';

  const derivedInputs = {
    'E.1.1': {
      currentYear: input.currentYear,
      launchYear: input.launchYear,
      result: rawYears,
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
        `derived-computation:E.1.1:${input.programId}:${input.launchYear}:${input.currentYear}`,
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
    fieldDefinitionKey: 'E.1.1',
    valueRaw,
    sourceSentence,
    characterOffsets: { start: 0, end: 0 },
    extractionConfidence: DERIVE_CONFIDENCE,
    extractionModel: DERIVE_EXTRACTION_MODEL,
    extractedAt: new Date(),
  };

  return { extraction, provenance, numericValue: rawYears };
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
    // Methodology v6.0.0 (ADR-032) — only program age remains derived.
    // Pillar D deriveDxx and the v5 deriveE11 (severity-weighted policy
    // changes) are gone; the new E.2.1 is LLM-extracted.
    if (inputs.programAge) {
      const r = deriveProgramAge(inputs.programAge);
      if (r) out.push(r);
    }
    return out;
  }
}
