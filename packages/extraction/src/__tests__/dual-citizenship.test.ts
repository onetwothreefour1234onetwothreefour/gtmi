import { describe, expect, it } from 'vitest';
import {
  COUNTRY_DUAL_CITIZENSHIP_POLICY,
  getDualCitizenshipPolicy,
} from '../data/country-citizenship-policy';
import { deriveD23, DERIVE_KNOWLEDGE_CONFIDENCE, DERIVE_KNOWLEDGE_MODEL } from '../stages/derive';
import { checkProvenanceRow } from '@gtmi/shared';

// Phase 3.6.1 / FIX 6 — D.2.3 dual citizenship derive tests.

const COHORT_ISO3 = [
  'CHE',
  'NLD',
  'IRL',
  'LUX',
  'ISL',
  'DEU',
  'CAN',
  'SWE',
  'SGP',
  'BEL',
  'AUT',
  'ARE',
  'AUS',
  'JPN',
  'NOR',
  'TWN',
  'LTU',
  'USA',
  'FIN',
  'HKG',
  'MYS',
  'CHL',
  'SAU',
  'NAM',
  'FRA',
  'GBR',
  'EST',
  'NZL',
  'BHR',
  'OMN',
];

describe('COUNTRY_DUAL_CITIZENSHIP_POLICY — cohort completeness', () => {
  it('every cohort ISO3 has an entry', () => {
    const missing = COHORT_ISO3.filter((iso) => !COUNTRY_DUAL_CITIZENSHIP_POLICY[iso]);
    expect(missing).toEqual([]);
  });

  it('every entry has a non-empty sourceUrl', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_DUAL_CITIZENSHIP_POLICY)) {
      expect(entry.sourceUrl, `${iso} sourceUrl`).toBeTruthy();
      expect(entry.sourceUrl.length, `${iso} sourceUrl length`).toBeGreaterThan(10);
    }
  });

  it('every entry has sourceYear >= 2020', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_DUAL_CITIZENSHIP_POLICY)) {
      expect(entry.sourceYear, `${iso} sourceYear`).toBeGreaterThanOrEqual(2020);
    }
  });

  it('getDualCitizenshipPolicy returns null for unknown ISO3', () => {
    expect(getDualCitizenshipPolicy('XXX')).toBeNull();
  });

  it('getDualCitizenshipPolicy returns the policy for AUS (permitted=true)', () => {
    const p = getDualCitizenshipPolicy('AUS');
    expect(p).not.toBeNull();
    expect(p!.permitted).toBe(true);
  });

  it('getDualCitizenshipPolicy returns the policy for SGP (permitted=false)', () => {
    const p = getDualCitizenshipPolicy('SGP');
    expect(p).not.toBeNull();
    expect(p!.permitted).toBe(false);
  });
});

describe('deriveD23 — dual citizenship derive', () => {
  const baseInput = {
    programId: 'test-prog',
    methodologyVersion: '1.0.0',
  };

  it('writes a "permitted" row when policy.permitted=true (AUS)', () => {
    const r = deriveD23({
      ...baseInput,
      countryIso: 'AUS',
      policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.AUS!,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('D.2.3');
    expect(r!.extraction.valueRaw).toBe('permitted');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
  });

  it('writes a "not_permitted" row when policy.permitted=false (SGP)', () => {
    const r = deriveD23({
      ...baseInput,
      countryIso: 'SGP',
      policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.SGP!,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.valueRaw).toBe('not_permitted');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
  });

  it('skips when policy is null (no entry for country)', () => {
    expect(
      deriveD23({
        ...baseInput,
        countryIso: 'XXX',
        policy: null,
      })
    ).toBeNull();
  });

  it('skips when policy.permitted is null (contested/partial — EST)', () => {
    expect(
      deriveD23({
        ...baseInput,
        countryIso: 'EST',
        policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.EST!,
      })
    ).toBeNull();
  });

  it('skips when policy.permitted is null (NAM contested)', () => {
    expect(
      deriveD23({
        ...baseInput,
        countryIso: 'NAM',
        policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.NAM!,
      })
    ).toBeNull();
  });

  it('derived row passes checkProvenanceRow on pending_review', () => {
    const r = deriveD23({
      ...baseInput,
      countryIso: 'AUS',
      policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.AUS!,
    });
    expect(r).not.toBeNull();
    const issues = checkProvenanceRow(r!.provenance, 'pending_review');
    expect(issues).toEqual([]);
  });

  it('derived row sourceTier is null (matches country-substitute pattern)', () => {
    const r = deriveD23({
      ...baseInput,
      countryIso: 'CAN',
      policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.CAN!,
    });
    expect(r!.provenance.sourceTier).toBeNull();
  });

  it('derivedInputs JSONB carries permitted, sourceUrl, sourceYear', () => {
    const r = deriveD23({
      ...baseInput,
      countryIso: 'GBR',
      policy: COUNTRY_DUAL_CITIZENSHIP_POLICY.GBR!,
    });
    const inputs = (r!.provenance as unknown as { derivedInputs: Record<string, unknown> })
      .derivedInputs;
    expect(inputs).toHaveProperty('D.2.3');
    const d23 = inputs['D.2.3'] as Record<string, unknown>;
    expect(d23.permitted).toBe(true);
    expect(typeof d23.sourceUrl).toBe('string');
    expect(typeof d23.sourceYear).toBe('number');
  });
});
