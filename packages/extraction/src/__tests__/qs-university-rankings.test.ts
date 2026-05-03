import { describe, expect, it } from 'vitest';
import {
  QS_UNIVERSITIES,
  getCohortRankingSummaries,
  getCountryRankingSummary,
  getTopUniversitiesByCountry,
} from '../data/qs-university-rankings';

describe('QS_UNIVERSITIES seed', () => {
  it('every entry has a 3-letter uppercase ISO and a positive rank', () => {
    for (const u of QS_UNIVERSITIES) {
      expect(/^[A-Z]{3}$/.test(u.iso3), `iso3=${u.iso3}`).toBe(true);
      expect(u.rank).toBeGreaterThan(0);
      expect(u.year).toBeGreaterThanOrEqual(2020);
    }
  });

  it('overallScore, when set, is between 0 and 100', () => {
    for (const u of QS_UNIVERSITIES) {
      if (u.overallScore !== null) {
        expect(u.overallScore).toBeGreaterThanOrEqual(0);
        expect(u.overallScore).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('getTopUniversitiesByCountry', () => {
  it('returns top N entries ordered by rank for a known country', () => {
    const top3 = getTopUniversitiesByCountry('USA', 3);
    expect(top3).toHaveLength(3);
    expect(top3[0]!.rank).toBeLessThanOrEqual(top3[1]!.rank);
    expect(top3[1]!.rank).toBeLessThanOrEqual(top3[2]!.rank);
  });

  it('returns [] for a country with no modelled entries', () => {
    expect(getTopUniversitiesByCountry('OMN')).toEqual([]);
  });

  it('caps at the modelled count when fewer than N exist', () => {
    const all = getTopUniversitiesByCountry('NOR', 10);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThanOrEqual(10);
  });
});

describe('getCountryRankingSummary', () => {
  it('counts top-50 / top-100 / top-500 with the expected nesting', () => {
    const c = getCountryRankingSummary('USA');
    expect(c.top50Count).toBeLessThanOrEqual(c.top100Count);
    expect(c.top100Count).toBeLessThanOrEqual(c.top500Count);
    expect(c.top500Count).toBeLessThanOrEqual(c.totalUniversities);
  });

  it('returns Infinity bestRank when no entries are modelled', () => {
    const c = getCountryRankingSummary('OMN');
    expect(c.totalUniversities).toBe(0);
    expect(c.bestRank).toBe(Infinity);
  });
});

describe('getCohortRankingSummaries', () => {
  it('returns one row per cohort iso, in input order', () => {
    const summaries = getCohortRankingSummaries(['CHE', 'OMN', 'USA']);
    expect(summaries).toHaveLength(3);
    expect(summaries.map((s) => s.iso3)).toEqual(['CHE', 'OMN', 'USA']);
  });
});
