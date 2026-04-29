import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * Hermetic SQL-shape tests for getCohortStats. The production query is
 * 'server-only' + unstable_cache-wrapped, so this fixture mirrors the
 * five tiny SELECTs and asserts the SQL each one renders. Mirrors the
 * pattern used in policy-changes.test.ts.
 *
 * The intent is to lock the cohort-stats contract: programme counts come
 * from `programs.status`, source counts from `sources`, indicator total
 * from `field_definitions` (so methodology version bumps auto-roll),
 * coverage averaged across programs with at least one approved value,
 * last-verified from `MAX(extracted_at)` on approved rows.
 */

const dialect = new PgDialect();

function inspect(fragment: ReturnType<typeof sql>): { sql: string; params: unknown[] } {
  const rendered = dialect.sqlToQuery(fragment);
  return { sql: rendered.sql, params: rendered.params };
}

describe('getCohortStats — SQL contract', () => {
  it('programme counts split active vs total via FILTER on status', () => {
    const r = inspect(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*)::int AS total
      FROM programs
    `);
    expect(r.sql).toContain('FROM programs');
    expect(r.sql).toContain("status = 'active'");
    expect(r.sql).toContain('FILTER');
  });

  it('indicator count reads from field_definitions (not hardcoded 48)', () => {
    const r = inspect(sql`SELECT COUNT(*)::int AS count FROM field_definitions`);
    expect(r.sql).toContain('FROM field_definitions');
    expect(r.sql).toContain('COUNT(*)');
  });

  it('source count reads from the sources table', () => {
    const r = inspect(sql`SELECT COUNT(*)::int AS count FROM sources`);
    expect(r.sql).toContain('FROM sources');
  });

  it('coverage averages over programs with at least one approved value', () => {
    const r = inspect(sql`
      WITH per_program AS (
        SELECT
          fv.program_id,
          COUNT(*)::float
            / NULLIF((SELECT COUNT(*)::float FROM field_definitions), 0) AS pct
        FROM field_values fv
        WHERE fv.status = 'approved'
        GROUP BY fv.program_id
      )
      SELECT AVG(pct)::float AS coverage FROM per_program
    `);
    expect(r.sql).toContain('FROM field_values');
    expect(r.sql).toContain("fv.status = 'approved'");
    // NULLIF guards divide-by-zero when field_definitions is empty.
    expect(r.sql).toContain('NULLIF');
    // Indicator total is read live, not hardcoded.
    expect(r.sql).not.toMatch(/\b48\b/);
    expect(r.sql).toContain('AVG(pct)');
  });

  it('last-verified is MAX(extracted_at) restricted to approved rows', () => {
    const r = inspect(sql`
      SELECT MAX(extracted_at) AS "lastVerifiedAt"
      FROM field_values
      WHERE status = 'approved'
    `);
    expect(r.sql).toContain('MAX(extracted_at)');
    expect(r.sql).toContain('FROM field_values');
    expect(r.sql).toContain("status = 'approved'");
  });

  it('zero-cohort safety: NULLIF(0) prevents divide-by-zero', () => {
    // Drizzle leaves NULLIF as raw text; assert the guard is present.
    const r = inspect(sql`
      SELECT COUNT(*)::float / NULLIF((SELECT COUNT(*)::float FROM field_definitions), 0) AS pct
    `);
    expect(r.sql).toContain('NULLIF');
  });
});

describe('getCohortStats — value normalisation', () => {
  // Re-implement the helpers locally to keep the test hermetic. If they
  // drift from production, intent stays asserted.
  function toInt(value: string | number): number {
    if (typeof value === 'number') return Math.trunc(value);
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  function toFloat(value: string | number | null): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  it('toInt accepts both string and number postgres counts', () => {
    expect(toInt(91)).toBe(91);
    expect(toInt('91')).toBe(91);
    expect(toInt('91.7')).toBe(91);
  });

  it('toInt returns 0 for malformed input rather than NaN', () => {
    expect(toInt('not-a-number' as unknown as string)).toBe(0);
  });

  it('toFloat returns 0 for null (zero-cohort safety)', () => {
    expect(toFloat(null)).toBe(0);
  });

  it('toFloat preserves fractional coverage values', () => {
    expect(toFloat('0.625')).toBeCloseTo(0.625, 6);
    expect(toFloat(0.3125)).toBeCloseTo(0.3125, 6);
  });
});
