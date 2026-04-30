import { describe, expect, it } from 'vitest';
import {
  COUNTRY_DEPARTMENTS,
  getCountryDepartments,
  renderCountryDepartmentsHint,
} from '../data/country-departments';
import { buildUserMessage } from '../stages/discover';

describe('country-departments lookup', () => {
  it('covers all 30 cohort ISO3 codes', () => {
    const cohort = [
      'AUS',
      'SGP',
      'CAN',
      'NLD',
      'JPN',
      'GBR',
      'CHE',
      'IRL',
      'LUX',
      'ISL',
      'DEU',
      'SWE',
      'BEL',
      'AUT',
      'ARE',
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
      'EST',
      'NZL',
      'BHR',
      'OMN',
    ];
    for (const iso of cohort) {
      expect(COUNTRY_DEPARTMENTS[iso], `missing entry for ${iso}`).toBeDefined();
      expect(COUNTRY_DEPARTMENTS[iso]?.iso3).toBe(iso);
    }
    expect(Object.keys(COUNTRY_DEPARTMENTS)).toHaveLength(cohort.length);
  });

  it('every entry has a tax authority and a citizenship authority', () => {
    for (const iso of Object.keys(COUNTRY_DEPARTMENTS)) {
      const d = COUNTRY_DEPARTMENTS[iso]!;
      expect(d.taxAuthority, `${iso} missing taxAuthority`).toBeTruthy();
      expect(d.citizenshipAuthority, `${iso} missing citizenshipAuthority`).toBeTruthy();
    }
  });

  it('getCountryDepartments returns null for an unknown ISO', () => {
    expect(getCountryDepartments('XYZ')).toBeNull();
  });
});

describe('renderCountryDepartmentsHint', () => {
  it('returns empty string for an unknown country', () => {
    expect(renderCountryDepartmentsHint('XYZ')).toBe('');
  });

  it('mentions the tax + citizenship hostnames for NLD', () => {
    const hint = renderCountryDepartmentsHint('NLD');
    expect(hint).toContain('NLD');
    expect(hint).toContain('belastingdienst.nl');
    expect(hint).toContain('ind.nl');
    expect(hint).toContain('Tax authority');
    expect(hint).toContain('Citizenship');
  });

  it('omits PR authority line when it equals citizenship authority (NLD case)', () => {
    // NLD: ind.nl handles both citizenship + PR. Hint should not duplicate.
    const hint = renderCountryDepartmentsHint('NLD');
    const matches = hint.match(/ind\.nl/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('JPN hint mentions ISA + NTA + MOJ separately', () => {
    const hint = renderCountryDepartmentsHint('JPN');
    expect(hint).toContain('isa.go.jp'); // PR pathway
    expect(hint).toContain('nta.go.jp'); // tax
    expect(hint).toContain('moj.go.jp'); // citizenship
  });
});

describe('buildUserMessage cross-departmental hint', () => {
  it('inlines the country-specific hint block into the Stage 0 prompt', () => {
    const msg = buildUserMessage('Highly Skilled Migrant Permit', 'NLD');
    expect(msg).toContain('belastingdienst.nl');
    expect(msg).toContain('COUNTRY-SPECIFIC AUTHORITY HOSTNAMES');
  });

  it('falls through cleanly when country is unmapped', () => {
    const msg = buildUserMessage('Imaginary Visa', 'XYZ');
    expect(msg).not.toContain('COUNTRY-SPECIFIC AUTHORITY HOSTNAMES');
    // The rest of the prompt body must still render.
    expect(msg).toContain('Find up to 15 of the most relevant');
  });

  it('does not duplicate the hint when a precision brief is also active', () => {
    const msg = buildUserMessage('HSM Permit', 'NLD', [], {
      missingFieldLabels: ['D.3.1 — Tax residency trigger'],
    });
    const hintMatches = msg.match(/COUNTRY-SPECIFIC AUTHORITY HOSTNAMES/g) ?? [];
    expect(hintMatches.length).toBe(1);
    expect(msg).toContain('PRECISION BRIEF');
  });
});
