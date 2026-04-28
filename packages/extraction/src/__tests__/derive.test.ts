import { describe, expect, it } from 'vitest';
import { DERIVE_CONFIDENCE, DERIVE_EXTRACTION_MODEL, deriveA12, deriveD22 } from '../stages/derive';
import type { CitizenshipResidenceEntry, FxRateEntry, MedianWageEntry } from '../stages/derive';
import { checkProvenanceRow } from '@gtmi/shared';

// Phase 3.6 / Fix D / ADR-016 — derive stage unit tests.
// All tests target the pure functions; no DB, no LLM, no fetch.

const AUS_MEDIAN: MedianWageEntry = {
  iso3: 'AUS',
  usdYear: 2023,
  medianWageUsd: 60_200,
  source: 'OECD',
  sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
};

const AUD_FX: FxRateEntry = {
  code: 'AUD',
  year: 2024,
  lcuPerUsd: 1.518,
  sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
};

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
// A.1.2
// ────────────────────────────────────────────────────────────────────

describe('deriveA12 — happy path', () => {
  it('computes salary as % of local median wage with correct arithmetic', () => {
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      a11ValueRaw: 'AUD 73,150',
      a11ValueCurrency: 'AUD',
      a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      medianWage: AUS_MEDIAN,
      fxRate: AUD_FX,
    });
    expect(r).not.toBeNull();
    // 73150 / 1.518 = 48,188.40 USD ; / 60,200 * 100 = 80.0%
    expect(r!.numericValue).toBeCloseTo(80.0, 1);
    expect(r!.extraction.fieldDefinitionKey).toBe('A.1.2');
    expect(r!.extraction.valueRaw).toBe(String(r!.numericValue));
  });

  it('handles USD directly without FX conversion', () => {
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'USA',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '60000',
      a11ValueCurrency: 'USD',
      a11SourceUrl: 'https://uscis.gov/...',
      medianWage: { ...AUS_MEDIAN, iso3: 'USA', medianWageUsd: 80_000 },
      fxRate: { code: 'USD', year: 2024, lcuPerUsd: 1.0, sourceUrl: 'self' },
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBeCloseTo(75.0, 1);
  });
});

describe('deriveA12 — skip conditions', () => {
  const baseValid = {
    programId: 'test-prog',
    countryIso: 'AUS',
    methodologyVersion: '1.0.0',
    a11ValueRaw: 'AUD 73,150',
    a11ValueCurrency: 'AUD',
    a11SourceUrl: 'https://example.gov',
    medianWage: AUS_MEDIAN,
    fxRate: AUD_FX,
  };

  it('skips when A.1.1 is null', () => {
    expect(deriveA12({ ...baseValid, a11ValueRaw: null })).toBeNull();
  });

  it('skips when A.1.1 is empty string', () => {
    expect(deriveA12({ ...baseValid, a11ValueRaw: '' })).toBeNull();
  });

  it('skips when no valueCurrency is present', () => {
    expect(deriveA12({ ...baseValid, a11ValueCurrency: null })).toBeNull();
  });

  it('skips when no COUNTRY_MEDIAN_WAGE entry for country', () => {
    expect(deriveA12({ ...baseValid, medianWage: null })).toBeNull();
  });

  it('skips when no FX_RATES entry for currency', () => {
    expect(deriveA12({ ...baseValid, fxRate: null })).toBeNull();
  });

  it('skips when valueRaw does not parse to a positive number', () => {
    expect(deriveA12({ ...baseValid, a11ValueRaw: 'not a number' })).toBeNull();
    expect(deriveA12({ ...baseValid, a11ValueRaw: '0' })).toBeNull();
    expect(deriveA12({ ...baseValid, a11ValueRaw: '-100' })).toBeNull();
  });
});

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
  const a12 = deriveA12({
    programId: 'test-prog',
    countryIso: 'AUS',
    methodologyVersion: '1.0.0',
    a11ValueRaw: 'AUD 73,150',
    a11ValueCurrency: 'AUD',
    a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
    medianWage: AUS_MEDIAN,
    fxRate: AUD_FX,
  })!;
  const d22 = deriveD22({
    programId: 'test-prog',
    countryIso: 'AUS',
    methodologyVersion: '1.0.0',
    d11Boolean: true,
    d12Years: 2,
    d12SourceUrl: 'https://example.gov',
    citizenshipResidence: AUS_CITIZENSHIP,
  })!;

  it('A.1.2 derived row passes checkProvenanceRow on pending_review status', () => {
    const issues = checkProvenanceRow(a12.provenance, 'pending_review');
    expect(issues).toEqual([]);
  });

  it('D.2.2 derived row passes checkProvenanceRow on pending_review status', () => {
    const issues = checkProvenanceRow(d22.provenance, 'pending_review');
    expect(issues).toEqual([]);
  });

  it('extractionModel is the literal "derived-computation" (ADR-016 invariant)', () => {
    expect(a12.provenance.extractionModel).toBe('derived-computation');
    expect(d22.provenance.extractionModel).toBe('derived-computation');
    expect(DERIVE_EXTRACTION_MODEL).toBe('derived-computation');
  });

  it('extractionConfidence is hard-coded to 0.6 (ADR-016 invariant)', () => {
    expect(a12.provenance.extractionConfidence).toBe(0.6);
    expect(d22.provenance.extractionConfidence).toBe(0.6);
    expect(a12.extraction.extractionConfidence).toBe(0.6);
    expect(d22.extraction.extractionConfidence).toBe(0.6);
    expect(DERIVE_CONFIDENCE).toBe(0.6);
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    expect(a12.provenance.extractionConfidence).toBeLessThan(0.85);
    expect(a12.provenance.validationConfidence).toBeLessThan(0.85);
  });

  it('sourceTier is null (no real source)', () => {
    expect(a12.provenance.sourceTier).toBeNull();
    expect(d22.provenance.sourceTier).toBeNull();
  });

  it('sourceUrl is the derived-computation marker', () => {
    expect(a12.provenance.sourceUrl).toBe('derived-computation:A.1.2');
    expect(d22.provenance.sourceUrl).toBe('derived-computation:D.2.2');
  });

  it('derivedInputs JSONB extension carries the input values', () => {
    const a12Inputs = (a12.provenance as unknown as { derivedInputs: Record<string, unknown> })
      .derivedInputs;
    expect(a12Inputs).toHaveProperty('A.1.1');
    expect(a12Inputs).toHaveProperty('medianWage');
    expect(a12Inputs).toHaveProperty('fxRate');
    const d22Inputs = (d22.provenance as unknown as { derivedInputs: Record<string, unknown> })
      .derivedInputs;
    expect(d22Inputs).toHaveProperty('D.1.2');
    expect(d22Inputs).toHaveProperty('D.1.1');
    expect(d22Inputs).toHaveProperty('citizenshipResidence');
  });
});
