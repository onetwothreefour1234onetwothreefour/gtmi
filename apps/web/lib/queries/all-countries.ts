import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';

/**
 * Per-country aggregates for the public `/countries` index page.
 *
 * One LEFT JOIN per country across `programs` and `scores`, grouped to
 * give programme counts, the best composite, and average coverage.
 * The "best programme" id+name come from a DISTINCT-ON CTE so we get
 * a stable pick when two programmes tie on composite.
 *
 * Sort: highest CME score first; alphabetical fallback for unscored
 * cohort countries (so the cards are roughly editorial-ordered).
 */
export interface CountryIndexRow {
  iso: string;
  name: string;
  region: string;
  imdRank: number | null;
  cmeScore: number | null;
  programmeCount: number;
  scoredProgrammeCount: number;
  bestComposite: number | null;
  bestProgrammeName: string | null;
  bestProgrammeId: string | null;
  averageCoveragePct: number | null;
  flaggedAny: boolean;
}

interface RawCountryRow {
  iso: string;
  name: string;
  region: string;
  imd_rank: number | string | null;
  cme_score: number | string | null;
  programme_count: number | string;
  scored_programme_count: number | string;
  best_composite: number | string | null;
  best_programme_name: string | null;
  best_programme_id: string | null;
  average_coverage_pct: number | string | null;
  flagged_any: boolean | null;
}

function toInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.trunc(value);
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toFloatOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchAllCountries(): Promise<CountryIndexRow[]> {
  // best_program: per country, the programme with the highest composite
  // (DISTINCT ON breaks ties stably by the alphabetical programme name).
  // GROUP BY rolls the rest into per-country aggregates.
  const querySql = sql`
    WITH best_program AS (
      SELECT DISTINCT ON (p.country_iso)
        p.country_iso,
        p.id AS program_id,
        p.name AS program_name,
        s.composite_score AS composite
      FROM programs p
      JOIN scores s ON s.program_id = p.id
      WHERE s.composite_score IS NOT NULL
      ORDER BY p.country_iso, s.composite_score DESC NULLS LAST, p.name ASC
    )
    SELECT
      c.iso_code AS iso,
      c.name AS name,
      c.region AS region,
      c.imd_rank AS imd_rank,
      c.imd_appeal_score_cme_normalized AS cme_score,
      COUNT(p.id)::int AS programme_count,
      COUNT(s.composite_score)::int AS scored_programme_count,
      MAX(s.composite_score) AS best_composite,
      bp.program_name AS best_programme_name,
      bp.program_id AS best_programme_id,
      AVG(s.data_coverage_pct) AS average_coverage_pct,
      COALESCE(BOOL_OR(s.flagged_insufficient_disclosure), false) AS flagged_any
    FROM countries c
    LEFT JOIN programs p ON p.country_iso = c.iso_code
    LEFT JOIN scores s ON s.program_id = p.id
    LEFT JOIN best_program bp ON bp.country_iso = c.iso_code
    GROUP BY
      c.iso_code, c.name, c.region, c.imd_rank,
      c.imd_appeal_score_cme_normalized,
      bp.program_name, bp.program_id
    ORDER BY
      c.imd_appeal_score_cme_normalized DESC NULLS LAST,
      c.name ASC
  `;

  const raw = (await db.execute(querySql)) as unknown as RawCountryRow[];

  return raw.map((r) => ({
    iso: r.iso,
    name: r.name,
    region: r.region,
    imdRank: r.imd_rank === null || r.imd_rank === undefined ? null : toInt(r.imd_rank),
    cmeScore: toFloatOrNull(r.cme_score),
    programmeCount: toInt(r.programme_count),
    scoredProgrammeCount: toInt(r.scored_programme_count),
    bestComposite: toFloatOrNull(r.best_composite),
    bestProgrammeName: r.best_programme_name,
    bestProgrammeId: r.best_programme_id,
    averageCoveragePct: toFloatOrNull(r.average_coverage_pct),
    flaggedAny: Boolean(r.flagged_any),
  }));
}

/**
 * Cached wrapper. The query joins three tables and aggregates per
 * country, but cohort size is bounded (~30 countries) so the result
 * is small and cheap. 1h TTL matches the rest of the public-route
 * cache strategy. Tag invalidation: any pipeline write that bumps
 * `programs:all` or `scores:all` re-renders the index.
 */
export const getAllCountries = unstable_cache(async () => fetchAllCountries(), ['all-countries'], {
  revalidate: 3600,
  tags: ['programs:all', 'scores:all'],
});
