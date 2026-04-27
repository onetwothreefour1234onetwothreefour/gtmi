import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql, type SQL } from 'drizzle-orm';

export type PolicyChangeSeverity = 'minor' | 'material' | 'breaking';

export interface PolicyChangesFilters {
  severities?: PolicyChangeSeverity[];
  countryIsos?: string[];
  pillars?: string[];
  /** ISO date string lower bound (inclusive). */
  detectedAfter?: string;
  /** ISO date string upper bound (inclusive). */
  detectedBefore?: string;
}

export interface PolicyChangeRow {
  id: string;
  detectedAt: string;
  severity: PolicyChangeSeverity;
  programId: string;
  programName: string;
  countryIso: string;
  countryName: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: string;
  summary: string;
  paqDelta: number | null;
  waybackUrl: string | null;
}

interface RawRow {
  id: string;
  detectedAt: Date;
  severity: string;
  programId: string;
  programName: string;
  countryIso: string;
  countryName: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: string;
  summary: string | null;
  paqDelta: string | null;
  waybackUrl: string | null;
}

function isSeverity(s: string): s is PolicyChangeSeverity {
  return s === 'minor' || s === 'material' || s === 'breaking';
}

function toNumber(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchPolicyChanges(filters: PolicyChangesFilters = {}): Promise<PolicyChangeRow[]> {
  const wheres: SQL[] = [
    // RLS gates summary_human_approved=true on the public role; this WHERE is
    // a defence-in-depth duplication so a future schema change that loosens
    // RLS doesn't leak unapproved summaries.
    sql`pc.summary_human_approved = true`,
  ];

  if (filters.severities && filters.severities.length > 0) {
    wheres.push(sql`pc.severity IN ${filters.severities}`);
  }
  if (filters.countryIsos && filters.countryIsos.length > 0) {
    wheres.push(sql`p.country_iso IN ${filters.countryIsos}`);
  }
  if (filters.pillars && filters.pillars.length > 0) {
    wheres.push(sql`fd.pillar IN ${filters.pillars}`);
  }
  if (filters.detectedAfter) {
    wheres.push(sql`pc.detected_at >= ${filters.detectedAfter}`);
  }
  if (filters.detectedBefore) {
    wheres.push(sql`pc.detected_at <= ${filters.detectedBefore}`);
  }

  const whereClause = sql`WHERE ${sql.join(wheres, sql` AND `)}`;

  const rowsSql = sql`
    SELECT
      pc.id                       AS id,
      pc.detected_at              AS "detectedAt",
      pc.severity                 AS severity,
      p.id                        AS "programId",
      p.name                      AS "programName",
      c.iso_code                  AS "countryIso",
      c.name                      AS "countryName",
      fd.key                      AS "fieldKey",
      fd.label                    AS "fieldLabel",
      fd.pillar                   AS pillar,
      pc.summary_text             AS summary,
      pc.paq_delta                AS "paqDelta",
      pc.wayback_url              AS "waybackUrl"
    FROM policy_changes pc
    INNER JOIN programs p              ON p.id = pc.program_id
    INNER JOIN countries c             ON c.iso_code = p.country_iso
    INNER JOIN field_definitions fd    ON fd.id = pc.field_definition_id
    ${whereClause}
    ORDER BY pc.detected_at DESC
    LIMIT 200
  `;

  const raw = (await db.execute(rowsSql)) as unknown as RawRow[];

  return raw
    .filter((r) => isSeverity(r.severity))
    .map((r) => ({
      id: r.id,
      detectedAt: new Date(r.detectedAt).toISOString(),
      severity: r.severity as PolicyChangeSeverity,
      programId: r.programId,
      programName: r.programName,
      countryIso: r.countryIso,
      countryName: r.countryName,
      fieldKey: r.fieldKey,
      fieldLabel: r.fieldLabel,
      pillar: r.pillar,
      summary: r.summary ?? '',
      paqDelta: toNumber(r.paqDelta),
      waybackUrl: r.waybackUrl,
    }));
}

/**
 * Cached server query. Phase 4 reality: returns []. The query is real —
 * RLS gates `summary_human_approved=true` and the table is empty — so
 * Phase 5 lights up automatically with no code change here.
 */
export const getPolicyChanges = (filters: PolicyChangesFilters = {}) =>
  unstable_cache(
    async () => fetchPolicyChanges(filters),
    ['policy-changes', JSON.stringify(filters)],
    { revalidate: 600, tags: ['changes:all'] }
  )();
