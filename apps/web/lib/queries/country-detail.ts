import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import type { PillarKey } from '@/lib/theme';
import type { CountryDetail, CountryHeader, CountryProgramRow } from './country-detail-types';

const FIELDS_TOTAL = 33;

interface HeaderRow {
  iso: string;
  name: string;
  region: string;
  imdRank: number | null;
  imdAppealScore: string | null;
  imdAppealScoreCmeNormalized: string | null;
  govPortalUrl: string | null;
  taxAuthorityUrl: string | null;
  lastImdRefresh: Date | null;
}

interface ProgramRowRaw {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  composite: string | null;
  paq: string | null;
  pillarScores: unknown;
  fieldsPopulated: number;
  phase2Placeholder: boolean | null;
}

interface AggMetaRow {
  lastVerifiedAt: Date | null;
  sourcesTracked: number;
}

function toNumber(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPillarScores(raw: unknown): Record<PillarKey, number> | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<PillarKey, number>> = {};
  for (const k of ['A', 'B', 'C', 'D', 'E'] as const) {
    const v = obj[k];
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string' && Number.isFinite(Number(v))) out[k] = Number(v);
    else return null;
  }
  return out as Record<PillarKey, number>;
}

async function fetchCountryDetail(iso: string): Promise<CountryDetail | null> {
  const isoUpper = iso.toUpperCase();
  const headerSql = sql`
    SELECT
      iso_code                          AS iso,
      name                              AS name,
      region                            AS region,
      imd_rank                          AS "imdRank",
      imd_appeal_score                  AS "imdAppealScore",
      imd_appeal_score_cme_normalized   AS "imdAppealScoreCmeNormalized",
      gov_portal_url                    AS "govPortalUrl",
      tax_authority_url                 AS "taxAuthorityUrl",
      last_imd_refresh                  AS "lastImdRefresh"
    FROM countries
    WHERE iso_code = ${isoUpper}
    LIMIT 1
  `;

  const programsSql = sql`
    SELECT
      p.id                                                    AS "programId",
      p.name                                                  AS "programName",
      p.category                                              AS "programCategory",
      p.status                                                AS "programStatus",
      latest_scores.composite_score                           AS composite,
      latest_scores.paq_score                                 AS paq,
      latest_scores.pillar_scores                             AS "pillarScores",
      COALESCE(field_counts.fields_populated, 0)::int         AS "fieldsPopulated",
      (latest_scores.metadata ->> 'phase2Placeholder')::boolean AS "phase2Placeholder"
    FROM programs p
    LEFT JOIN LATERAL (
      SELECT
        s.composite_score,
        s.paq_score,
        s.pillar_scores,
        s.metadata
      FROM scores s
      WHERE s.program_id = p.id
      ORDER BY s.scored_at DESC
      LIMIT 1
    ) AS latest_scores ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS fields_populated
      FROM field_values fv
      WHERE fv.program_id = p.id
        AND fv.value_raw IS NOT NULL AND fv.value_raw <> ''
    ) AS field_counts ON TRUE
    WHERE p.country_iso = ${isoUpper}
    ORDER BY latest_scores.composite_score DESC NULLS LAST, p.name ASC
  `;

  const aggMetaSql = sql`
    SELECT
      MAX(fv.extracted_at)                AS "lastVerifiedAt",
      COUNT(DISTINCT s.id)::int           AS "sourcesTracked"
    FROM programs p
    LEFT JOIN field_values fv ON fv.program_id = p.id
    LEFT JOIN sources s ON s.program_id = p.id
    WHERE p.country_iso = ${isoUpper}
  `;

  // Tax-treatment query (D.3.2 + D.3.3) removed in methodology v5.0.0
  // (ADR-031). Pillar D no longer measures tax.

  const [headerRaw, programsRaw, aggMetaRaw] = await Promise.all([
    db.execute(headerSql),
    db.execute(programsSql),
    db.execute(aggMetaSql),
  ]);

  const headerRows = headerRaw as unknown as HeaderRow[];
  if (headerRows.length === 0) return null;
  const h = headerRows[0]!;
  const aggMeta = (aggMetaRaw as unknown as AggMetaRow[])[0] ?? {
    lastVerifiedAt: null,
    sourcesTracked: 0,
  };

  const programs: CountryProgramRow[] = (programsRaw as unknown as ProgramRowRaw[]).map((r) => ({
    programId: r.programId,
    programName: r.programName,
    programCategory: r.programCategory,
    programStatus: r.programStatus,
    composite: toNumber(r.composite),
    paq: toNumber(r.paq),
    pillarScores: toPillarScores(r.pillarScores),
    fieldsPopulated: r.fieldsPopulated,
    fieldsTotal: FIELDS_TOTAL,
    phase2Placeholder: r.phase2Placeholder === true,
  }));

  const header: CountryHeader = {
    iso: h.iso,
    name: h.name,
    region: h.region,
    imdRank: h.imdRank,
    imdAppealScore: toNumber(h.imdAppealScore),
    imdAppealScoreCmeNormalized: toNumber(h.imdAppealScoreCmeNormalized),
    govPortalUrl: h.govPortalUrl,
    taxAuthorityUrl: h.taxAuthorityUrl,
    lastImdRefresh: h.lastImdRefresh ? new Date(h.lastImdRefresh).toISOString() : null,
    lastVerifiedAt: aggMeta.lastVerifiedAt ? new Date(aggMeta.lastVerifiedAt).toISOString() : null,
    sourcesTracked: aggMeta.sourcesTracked,
  };

  return { header, programs };
}

export const getCountryDetail = (iso: string) =>
  unstable_cache(async () => fetchCountryDetail(iso), ['country-detail', iso.toUpperCase()], {
    revalidate: 3600,
    tags: [`country:${iso.toUpperCase()}`, 'programs:all'],
  })();
