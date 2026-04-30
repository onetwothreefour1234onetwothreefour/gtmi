// Phase 3.9 / W21 — D.2.4 (civic-test burden), D.3.1 (tax-residency
// trigger days/yr), D.3.3 (territorial vs. worldwide taxation) derive
// tests + cohort completeness assertion against COUNTRY_PR_TIMELINE.

import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CIVIC_TEST_POLICY,
  COUNTRY_PR_TIMELINE,
  COUNTRY_TAX_BASIS,
  COUNTRY_TAX_RESIDENCY,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  deriveD24,
  deriveD31,
  deriveD33,
  type CivicTestPolicyEntry,
  type TaxBasisPolicyEntry,
  type TaxResidencyPolicyEntry,
} from '../index';

const AUS_CIVIC: CivicTestPolicyEntry = {
  iso3: 'AUS',
  burden: 'moderate',
  notes: 'Australian citizenship test plus competent English.',
  sourceUrl: 'https://immi.homeaffairs.gov.au/citizenship/citizenship-test-and-interview',
  sourceYear: 2024,
};

const ARE_CIVIC: CivicTestPolicyEntry = {
  iso3: 'ARE',
  burden: null,
  notes: 'No realistic naturalisation pathway.',
  sourceUrl: 'https://u.ae/...',
  sourceYear: 2024,
};

const AUS_TAX_RES: TaxResidencyPolicyEntry = {
  iso3: 'AUS',
  triggerDays: 183,
  notes: '183-day rule per ATO.',
  sourceUrl: 'https://www.ato.gov.au/...',
  sourceYear: 2024,
};

const NLD_TAX_RES: TaxResidencyPolicyEntry = {
  iso3: 'NLD',
  triggerDays: null,
  notes: 'Centre-of-life facts-and-circumstances test, no day-count threshold.',
  sourceUrl: 'https://www.belastingdienst.nl/...',
  sourceYear: 2024,
};

const USA_TAX_BASIS: TaxBasisPolicyEntry = {
  iso3: 'USA',
  basis: 'worldwide',
  notes: 'US tax residents are taxed on worldwide income.',
  sourceUrl: 'https://www.irs.gov/...',
  sourceYear: 2024,
};

const HKG_TAX_BASIS: TaxBasisPolicyEntry = {
  iso3: 'HKG',
  basis: 'territorial',
  notes: 'Salaries tax is territorial; only Hong Kong-source income.',
  sourceUrl: 'https://www.ird.gov.hk/...',
  sourceYear: 2024,
};

describe('deriveD24 — civic-test burden (Phase 3.9 / W21)', () => {
  it('AUS happy path: returns moderate burden as derived-knowledge', () => {
    const r = deriveD24({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_CIVIC,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.2.4');
    expect(r!.extraction.valueRaw).toBe('moderate');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
    expect(r!.provenance.sourceTier).toBeNull();
    expect(r!.provenance.sourceUrl).toBe(AUS_CIVIC.sourceUrl);
  });

  it('returns null when no policy entry exists for the country', () => {
    expect(
      deriveD24({
        programId: 'p1',
        countryIso: 'XYZ',
        methodologyVersion: '1.0.0',
        policy: null,
      })
    ).toBeNull();
  });

  it('returns null when burden is null (GCC: no naturalisation pathway)', () => {
    expect(
      deriveD24({
        programId: 'p1',
        countryIso: 'ARE',
        methodologyVersion: '1.0.0',
        policy: ARE_CIVIC,
      })
    ).toBeNull();
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    const r = deriveD24({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_CIVIC,
    });
    expect(r!.provenance.extractionConfidence).toBeLessThan(0.85);
  });
});

describe('deriveD31 — tax-residency trigger (Phase 3.9 / W21)', () => {
  it('AUS happy path: returns 183 days, numericValue=183', () => {
    const r = deriveD31({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_TAX_RES,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.3.1');
    expect(r!.extraction.valueRaw).toBe('183');
    expect(r!.numericValue).toBe(183);
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
  });

  it('returns null when triggerDays is null (NLD: facts-and-circumstances)', () => {
    expect(
      deriveD31({
        programId: 'p1',
        countryIso: 'NLD',
        methodologyVersion: '1.0.0',
        policy: NLD_TAX_RES,
      })
    ).toBeNull();
  });

  it('returns null when no policy entry exists for the country', () => {
    expect(
      deriveD31({
        programId: 'p1',
        countryIso: 'XYZ',
        methodologyVersion: '1.0.0',
        policy: null,
      })
    ).toBeNull();
  });
});

describe('deriveD33 — territorial vs. worldwide (Phase 3.9 / W21)', () => {
  it('USA happy path: returns worldwide categorical', () => {
    const r = deriveD33({
      programId: 'p1',
      countryIso: 'USA',
      methodologyVersion: '1.0.0',
      policy: USA_TAX_BASIS,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.3.3');
    expect(r!.extraction.valueRaw).toBe('worldwide');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
  });

  it('HKG happy path: territorial', () => {
    const r = deriveD33({
      programId: 'p1',
      countryIso: 'HKG',
      methodologyVersion: '1.0.0',
      policy: HKG_TAX_BASIS,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).toBe('territorial');
  });

  it('returns null when no policy entry exists', () => {
    expect(
      deriveD33({
        programId: 'p1',
        countryIso: 'XYZ',
        methodologyVersion: '1.0.0',
        policy: null,
      })
    ).toBeNull();
  });

  it('returns null when basis is null (unknown / contested)', () => {
    expect(
      deriveD33({
        programId: 'p1',
        countryIso: 'AAA',
        methodologyVersion: '1.0.0',
        policy: {
          iso3: 'AAA',
          basis: null,
          notes: 'unknown',
          sourceUrl: 'https://example.com/',
          sourceYear: 2024,
        },
      })
    ).toBeNull();
  });
});

describe('cohort completeness — country-agnostic mechanism + per-country data', () => {
  it('every country in COUNTRY_PR_TIMELINE has a COUNTRY_CIVIC_TEST_POLICY entry', () => {
    const missing: string[] = [];
    for (const iso3 of Object.keys(COUNTRY_PR_TIMELINE)) {
      if (!COUNTRY_CIVIC_TEST_POLICY[iso3]) missing.push(iso3);
    }
    expect(missing).toEqual([]);
  });

  it('every country in COUNTRY_PR_TIMELINE has a COUNTRY_TAX_RESIDENCY entry', () => {
    const missing: string[] = [];
    for (const iso3 of Object.keys(COUNTRY_PR_TIMELINE)) {
      if (!COUNTRY_TAX_RESIDENCY[iso3]) missing.push(iso3);
    }
    expect(missing).toEqual([]);
  });

  it('every country in COUNTRY_PR_TIMELINE has a COUNTRY_TAX_BASIS entry', () => {
    const missing: string[] = [];
    for (const iso3 of Object.keys(COUNTRY_PR_TIMELINE)) {
      if (!COUNTRY_TAX_BASIS[iso3]) missing.push(iso3);
    }
    expect(missing).toEqual([]);
  });

  it('all D.3.3 basis values are within the methodology-v1 categorical scale', () => {
    const allowed = new Set([
      'worldwide',
      'worldwide_with_remittance_basis',
      'territorial',
      'hybrid',
      null,
    ]);
    for (const [iso3, p] of Object.entries(COUNTRY_TAX_BASIS)) {
      expect(allowed.has(p.basis), `${iso3} basis=${p.basis}`).toBe(true);
    }
  });

  it('all D.2.4 burden values are within the methodology-v1 categorical scale', () => {
    const allowed = new Set(['none', 'light', 'moderate', 'heavy', null]);
    for (const [iso3, p] of Object.entries(COUNTRY_CIVIC_TEST_POLICY)) {
      expect(allowed.has(p.burden), `${iso3} burden=${p.burden}`).toBe(true);
    }
  });

  it('all D.3.1 triggerDays are sane (0-366) or null', () => {
    for (const [iso3, p] of Object.entries(COUNTRY_TAX_RESIDENCY)) {
      if (p.triggerDays !== null) {
        expect(p.triggerDays, `${iso3} triggerDays=${p.triggerDays}`).toBeGreaterThanOrEqual(0);
        expect(p.triggerDays, `${iso3} triggerDays=${p.triggerDays}`).toBeLessThanOrEqual(366);
      }
    }
  });
});
