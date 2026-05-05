import { describe, expect, it } from 'vitest';
import {
  DERIVE_CONFIDENCE,
  DERIVE_EXTRACTION_MODEL,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  deriveD13,
  deriveD14,
  deriveD22,
} from '../stages/derive';
import type { CitizenshipResidenceEntry, PrPresencePolicyEntry } from '../stages/derive';
import { checkProvenanceRow } from '@gtmi/shared';

// Phase 3.6 / Fix D / ADR-016 — derive stage unit tests.
// All tests target the pure functions; no DB, no LLM, no fetch.

const AUS_CITIZENSHIP: CitizenshipResidenceEntry = {
  iso3: 'AUS',
  yearsAsPr: 4,
  sourceUrl: 'https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/permanent-resident',
  notes: '4 yrs lawful residence (incl. 1 yr as PR).',
};

const ARE_CITIZENSHIP: CitizenshipResidenceEntry = {
  iso3: 'ARE',
  yearsAsPr: null,
  sourceUrl: 'https://u.ae/...',
  notes: 'No realistic pathway',
};

// ────────────────────────────────────────────────────────────────────
// D.2.2
// ────────────────────────────────────────────────────────────────────

describe('deriveD22 — happy path', () => {
  it('computes total years from D.1.2 + citizenship-residence years', () => {
    const r = deriveD22({
      programId: 'test-prog',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      d11Boolean: true,
      d12Years: 2,
      d12SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      citizenshipResidence: AUS_CITIZENSHIP,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBe(6); // 2 + 4
    expect(r!.extraction.fieldDefinitionKey).toBe('D.2.2');
    expect(r!.extraction.valueRaw).toBe('6');
  });
});

describe('deriveD22 — skip conditions', () => {
  const baseValid = {
    programId: 'test-prog',
    countryIso: 'AUS',
    methodologyVersion: '1.0.0',
    d11Boolean: true,
    d12Years: 2,
    d12SourceUrl: 'https://example.gov',
    citizenshipResidence: AUS_CITIZENSHIP,
  };

  it('skips when D.1.2 is null (years to PR not POPULATED)', () => {
    expect(deriveD22({ ...baseValid, d12Years: null })).toBeNull();
  });

  it('skips when D.1.1 is false (no PR pathway)', () => {
    expect(deriveD22({ ...baseValid, d11Boolean: false })).toBeNull();
  });

  it('does NOT skip when D.1.1 is null (unknown PR pathway is allowed)', () => {
    // A null D.1.1 means we couldn't extract it; we don't block derivation
    // on it because D.1.2 being POPULATED implies a PR pathway exists.
    const r = deriveD22({ ...baseValid, d11Boolean: null });
    expect(r).not.toBeNull();
  });

  it('skips when citizenshipResidence entry is null (no table coverage)', () => {
    expect(deriveD22({ ...baseValid, citizenshipResidence: null })).toBeNull();
  });

  it('skips when citizenshipResidence.yearsAsPr is null (GCC: no realistic pathway)', () => {
    expect(deriveD22({ ...baseValid, citizenshipResidence: ARE_CITIZENSHIP })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// Provenance shape — passes checkProvenanceRow + ADR-016 invariants
// ────────────────────────────────────────────────────────────────────

describe('Derived row provenance shape (ADR-016 invariants)', () => {
  const d22 = deriveD22({
    programId: 'test-prog',
    countryIso: 'AUS',
    methodologyVersion: '1.0.0',
    d11Boolean: true,
    d12Years: 2,
    d12SourceUrl: 'https://example.gov',
    citizenshipResidence: AUS_CITIZENSHIP,
  })!;

  it('D.2.2 derived row passes checkProvenanceRow on pending_review status', () => {
    const issues = checkProvenanceRow(d22.provenance, 'pending_review');
    expect(issues).toEqual([]);
  });

  it('extractionModel is the literal "derived-computation" (ADR-016 invariant)', () => {
    expect(d22.provenance.extractionModel).toBe('derived-computation');
    expect(DERIVE_EXTRACTION_MODEL).toBe('derived-computation');
  });

  it('extractionConfidence is hard-coded to 0.6 (ADR-016 invariant)', () => {
    expect(d22.provenance.extractionConfidence).toBe(0.6);
    expect(d22.extraction.extractionConfidence).toBe(0.6);
    expect(DERIVE_CONFIDENCE).toBe(0.6);
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    expect(d22.provenance.extractionConfidence).toBeLessThan(0.85);
    expect(d22.provenance.validationConfidence).toBeLessThan(0.85);
  });

  it('sourceTier is null (no real source)', () => {
    expect(d22.provenance.sourceTier).toBeNull();
  });

  it('sourceUrl is the derived-computation marker', () => {
    expect(d22.provenance.sourceUrl).toBe('derived-computation:D.2.2');
  });

  it('derivedInputs JSONB extension carries the input values', () => {
    const d22Inputs = (d22.provenance as unknown as { derivedInputs: Record<string, unknown> })
      .derivedInputs;
    expect(d22Inputs).toHaveProperty('D.1.2');
    expect(d22Inputs).toHaveProperty('D.1.1');
    expect(d22Inputs).toHaveProperty('citizenshipResidence');
  });
});

// Phase 3.6.2 / ITEM 2 — D.1.3 / D.1.4 country-level derives.
// (B.2.4 / deriveB24 was retired in methodology v3.0.0 / ADR-029.)

const PR_PRESENCE_AUS: PrPresencePolicyEntry = {
  iso3: 'AUS',
  d13: { required: true, daysPerYear: 730, notes: '730 days in 5 years (PR accrual)' },
  d14: { required: true, daysPerYear: 730, notes: '730 days in 5 years (PR retention)' },
  sourceUrl: 'https://immi.homeaffairs.gov.au/visas/permanent-resident',
  sourceYear: 2025,
};

const PR_PRESENCE_GCC_NULL: PrPresencePolicyEntry = {
  iso3: 'ARE',
  d13: { required: null, daysPerYear: null, notes: 'No PR pathway for ARE.' },
  d14: { required: null, daysPerYear: null, notes: 'No PR pathway for ARE.' },
  sourceUrl: 'https://www.mohre.gov.ae/',
  sourceYear: 2025,
};

describe('deriveD13 / deriveD14 — PR presence', () => {
  it('returns null when policy is null (no entry for country)', () => {
    expect(
      deriveD13({ programId: 'p', countryIso: 'XYZ', methodologyVersion: '1.0.0', policy: null })
    ).toBeNull();
    expect(
      deriveD14({ programId: 'p', countryIso: 'XYZ', methodologyVersion: '1.0.0', policy: null })
    ).toBeNull();
  });

  it('returns null when required is null (no PR pathway, e.g. ARE)', () => {
    expect(
      deriveD13({
        programId: 'p',
        countryIso: 'ARE',
        methodologyVersion: '1.0.0',
        policy: PR_PRESENCE_GCC_NULL,
      })
    ).toBeNull();
    expect(
      deriveD14({
        programId: 'p',
        countryIso: 'ARE',
        methodologyVersion: '1.0.0',
        policy: PR_PRESENCE_GCC_NULL,
      })
    ).toBeNull();
  });

  it('D.1.3 produces a derived-knowledge row with required + daysPerYear', () => {
    const r = deriveD13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: PR_PRESENCE_AUS,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.1.3');
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
    const parsed = JSON.parse(r!.extraction.valueRaw);
    expect(parsed.required).toBe(true);
    expect(parsed.daysPerYear).toBe(730);
  });

  it('D.1.4 produces a derived-knowledge row distinct from D.1.3', () => {
    const r = deriveD14({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: PR_PRESENCE_AUS,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.1.4');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
  });
});
