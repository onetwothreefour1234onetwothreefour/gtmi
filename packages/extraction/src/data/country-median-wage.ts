// Phase 3.6 / Fix D — country median (or mean as fallback) gross full-time
// wage in USD, used by the derive stage (Stage 6.5) to compute A.1.2:
// "Salary threshold as % of local median wage".
//
// Source preference (per analyst Q3 decision): OECD Earnings Database for
// OECD members; ILOSTAT mean-earnings series fallback for non-OECD members
// only. Methodological consistency over recency.
//
// Each row is hand-curated from the cited source URL and pinned to the
// latest year available at table-build time, capped at 2024. Values are
// rounded to the nearest USD 100 for stability across minor revisions.
//
// Refresh discipline: same as scripts/country-sources.ts. Hand-edited;
// PR-reviewed; refreshed once a year in line with IMD's annual cycle.
// A future Phase 7 script (`scripts/refresh-median-wage-table.ts`) will
// programmatically refresh against OECD + ILO APIs.
//
// IMPORTANT: A.1.2 derived rows are written with confidence 0.6 so they
// always route to /review per ADR-013. Any mis-curation in this table
// surfaces before public publication.

export interface MedianWage {
  iso3: string;
  /** Year the wage figure was published / referenced. */
  usdYear: number;
  /** Gross median (or mean fallback) annual wage in USD. */
  medianWageUsd: number;
  /** Authoritative source. */
  source: 'OECD' | 'ILO';
  sourceUrl: string;
}

export const COUNTRY_MEDIAN_WAGE: Record<string, MedianWage> = {
  // ─────────────────────────────────────────────────────────────────
  // OECD members (Q3: OECD takes precedence)
  // OECD AAW (Average Annual Wages), latest published USD
  // https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE
  // ─────────────────────────────────────────────────────────────────
  AUS: {
    iso3: 'AUS',
    usdYear: 2023,
    medianWageUsd: 60200,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  AUT: {
    iso3: 'AUT',
    usdYear: 2023,
    medianWageUsd: 60000,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  BEL: {
    iso3: 'BEL',
    usdYear: 2023,
    medianWageUsd: 65300,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  CAN: {
    iso3: 'CAN',
    usdYear: 2023,
    medianWageUsd: 59700,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  CHE: {
    iso3: 'CHE',
    usdYear: 2023,
    medianWageUsd: 73400,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  CHL: {
    iso3: 'CHL',
    usdYear: 2023,
    medianWageUsd: 32100,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  DEU: {
    iso3: 'DEU',
    usdYear: 2023,
    medianWageUsd: 60600,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  EST: {
    iso3: 'EST',
    usdYear: 2023,
    medianWageUsd: 36800,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  FIN: {
    iso3: 'FIN',
    usdYear: 2023,
    medianWageUsd: 50600,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  FRA: {
    iso3: 'FRA',
    usdYear: 2023,
    medianWageUsd: 52800,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  GBR: {
    iso3: 'GBR',
    usdYear: 2023,
    medianWageUsd: 53400,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  IRL: {
    iso3: 'IRL',
    usdYear: 2023,
    medianWageUsd: 64600,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  ISL: {
    iso3: 'ISL',
    usdYear: 2023,
    medianWageUsd: 79500,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  JPN: {
    iso3: 'JPN',
    usdYear: 2023,
    medianWageUsd: 46300,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  LTU: {
    iso3: 'LTU',
    usdYear: 2023,
    medianWageUsd: 36600,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  LUX: {
    iso3: 'LUX',
    usdYear: 2023,
    medianWageUsd: 81100,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  NLD: {
    iso3: 'NLD',
    usdYear: 2023,
    medianWageUsd: 71500,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  NOR: {
    iso3: 'NOR',
    usdYear: 2023,
    medianWageUsd: 68000,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  NZL: {
    iso3: 'NZL',
    usdYear: 2023,
    medianWageUsd: 51200,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  SWE: {
    iso3: 'SWE',
    usdYear: 2023,
    medianWageUsd: 50400,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },
  USA: {
    iso3: 'USA',
    usdYear: 2023,
    medianWageUsd: 80000,
    source: 'OECD',
    sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
  },

  // ─────────────────────────────────────────────────────────────────
  // Non-OECD members (Q3: ILO fallback only)
  // ILOSTAT mean monthly earnings × 12, year-average USD conversion
  // https://ilostat.ilo.org/topics/wages/
  // ─────────────────────────────────────────────────────────────────
  ARE: {
    iso3: 'ARE',
    usdYear: 2023,
    medianWageUsd: 39000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  BHR: {
    iso3: 'BHR',
    usdYear: 2023,
    medianWageUsd: 18000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  HKG: {
    iso3: 'HKG',
    usdYear: 2023,
    medianWageUsd: 31000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  MYS: {
    iso3: 'MYS',
    usdYear: 2023,
    medianWageUsd: 8400,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  NAM: {
    iso3: 'NAM',
    usdYear: 2023,
    medianWageUsd: 8200,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  OMN: {
    iso3: 'OMN',
    usdYear: 2023,
    medianWageUsd: 22000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  SAU: {
    iso3: 'SAU',
    usdYear: 2023,
    medianWageUsd: 25000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  SGP: {
    iso3: 'SGP',
    usdYear: 2023,
    medianWageUsd: 60000,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
  TWN: {
    iso3: 'TWN',
    usdYear: 2023,
    medianWageUsd: 23500,
    source: 'ILO',
    sourceUrl: 'https://ilostat.ilo.org/topics/wages/',
  },
};

export function getMedianWage(iso3: string): MedianWage | null {
  return COUNTRY_MEDIAN_WAGE[iso3] ?? null;
}
