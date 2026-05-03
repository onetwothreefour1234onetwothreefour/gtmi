import { describe, expect, it } from 'vitest';
import {
  OECD_TAX_TREATIES,
  getTaxTreaty,
  getTreatyCoverage,
  listTreatiesForCountry,
} from '../data/oecd-tax-treaties';

// Phase 3.10c.8 / G.1 — expanded reference covering ~50 cohort pairs.

describe('OECD_TAX_TREATIES seed', () => {
  it('every entry has a non-empty sourceUrl', () => {
    for (const t of OECD_TAX_TREATIES) {
      expect(t.sourceUrl, `${t.iso3}↔${t.partnerIso3}`).toMatch(/^https?:\/\//);
    }
  });

  it('iso3 + partnerIso3 are 3-char uppercase', () => {
    const re = /^[A-Z]{3}$/;
    for (const t of OECD_TAX_TREATIES) {
      expect(re.test(t.iso3), `iso3=${t.iso3}`).toBe(true);
      expect(re.test(t.partnerIso3), `partnerIso3=${t.partnerIso3}`).toBe(true);
    }
  });

  it('inForceYear is null or a sane year (1950–2030)', () => {
    for (const t of OECD_TAX_TREATIES) {
      if (t.inForceYear !== null) {
        expect(t.inForceYear).toBeGreaterThanOrEqual(1950);
        expect(t.inForceYear).toBeLessThanOrEqual(2030);
      }
    }
  });
});

describe('getTaxTreaty', () => {
  it('returns the direct entry for a known pair', () => {
    const t = getTaxTreaty('AUS', 'GBR');
    expect(t).not.toBeNull();
    expect(t!.inForceYear).toBe(2003);
  });

  it('returns the reverse entry remapped when only the other direction is curated', () => {
    const t = getTaxTreaty('GBR', 'AUS');
    expect(t).not.toBeNull();
    expect(t!.iso3).toBe('GBR');
    expect(t!.partnerIso3).toBe('AUS');
    expect(t!.inForceYear).toBe(2003);
  });

  it('returns null when no entry exists for the pair', () => {
    expect(getTaxTreaty('AUS', 'OMN')).toBeNull();
    expect(getTaxTreaty('OMN', 'AUS')).toBeNull();
  });

  it('returns null when self-pair (no treaty with self)', () => {
    expect(getTaxTreaty('AUS', 'AUS')).toBeNull();
  });
});

describe('getTreatyCoverage', () => {
  const COHORT_30 = [
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

  it('reports the cohort size and total possible pairs', () => {
    const c = getTreatyCoverage(COHORT_30);
    expect(c.cohortSize).toBe(30);
    expect(c.totalPairs).toBe((30 * 29) / 2); // 435
  });

  it('reports modelled vs unmodelled pair counts that sum to totalPairs', () => {
    const c = getTreatyCoverage(COHORT_30);
    expect(c.modelledPairs + c.unmodelledPairs).toBe(c.totalPairs);
    expect(c.modelledPairs).toBeGreaterThan(0);
    // We expect ≤ activePairs; some entries are inactive (e.g. SGP-HKG).
    expect(c.activePairs).toBeLessThanOrEqual(c.modelledPairs);
  });

  it('only counts entries where both ISOs are in the cohort', () => {
    const tinyCohort = ['AUS', 'GBR'];
    const c = getTreatyCoverage(tinyCohort);
    expect(c.totalPairs).toBe(1);
    expect(c.modelledPairs).toBe(1);
    expect(c.activePairs).toBe(1);
  });
});

describe('listTreatiesForCountry', () => {
  it('returns all active treaties for AUS, perspective AUS', () => {
    const treaties = listTreatiesForCountry('AUS');
    expect(treaties.length).toBeGreaterThan(0);
    for (const t of treaties) {
      expect(t.iso3).toBe('AUS');
      expect(t.active).toBe(true);
    }
  });

  it('remaps reverse-keyed entries so iso3 always matches the queried country', () => {
    // GBR has no direct row but is the partner for AUS — listTreatiesForCountry
    // must surface the GBR perspective with iso3='GBR'.
    const treaties = listTreatiesForCountry('GBR');
    const aus = treaties.find((t) => t.partnerIso3 === 'AUS');
    expect(aus).toBeDefined();
    expect(aus!.iso3).toBe('GBR');
  });

  it('returns [] for countries with no treaties in the seed', () => {
    expect(listTreatiesForCountry('OMN')).toEqual([]);
  });
});
