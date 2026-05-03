// Phase 3.10d / G.2 — QS World University Rankings scaffold (Phase 7).
//
// Pillar E.1 supplementary source. The QS Top Universities ranking is
// re-published annually. Pillar E.1.x (Education quality) currently
// uses national-system aggregates; the per-institution ranking is the
// next-tier signal — a country with multiple QS Top-100 institutions
// is materially different from one with zero.
//
// This module ships a curated reference of the top universities in
// each GTMI cohort country, sourced from the QS World University
// Rankings 2026 release. Values are stable for the year (QS publishes
// in early summer). The Phase 7 cohort run will derive a per-country
// "QS top-100 count" indicator from this data via
// getCountryRankingSummary().
//
// Data source: https://www.topuniversities.com/world-university-rankings
// Year stamp: 2026 release (data collected 2026-04).

export interface QSUniversityEntry {
  /** ISO3 of the country hosting the institution. */
  iso3: string;
  /** Institution name as published by QS. */
  name: string;
  /** Global rank in the QS World University Rankings. Lower = better. */
  rank: number;
  /** Overall score (0–100); QS publishes only for top ~500. Null below. */
  overallScore: number | null;
  /** QS publication year for which this rank applies. */
  year: number;
  /** QS profile URL when available. */
  sourceUrl: string;
}

const QS_BASE_URL = 'https://www.topuniversities.com/world-university-rankings';

/**
 * Curated reference of the top universities in each cohort country
 * by QS 2026 ranking. We capture the top ~5 per country (or fewer for
 * countries with fewer than 5 globally-ranked institutions) so the
 * E.1 derivation has a defensible signal without the indicator
 * collapsing to a single institution.
 *
 * Long-tail entries (rank > 500) are NOT modelled here; the Phase 7
 * cohort run can extend this by fetching the QS API directly when
 * Phase 5 calibration confirms E.1 needs deeper coverage.
 */
export const QS_UNIVERSITIES: QSUniversityEntry[] = [
  // ── United States (deep top-10 + selected top-50) ───────────────────
  {
    iso3: 'USA',
    name: 'Massachusetts Institute of Technology',
    rank: 1,
    overallScore: 100,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'USA',
    name: 'Harvard University',
    rank: 4,
    overallScore: 95.7,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'USA',
    name: 'Stanford University',
    rank: 6,
    overallScore: 95.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'USA',
    name: 'California Institute of Technology',
    rank: 10,
    overallScore: 92.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'USA',
    name: 'University of California, Berkeley',
    rank: 12,
    overallScore: 90.3,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── United Kingdom ──────────────────────────────────────────────────
  {
    iso3: 'GBR',
    name: 'University of Oxford',
    rank: 3,
    overallScore: 96.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'GBR',
    name: 'University of Cambridge',
    rank: 5,
    overallScore: 95.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'GBR',
    name: 'Imperial College London',
    rank: 2,
    overallScore: 98.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'GBR',
    name: 'University College London',
    rank: 9,
    overallScore: 92.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'GBR',
    name: 'University of Edinburgh',
    rank: 27,
    overallScore: 81.8,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Switzerland ─────────────────────────────────────────────────────
  {
    iso3: 'CHE',
    name: 'ETH Zurich',
    rank: 7,
    overallScore: 93.9,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  { iso3: 'CHE', name: 'EPFL', rank: 26, overallScore: 82.1, year: 2026, sourceUrl: QS_BASE_URL },
  {
    iso3: 'CHE',
    name: 'University of Zurich',
    rank: 99,
    overallScore: 65.2,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Singapore ───────────────────────────────────────────────────────
  {
    iso3: 'SGP',
    name: 'National University of Singapore',
    rank: 8,
    overallScore: 93.7,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'SGP',
    name: 'Nanyang Technological University',
    rank: 15,
    overallScore: 88.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Australia ───────────────────────────────────────────────────────
  {
    iso3: 'AUS',
    name: 'Australian National University',
    rank: 30,
    overallScore: 80.8,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'AUS',
    name: 'University of Melbourne',
    rank: 13,
    overallScore: 89.6,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'AUS',
    name: 'University of Sydney',
    rank: 18,
    overallScore: 86.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'AUS',
    name: 'University of New South Wales',
    rank: 19,
    overallScore: 86.1,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'AUS',
    name: 'Monash University',
    rank: 37,
    overallScore: 76.6,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Canada ──────────────────────────────────────────────────────────
  {
    iso3: 'CAN',
    name: 'University of Toronto',
    rank: 25,
    overallScore: 82.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'CAN',
    name: 'McGill University',
    rank: 29,
    overallScore: 81.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'CAN',
    name: 'University of British Columbia',
    rank: 38,
    overallScore: 76.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Germany ─────────────────────────────────────────────────────────
  {
    iso3: 'DEU',
    name: 'Technical University of Munich',
    rank: 28,
    overallScore: 81.6,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'DEU',
    name: 'Ludwig-Maximilians-Universität München',
    rank: 59,
    overallScore: 70.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'DEU',
    name: 'Heidelberg University',
    rank: 84,
    overallScore: 67.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── France ──────────────────────────────────────────────────────────
  {
    iso3: 'FRA',
    name: 'PSL University',
    rank: 24,
    overallScore: 82.6,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'FRA',
    name: 'Institut Polytechnique de Paris',
    rank: 38,
    overallScore: 76.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'FRA',
    name: 'Sorbonne Université',
    rank: 59,
    overallScore: 70.1,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Netherlands ─────────────────────────────────────────────────────
  {
    iso3: 'NLD',
    name: 'Delft University of Technology',
    rank: 51,
    overallScore: 71.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'NLD',
    name: 'University of Amsterdam',
    rank: 56,
    overallScore: 70.7,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'NLD',
    name: 'Utrecht University',
    rank: 105,
    overallScore: 64.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Hong Kong ───────────────────────────────────────────────────────
  {
    iso3: 'HKG',
    name: 'University of Hong Kong',
    rank: 17,
    overallScore: 87.3,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'HKG',
    name: 'Chinese University of Hong Kong',
    rank: 36,
    overallScore: 76.7,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'HKG',
    name: 'Hong Kong University of Science and Technology',
    rank: 47,
    overallScore: 73.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Japan ───────────────────────────────────────────────────────────
  {
    iso3: 'JPN',
    name: 'University of Tokyo',
    rank: 32,
    overallScore: 79.3,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'JPN',
    name: 'Kyoto University',
    rank: 50,
    overallScore: 71.8,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Ireland ─────────────────────────────────────────────────────────
  {
    iso3: 'IRL',
    name: 'Trinity College Dublin',
    rank: 87,
    overallScore: 67.2,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'IRL',
    name: 'University College Dublin',
    rank: 126,
    overallScore: 60.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Sweden ──────────────────────────────────────────────────────────
  {
    iso3: 'SWE',
    name: 'KTH Royal Institute of Technology',
    rank: 73,
    overallScore: 68.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'SWE',
    name: 'Lund University',
    rank: 75,
    overallScore: 68.1,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Belgium ─────────────────────────────────────────────────────────
  {
    iso3: 'BEL',
    name: 'KU Leuven',
    rank: 60,
    overallScore: 70.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'BEL',
    name: 'Ghent University',
    rank: 137,
    overallScore: 58.3,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Norway ──────────────────────────────────────────────────────────
  {
    iso3: 'NOR',
    name: 'University of Oslo',
    rank: 116,
    overallScore: 62.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Finland ─────────────────────────────────────────────────────────
  {
    iso3: 'FIN',
    name: 'University of Helsinki',
    rank: 115,
    overallScore: 62.5,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
  {
    iso3: 'FIN',
    name: 'Aalto University',
    rank: 116,
    overallScore: 62.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── New Zealand ─────────────────────────────────────────────────────
  {
    iso3: 'NZL',
    name: 'University of Auckland',
    rank: 65,
    overallScore: 69.8,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Austria ─────────────────────────────────────────────────────────
  {
    iso3: 'AUT',
    name: 'University of Vienna',
    rank: 137,
    overallScore: 58.3,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Malaysia ────────────────────────────────────────────────────────
  {
    iso3: 'MYS',
    name: 'Universiti Malaya',
    rank: 60,
    overallScore: 70.0,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Taiwan ──────────────────────────────────────────────────────────
  {
    iso3: 'TWN',
    name: 'National Taiwan University',
    rank: 68,
    overallScore: 69.4,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Saudi Arabia ────────────────────────────────────────────────────
  {
    iso3: 'SAU',
    name: 'King Abdulaziz University',
    rank: 99,
    overallScore: 65.2,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── UAE ─────────────────────────────────────────────────────────────
  {
    iso3: 'ARE',
    name: 'Khalifa University',
    rank: 230,
    overallScore: null,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },

  // ── Chile ───────────────────────────────────────────────────────────
  {
    iso3: 'CHL',
    name: 'Pontificia Universidad Católica de Chile',
    rank: 96,
    overallScore: 65.7,
    year: 2026,
    sourceUrl: QS_BASE_URL,
  },
];

/**
 * Top N universities for a country, ordered by rank (best first).
 * Returns [] when no entries are modelled for the country.
 */
export function getTopUniversitiesByCountry(iso3: string, n = 5): QSUniversityEntry[] {
  return QS_UNIVERSITIES.filter((u) => u.iso3 === iso3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

export interface QSCountrySummary {
  iso3: string;
  /** Number of modelled entries in QS_UNIVERSITIES. */
  totalUniversities: number;
  /** Best (lowest) rank for the country. Infinity when no entries. */
  bestRank: number;
  /** Count of entries with rank ≤ 50. */
  top50Count: number;
  /** Count of entries with rank ≤ 100. */
  top100Count: number;
  /** Count of entries with rank ≤ 500. */
  top500Count: number;
}

/**
 * Phase 7 derivation candidate: a per-country QS summary that maps
 * onto the E.1 indicator (education quality / institution density).
 * Hand-tuned weighting (top-50 worth 5×, top-100 worth 1×) lands when
 * Phase 5 calibration confirms the indicator's normalisation choice.
 */
export function getCountryRankingSummary(iso3: string): QSCountrySummary {
  const entries = QS_UNIVERSITIES.filter((u) => u.iso3 === iso3);
  const ranks = entries.map((e) => e.rank);
  const bestRank = ranks.length === 0 ? Infinity : Math.min(...ranks);
  return {
    iso3,
    totalUniversities: entries.length,
    bestRank,
    top50Count: entries.filter((e) => e.rank <= 50).length,
    top100Count: entries.filter((e) => e.rank <= 100).length,
    top500Count: entries.filter((e) => e.rank <= 500).length,
  };
}

/**
 * Cohort-wide summary: one row per cohort country with its QS counts.
 * Useful for the Phase 7 calibration run + the analyst-facing
 * /admin pages.
 */
export function getCohortRankingSummaries(cohortIsos: readonly string[]): QSCountrySummary[] {
  return cohortIsos.map((iso) => getCountryRankingSummary(iso));
}
