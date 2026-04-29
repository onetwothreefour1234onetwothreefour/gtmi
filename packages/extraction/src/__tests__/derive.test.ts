import { describe, expect, it } from 'vitest';
import {
  DERIVE_CONFIDENCE,
  DERIVE_EXTRACTION_MODEL,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  deriveA12,
  deriveB24,
  deriveD13,
  deriveD14,
  deriveD22,
} from '../stages/derive';
import type {
  CitizenshipResidenceEntry,
  FxRateEntry,
  MedianWageEntry,
  NonGovCostsPolicyEntry,
  PrPresencePolicyEntry,
} from '../stages/derive';
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
  it('computes salary as % of local median wage with correct arithmetic (annual source sentence)', () => {
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      a11ValueRaw: 'AUD 73,150',
      a11ValueCurrency: 'AUD',
      a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      a11SourceSentence:
        'The annual income threshold is currently AUD 73,150 per year for the Core Skills Stream.',
      medianWage: AUS_MEDIAN,
      fxRate: AUD_FX,
    });
    expect(r).not.toBeNull();
    // 73150 / 1.518 = 48,188.40 USD ; / 60,200 * 100 = 80.0%
    expect(r!.numericValue).toBeCloseTo(80.0, 1);
    expect(r!.extraction.fieldDefinitionKey).toBe('A.1.2');
    expect(r!.extraction.valueRaw).toBe(String(r!.numericValue));
  });

  it('handles USD directly without FX conversion (annual source sentence)', () => {
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'USA',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '60000',
      a11ValueCurrency: 'USD',
      a11SourceUrl: 'https://uscis.gov/...',
      a11SourceSentence: 'The annual prevailing wage is USD 60,000 per year.',
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
    a11SourceSentence: 'AUD 73,150 per year (annual)',
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
    // Phase 3.6.6 / FIX 1 — "0" no longer skips; it triggers the
    // points-based `not_applicable` row instead (covered below).
    expect(deriveA12({ ...baseValid, a11ValueRaw: '-100' })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// A.1.2 — Phase 3.6.6 / FIX 1 — points-based not_applicable
// ────────────────────────────────────────────────────────────────────

describe('deriveA12 — points-based not_applicable (FIX 1, country-agnostic)', () => {
  const baseValid = {
    programId: 'test-prog',
    countryIso: 'CAN',
    methodologyVersion: '1.0.0',
    a11ValueRaw: '0',
    a11ValueCurrency: null,
    a11SourceUrl: 'https://www.canada.ca/...',
    a11SourceSentence: 'No fixed salary threshold; points-based system.',
    medianWage: { ...AUS_MEDIAN, iso3: 'CAN', medianWageUsd: 56_000 },
    fxRate: null,
  };

  it('writes a not_applicable row when A.1.1 valueRaw is "0"', () => {
    const r = deriveA12({ ...baseValid, a11ValueRaw: '0' });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('A.1.2');
    expect(r!.extraction.valueRaw).toBe('not_applicable');
    expect(r!.extraction.extractionModel).toBe('derived-knowledge');
    expect(r!.extraction.extractionConfidence).toBe(0.9);
    expect(r!.provenance.sourceUrl).toBe('derived:points-based-program-type');
    expect(r!.provenance.sourceSentence).toContain('points-based');
  });

  it('writes a not_applicable row when A.1.3 = "no_salary_route"', () => {
    const r = deriveA12({
      ...baseValid,
      a11ValueRaw: 'AUD 73,150',
      a13ValueRaw: 'no_salary_route',
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).toBe('not_applicable');
  });

  it('writes a not_applicable row when A.1.3 = "points_only"', () => {
    const r = deriveA12({ ...baseValid, a11ValueRaw: 'AUD 73,150', a13ValueRaw: 'points_only' });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).toBe('not_applicable');
  });

  it('writes a not_applicable row when A.1.3 = "not_required"', () => {
    const r = deriveA12({ ...baseValid, a11ValueRaw: 'AUD 73,150', a13ValueRaw: 'not_required' });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).toBe('not_applicable');
  });

  it('takes the normal derive path when A.1.1 has a positive value with a valid currency (AUS case unchanged)', () => {
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '73150',
      a11ValueCurrency: 'AUD',
      a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      a11SourceSentence:
        'The annual income threshold is currently AUD 73,150 per year for the Core Skills Stream.',
      a13ValueRaw: 'salary_required',
      medianWage: AUS_MEDIAN,
      fxRate: AUD_FX,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('A.1.2');
    expect(r!.extraction.valueRaw).not.toBe('not_applicable');
    expect(r!.extraction.extractionModel).toBe('derived-computation');
    // 73150 / 1.518 / 60200 * 100 ≈ 80.0 (annual sentence → not annualised again)
    expect(r!.numericValue).toBeCloseTo(80.0, 1);
  });

  it('takes the normal derive path with monthly annualisation (SGP case unchanged)', () => {
    const SGP_MEDIAN: MedianWageEntry = {
      iso3: 'SGP',
      usdYear: 2023,
      medianWageUsd: 60_000,
      source: 'OECD',
      sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
    };
    const SGD_FX: FxRateEntry = {
      code: 'SGD',
      year: 2024,
      lcuPerUsd: 1.34,
      sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
    };
    const r = deriveA12({
      programId: 'test-prog',
      countryIso: 'SGP',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '3300',
      a11ValueCurrency: 'SGD',
      a11SourceUrl: 'https://www.mom.gov.sg/...',
      a11SourceSentence: 'Minimum qualifying salary is S$3,300 per month.',
      a13ValueRaw: 'salary_required',
      medianWage: SGP_MEDIAN,
      fxRate: SGD_FX,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).not.toBe('not_applicable');
    // 3300 * 12 / 1.34 / 60000 * 100 ≈ 49.3
    expect(r!.numericValue).toBeCloseTo(49.3, 1);
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
    a11SourceSentence: 'AUD 73,150 per year (annual)',
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

// Phase 3.6.2 / ITEM 2 — B.2.4 / D.1.3 / D.1.4 country-level derives.

const B24_AUS: NonGovCostsPolicyEntry = {
  iso3: 'AUS',
  hasMandatoryNonGovCosts: true,
  notes: 'Mandatory health insurance and skills assessment fees apply.',
  sourceUrl:
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skill-in-demand-482',
  sourceYear: 2025,
};

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

describe('deriveB24 — mandatory non-gov costs', () => {
  it('returns null when policy is null', () => {
    expect(
      deriveB24({
        programId: 'p1',
        countryIso: 'XYZ',
        methodologyVersion: '1.0.0',
        policy: null,
      })
    ).toBeNull();
  });

  it('returns null when hasMandatoryNonGovCosts is null (unknown)', () => {
    expect(
      deriveB24({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '1.0.0',
        policy: { ...B24_AUS, hasMandatoryNonGovCosts: null },
      })
    ).toBeNull();
  });

  it('produces a derived-knowledge row at confidence 0.7', () => {
    const r = deriveB24({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: B24_AUS,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('B.2.4');
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
    const parsed = JSON.parse(r!.extraction.valueRaw);
    expect(parsed).toEqual({
      hasMandatoryNonGovCosts: true,
      notes: B24_AUS.notes,
    });
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    const r = deriveB24({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: B24_AUS,
    });
    expect(r!.provenance.extractionConfidence).toBeLessThan(0.85);
    expect(r!.provenance.sourceTier).toBeNull();
  });
});

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

// Phase 3.6.5 — A.1.2 monthly/annual unit detection.
describe('deriveA12 — Phase 3.6.5 monthly/annual unit detection', () => {
  // SGP-style monthly threshold. S$3,300/month ≈ S$39,600/yr.
  // 39600 / 1.34 SGD/USD ≈ 29,552 USD; / 60,000 USD median × 100 ≈ 49.3%.
  const SGP_MEDIAN = {
    iso3: 'SGP',
    usdYear: 2023,
    medianWageUsd: 60_000,
    source: 'OECD' as const,
    sourceUrl: 'https://stats.oecd.org/...',
  };
  const SGD_FX = {
    code: 'SGD',
    year: 2024,
    lcuPerUsd: 1.34,
    sourceUrl: 'https://data.worldbank.org/...',
  };

  it('monthly source sentence → annualises (×12) before compute', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'SGP',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '3300',
      a11ValueCurrency: 'SGD',
      a11SourceUrl: 'https://www.mom.gov.sg/passes-and-permits/s-pass',
      a11SourceSentence:
        'The S Pass minimum qualifying salary is at least S$3,300 per month for new applicants.',
      medianWage: SGP_MEDIAN,
      fxRate: SGD_FX,
    });
    expect(r).not.toBeNull();
    // 3300 × 12 = 39,600 SGD/yr ÷ 1.34 SGD/USD ≈ 29,552 USD ÷ 60,000 × 100 ≈ 49.3%
    expect(r!.numericValue).toBeCloseTo(49.3, 0);
  });

  it('annual source sentence → uses raw value as-is', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      a11ValueRaw: 'AUD 73,150',
      a11ValueCurrency: 'AUD',
      a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      a11SourceSentence:
        'The annual income threshold is AUD 73,150 per year (TSMIT for the Core Skills Stream).',
      medianWage: AUS_MEDIAN,
      fxRate: AUD_FX,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBeCloseTo(80.0, 1);
  });

  it('ambiguous source sentence → annualises (safe default ×12)', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'SGP',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '3300',
      a11ValueCurrency: 'SGD',
      a11SourceUrl: 'https://www.mom.gov.sg/passes-and-permits/s-pass',
      a11SourceSentence: 'The minimum qualifying salary is S$3,300.',
      medianWage: SGP_MEDIAN,
      fxRate: SGD_FX,
    });
    expect(r).not.toBeNull();
    // Ambiguous → ×12, so SGP comes out at the same ~49% as the monthly test.
    expect(r!.numericValue).toBeCloseTo(49.3, 0);
  });

  it('null source sentence → ambiguous → annualises (safe default ×12)', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'SGP',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '3300',
      a11ValueCurrency: 'SGD',
      a11SourceUrl: 'https://www.mom.gov.sg/passes-and-permits/s-pass',
      a11SourceSentence: null,
      medianWage: SGP_MEDIAN,
      fxRate: SGD_FX,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBeCloseTo(49.3, 0);
  });

  it('AUS annual stays unchanged (~80%) — sanity check existing happy path', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      a11ValueRaw: 'AUD 73,150',
      a11ValueCurrency: 'AUD',
      a11SourceUrl: 'https://immi.homeaffairs.gov.au/...',
      a11SourceSentence: 'AUD 73,150 per annum (TSMIT)',
      medianWage: AUS_MEDIAN,
      fxRate: AUD_FX,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBeCloseTo(80.0, 1);
  });

  it('SGP monthly produces ~49% (regression guard against the 4.1% pre-fix bug)', () => {
    const r = deriveA12({
      programId: 'test',
      countryIso: 'SGP',
      methodologyVersion: '1.0.0',
      a11ValueRaw: '3300',
      a11ValueCurrency: 'SGD',
      a11SourceUrl: 'https://www.mom.gov.sg/passes-and-permits/s-pass',
      a11SourceSentence: 'S$3,300 per month',
      medianWage: SGP_MEDIAN,
      fxRate: SGD_FX,
    });
    expect(r).not.toBeNull();
    // The pre-fix value was 4.1% (×1 instead of ×12). Anything below ~10%
    // would indicate the annualisation regressed.
    expect(r!.numericValue).toBeGreaterThan(40);
    expect(r!.numericValue).toBeLessThan(60);
  });
});

import { detectSalaryUnit } from '../stages/derive';
describe('detectSalaryUnit — Phase 3.6.5 unit-cue parser', () => {
  it('detects monthly cues', () => {
    expect(detectSalaryUnit('S$3,300 per month')).toBe('monthly');
    expect(detectSalaryUnit('SGD 3300/month')).toBe('monthly');
    expect(detectSalaryUnit('Salary p.m. is 3300')).toBe('monthly');
    expect(detectSalaryUnit('Monthly salary requirement')).toBe('monthly');
  });
  it('detects annual cues', () => {
    expect(detectSalaryUnit('AUD 73,150 per year')).toBe('annual');
    expect(detectSalaryUnit('Annual income threshold')).toBe('annual');
    expect(detectSalaryUnit('p.a. 73150')).toBe('annual');
    expect(detectSalaryUnit('USD 60,000 per annum')).toBe('annual');
  });
  it('returns ambiguous when neither cue is present', () => {
    expect(detectSalaryUnit('S$3,300 minimum')).toBe('ambiguous');
    expect(detectSalaryUnit('')).toBe('ambiguous');
    expect(detectSalaryUnit(null)).toBe('ambiguous');
    expect(detectSalaryUnit(undefined)).toBe('ambiguous');
  });
  it('biases to monthly when both cues co-occur (e.g. "S$3,300/month, equivalent to ~S$39,600/year")', () => {
    expect(detectSalaryUnit('S$3,300/month, equivalent to ~S$39,600 per year')).toBe('monthly');
  });
});
