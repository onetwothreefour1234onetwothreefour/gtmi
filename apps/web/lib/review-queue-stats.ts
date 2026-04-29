import 'server-only';
import { db } from '@gtmi/db';
import { sql } from 'drizzle-orm';

/**
 * Live stats for the editorial review queue (I-01) header.
 *
 * Hits `field_values` directly. RLS enforces team-only writes; reads on
 * the public role are intentionally restricted, but the `/review` route
 * is auth-gated by Supabase magic-link middleware so this query runs
 * under an authenticated session.
 */
export interface ReviewQueueStats {
  /** COUNT of field_values where status = 'pending_review'. */
  inQueue: number;
  /** Pending rows where extracted_at < NOW() − 3 days (past 3-day SLA). */
  slaRisk: number;
  /** Average age in hours of pending rows. Null when the queue is empty. */
  avgAgeHours: number | null;
  /** Pending rows where extractionConfidence ≥ 0.9 — bulk-approve target. */
  highConfidence: number;
}

interface RawStatsRow {
  inQueue: string | number;
  slaRisk: string | number;
  avgAgeHours: string | number | null;
  highConfidence: string | number;
}

function toInt(value: string | number): number {
  if (typeof value === 'number') return Math.trunc(value);
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toFloat(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns the four stats-strip values in a single round trip. No caching:
 * the queue is the analyst's working surface and any extraction or approval
 * can change the numbers immediately.
 */
export async function getReviewQueueStats(): Promise<ReviewQueueStats> {
  const statsSql = sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending_review')::int AS "inQueue",
      COUNT(*) FILTER (
        WHERE status = 'pending_review'
          AND extracted_at < NOW() - INTERVAL '3 days'
      )::int AS "slaRisk",
      EXTRACT(EPOCH FROM AVG(NOW() - extracted_at) FILTER (
        WHERE status = 'pending_review'
      )) / 3600.0 AS "avgAgeHours",
      COUNT(*) FILTER (
        WHERE status = 'pending_review'
          AND (provenance ->> 'extractionConfidence')::float >= 0.9
      )::int AS "highConfidence"
    FROM field_values
  `;

  const raw = (await db.execute(statsSql)) as unknown as RawStatsRow[];
  const r = raw[0] ?? { inQueue: 0, slaRisk: 0, avgAgeHours: null, highConfidence: 0 };

  return {
    inQueue: toInt(r.inQueue),
    slaRisk: toInt(r.slaRisk),
    avgAgeHours: toFloat(r.avgAgeHours),
    highConfidence: toInt(r.highConfidence),
  };
}
