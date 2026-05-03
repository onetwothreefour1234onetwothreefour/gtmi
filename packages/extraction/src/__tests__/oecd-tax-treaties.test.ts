import { describe, expect, it } from 'vitest';
import { OECD_TAX_TREATIES, getTaxTreaty, listTreatiesForCountry } from '../data/oecd-tax-treaties';

// Phase 3.10c.8 — scaffold tests. The full 30×30 matrix lands in
// Phase 7; today's stub covers six demonstration pairs.

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
