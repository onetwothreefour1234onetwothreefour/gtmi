import { describe, expect, it } from 'vitest';
import { COUNTRY_MEDIAN_WAGE } from '../../../scripts/country-median-wage';
import { COUNTRY_CITIZENSHIP_RESIDENCE_YEARS } from '../../../scripts/country-citizenship-residence';
import { FX_RATES } from '../../../scripts/fx-rates';

// Phase 3.6 / Fix D — static cohort-completeness assertions for the
// derived-fields lookup tables.
//
// The 30-country cohort is the IMD World Talent Ranking Top 30 (per
// methodology v1 §4.2). Every country in this cohort must have an entry
// in COUNTRY_MEDIAN_WAGE and COUNTRY_CITIZENSHIP_RESIDENCE_YEARS so that
// A.1.2 / D.2.2 derivation never silently skips a cohort country.
//
// A live-DB version of the is_primary=true Tier 1 assertion ships in
// scripts/check-median-wage-coverage.ts and is run pre-canary.

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

describe('COUNTRY_MEDIAN_WAGE — cohort completeness (Phase 3.6 / Fix D)', () => {
  it('every cohort ISO3 has an entry', () => {
    const missing = COHORT_ISO3.filter((iso) => !COUNTRY_MEDIAN_WAGE[iso]);
    expect(missing).toEqual([]);
  });

  it('every entry has medianWageUsd > 0', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_MEDIAN_WAGE)) {
      expect(entry.medianWageUsd, `${iso} medianWageUsd`).toBeGreaterThan(0);
    }
  });

  it('every entry year is ≤ 2024 (table is reproducible / stable)', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_MEDIAN_WAGE)) {
      expect(entry.usdYear, `${iso} usdYear`).toBeLessThanOrEqual(2024);
    }
  });

  it('OECD source preference (Q3): all OECD members in cohort use OECD, not ILO', () => {
    const OECD_IN_COHORT = [
      'AUS',
      'AUT',
      'BEL',
      'CAN',
      'CHE',
      'CHL',
      'DEU',
      'EST',
      'FIN',
      'FRA',
      'GBR',
      'IRL',
      'ISL',
      'JPN',
      'LTU',
      'LUX',
      'NLD',
      'NOR',
      'NZL',
      'SWE',
      'USA',
    ];
    for (const iso of OECD_IN_COHORT) {
      expect(COUNTRY_MEDIAN_WAGE[iso]?.source, `${iso} source`).toBe('OECD');
    }
  });

  it('non-OECD members fall back to ILO', () => {
    const NON_OECD_IN_COHORT = ['ARE', 'BHR', 'HKG', 'MYS', 'NAM', 'OMN', 'SAU', 'SGP', 'TWN'];
    for (const iso of NON_OECD_IN_COHORT) {
      expect(COUNTRY_MEDIAN_WAGE[iso]?.source, `${iso} source`).toBe('ILO');
    }
  });
});

describe('COUNTRY_CITIZENSHIP_RESIDENCE_YEARS — cohort completeness', () => {
  it('every cohort ISO3 has an entry (yearsAsPr may be null for no-pathway)', () => {
    const missing = COHORT_ISO3.filter((iso) => !COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[iso]);
    expect(missing).toEqual([]);
  });

  it('every non-null entry has yearsAsPr > 0', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_CITIZENSHIP_RESIDENCE_YEARS)) {
      if (entry.yearsAsPr !== null) {
        expect(entry.yearsAsPr, `${iso} yearsAsPr`).toBeGreaterThan(0);
      }
    }
  });

  it('null entries (no realistic pathway) include the GCC monarchies', () => {
    for (const iso of ['ARE', 'BHR', 'OMN', 'SAU']) {
      expect(COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[iso]?.yearsAsPr).toBeNull();
    }
  });
});

describe('FX_RATES — covers cohort currencies', () => {
  // Currencies attached to cohort countries (one per country; some shared).
  const COHORT_CURRENCIES = [
    'AUD',
    'EUR',
    'GBP',
    'CAD',
    'CHF',
    'JPY',
    'USD',
    'SGD',
    'HKD',
    'AED',
    'NZD',
    'NOK',
    'SEK',
    'ISK',
    'MYR',
    'CLP',
    'NAD',
    'OMR',
    'BHD',
    'SAR',
    'TWD',
  ];
  it('every cohort currency has a rate', () => {
    const missing = COHORT_CURRENCIES.filter((c) => !FX_RATES[c]);
    expect(missing).toEqual([]);
  });

  it('every rate is positive', () => {
    for (const [code, rate] of Object.entries(FX_RATES)) {
      expect(rate.lcuPerUsd, `${code} lcuPerUsd`).toBeGreaterThan(0);
    }
  });

  it('USD self-rate is exactly 1.0', () => {
    expect(FX_RATES.USD?.lcuPerUsd).toBe(1.0);
  });
});
