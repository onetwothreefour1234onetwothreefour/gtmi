import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';

/**
 * Live cohort statistics for the landing-page stat strip.
 *
 * All five values are computed directly from the database on every cache
 * miss. Nothing is hardcoded, including the indicator total — we read it
 * off `field_definitions` so a methodology version bump auto-rolls.
 */
export interface CohortStats {
  /** Active programmes in the cohort. */
  programmesActive: number;
  /** Total programmes (all statuses) — for the "/ N total" caption when needed. */
  programmesTotal: number;
  /** Distinct field_definitions rows. Methodology v1 = 48. */
  indicatorsTotal: number;
  /** Distinct sources tracked across the cohort. */
  sourcesTotal: number;
  /** Average per-program coverage (approved field_values / 48), 0–1. */
  coverageAvg: number;
  /** MAX(extracted_at) across approved field_values. ISO string, or null. */
  lastVerifiedAt: string | null;
}

interface RawProgramCounts {
  active: string | number;
  total: string | number;
}

interface RawCount {
  count: string | number;
}

interface RawCoverage {
  coverage: string | number | null;
}

interface RawLastVerified {
  lastVerifiedAt: Date | string | null;
}

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

async function fetchCohortStats(): Promise<CohortStats> {
  // Five tiny aggregates in parallel. Each uses RLS-respected reads; the
  // public role only sees approved field_values, so coverage / last_verified_at
  // reflect what visitors are looking at on the dashboard.
  const programsSql = sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*)::int AS total
    FROM programs
  `;
  const indicatorsSql = sql`SELECT COUNT(*)::int AS count FROM field_definitions`;
  const sourcesSql = sql`SELECT COUNT(*)::int AS count FROM sources`;
  // Per-program coverage = approved field_values / total indicator definitions.
  // Average across programs that have at least one extraction. Programs with
  // zero approved values are excluded so the average isn't dragged down by
  // unscored cohort members.
  const coverageSql = sql`
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
  `;
  const lastVerifiedSql = sql`
    SELECT MAX(extracted_at) AS "lastVerifiedAt"
    FROM field_values
    WHERE status = 'approved'
  `;

  const [programsRaw, indicatorsRaw, sourcesRaw, coverageRaw, lastVerifiedRaw] = await Promise.all([
    db.execute(programsSql),
    db.execute(indicatorsSql),
    db.execute(sourcesSql),
    db.execute(coverageSql),
    db.execute(lastVerifiedSql),
  ]);

  const programs = (programsRaw as unknown as RawProgramCounts[])[0] ?? { active: 0, total: 0 };
  const indicators = (indicatorsRaw as unknown as RawCount[])[0] ?? { count: 0 };
  const sources = (sourcesRaw as unknown as RawCount[])[0] ?? { count: 0 };
  const coverage = (coverageRaw as unknown as RawCoverage[])[0] ?? { coverage: 0 };
  const lastVerified = (lastVerifiedRaw as unknown as RawLastVerified[])[0] ?? {
    lastVerifiedAt: null,
  };

  return {
    programmesActive: toInt(programs.active),
    programmesTotal: toInt(programs.total),
    indicatorsTotal: toInt(indicators.count),
    sourcesTotal: toInt(sources.count),
    coverageAvg: toFloat(coverage.coverage),
    lastVerifiedAt: lastVerified.lastVerifiedAt
      ? new Date(lastVerified.lastVerifiedAt).toISOString()
      : null,
  };
}

/**
 * Cached wrapper. Five aggregates is cheap, but the landing page hits this
 * on every render so we still amortise the round-trip across requests.
 * Tag invalidation: any pipeline write that bumps `programs:all` (e.g. a
 * publish stage running `revalidateTag`) refreshes this too.
 */
export const getCohortStats = unstable_cache(async () => fetchCohortStats(), ['cohort-stats'], {
  revalidate: 600,
  tags: ['programs:all'],
});
