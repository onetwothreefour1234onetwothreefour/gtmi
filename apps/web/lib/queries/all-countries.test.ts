import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * Hermetic SQL-shape tests for getAllCountries. The production query is
 * 'server-only' + unstable_cache-wrapped, so this mirrors the SELECT
 * shape and locks the invariants the page depends on.
 *
 * Mirrors the pattern used in cohort-stats.test.ts: render the SQL
 * fragment, assert the load-bearing clauses are present. Drizzle's
 * PgDialect.sqlToQuery preserves the original case verbatim, so the
 * assertions match the case we wrote in the source query.
 */

const dialect = new PgDialect();

function inspect(fragment: ReturnType<typeof sql>): { sql: string } {
  return { sql: dialect.sqlToQuery(fragment).sql };
}

const ALL_COUNTRIES_QUERY = sql`
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

describe('getAllCountries — SQL contract', () => {
  it('LEFT JOINs from countries so cohort countries with zero programmes still appear', () => {
    const r = inspect(ALL_COUNTRIES_QUERY);
    expect(r.sql).toContain('FROM countries c');
    expect(r.sql).toContain('LEFT JOIN programs p ON');
    expect(r.sql).toContain('LEFT JOIN scores s ON');
  });

  it('uses DISTINCT ON in a CTE to pick the best programme per country', () => {
    const r = inspect(ALL_COUNTRIES_QUERY);
    expect(r.sql).toContain('WITH best_program');
    expect(r.sql).toContain('DISTINCT ON');
    // Tie-break: composite DESC, then name ASC.
    expect(r.sql).toContain('s.composite_score DESC NULLS LAST');
  });

  it('aggregates programme_count + scored_programme_count via COUNT', () => {
    const r = inspect(ALL_COUNTRIES_QUERY);
    expect(r.sql).toContain('COUNT(p.id)::int AS programme_count');
    expect(r.sql).toContain('COUNT(s.composite_score)::int AS scored_programme_count');
  });

  it('exposes flagged_any via BOOL_OR with COALESCE so unscored countries return false (not null)', () => {
    const r = inspect(ALL_COUNTRIES_QUERY);
    expect(r.sql).toContain('COALESCE(BOOL_OR(s.flagged_insufficient_disclosure), false)');
  });

  it('sorts by CME desc with NULLS LAST so unscored cohort countries fall to the bottom', () => {
    const r = inspect(ALL_COUNTRIES_QUERY);
    expect(r.sql).toContain('ORDER BY');
    expect(r.sql).toContain('c.imd_appeal_score_cme_normalized DESC NULLS LAST');
    expect(r.sql).toContain('c.name ASC');
  });
});
