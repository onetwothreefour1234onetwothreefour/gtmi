import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import type { PillarKey } from '@/lib/theme';
import { buildSearchPredicate, buildSearchRank, sanitiseSearchInput } from './search';
import type {
  RankedProgramRow,
  RankedProgramsFilters,
  RankedProgramsQuery,
  RankedProgramsResult,
  PillarScores,
  SortField,
} from './types';

const FIELDS_TOTAL = 48;

/** Map RankedProgramRow shape to a Drizzle SELECT producing typed scalars. */
type RawRow = {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  countryIso: string;
  countryName: string;
  countryRegion: string;
  composite: string | null;
  cme: string | null;
  paq: string | null;
  pillarScores: unknown;
  fieldsPopulated: string | number;
  phase2Placeholder: boolean | null;
  flaggedInsufficientDisclosure: boolean | null;
  scoredAt: Date | null;
  lastVerifiedAt: Date | null;
  searchRank: number | null;
};

function toNumber(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPillarScores(raw: unknown): PillarScores | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: Partial<PillarScores> = {};
  for (const k of ['A', 'B', 'C', 'D', 'E'] as const satisfies readonly PillarKey[]) {
    const v = obj[k];
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string' && Number.isFinite(Number(v))) out[k] = Number(v);
    else return null;
  }
  return out as PillarScores;
}

function buildOrderBy(field: SortField, direction: 'asc' | 'desc', hasSearch: boolean) {
  const dir = direction === 'asc' ? sql`ASC` : sql`DESC`;
  // Unscored programs always sort to the bottom regardless of secondary sort.
  // NULLS LAST handles this for score-derived columns; for name/country we
  // append composite-NULLS-LAST as a tiebreaker.
  const tiebreakerByCompositeNullsLast = sql`(latest_scores.composite_score IS NULL) ASC`;
  switch (field) {
    case 'composite':
      return sql`latest_scores.composite_score ${dir} NULLS LAST, programs.name ASC`;
    case 'paq':
      return sql`latest_scores.paq_score ${dir} NULLS LAST, programs.name ASC`;
    case 'cme':
      return sql`latest_scores.cme_score ${dir} NULLS LAST, programs.name ASC`;
    case 'coverage':
      return sql`fields_populated ${dir} NULLS LAST, programs.name ASC`;
    case 'country':
      return sql`countries.name ${dir}, ${tiebreakerByCompositeNullsLast}, programs.name ASC`;
    case 'name':
    default:
      return hasSearch
        ? sql`search_rank DESC NULLS LAST, programs.name ${dir}`
        : sql`${tiebreakerByCompositeNullsLast}, programs.name ${dir}`;
  }
}

/**
 * Server-side query for the rankings table. Returns rows + facet aggregates +
 * counts in a single round trip via subqueries.
 *
 * RLS already enforces public read on programs, countries, scores, and
 * approved-only on field_values — the query relies on those policies.
 */
async function fetchRankedPrograms(query: RankedProgramsQuery): Promise<RankedProgramsResult> {
  const filters: RankedProgramsFilters = query.filters ?? {};
  const sortField: SortField = query.sort?.field ?? 'composite';
  const sortDir = query.sort?.direction ?? 'desc';
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const searchInput = sanitiseSearchInput(filters.search ?? '');
  const searchPred = searchInput ? buildSearchPredicate(searchInput) : null;
  const searchRank = searchInput ? buildSearchRank(searchInput) : null;

  const wheres: ReturnType<typeof sql>[] = [];
  if (filters.countryIsos && filters.countryIsos.length > 0) {
    wheres.push(sql`countries.iso_code IN ${filters.countryIsos}`);
  }
  if (filters.regions && filters.regions.length > 0) {
    wheres.push(sql`countries.region IN ${filters.regions}`);
  }
  if (filters.categories && filters.categories.length > 0) {
    wheres.push(sql`programs.category IN ${filters.categories}`);
  }
  if (filters.scoredOnly) {
    wheres.push(sql`latest_scores.composite_score IS NOT NULL`);
  }
  if (filters.scoreRange) {
    const [min, max] = filters.scoreRange;
    if (min !== null && min !== undefined) {
      wheres.push(sql`latest_scores.composite_score >= ${min}`);
    }
    if (max !== null && max !== undefined) {
      wheres.push(sql`latest_scores.composite_score <= ${max}`);
    }
  }
  if (searchPred) wheres.push(searchPred);

  const whereClause = wheres.length > 0 ? sql`WHERE ${sql.join(wheres, sql` AND `)}` : sql``;

  const orderBy = buildOrderBy(sortField, sortDir, !!searchPred);
  const searchRankSelect = searchRank ? sql`${searchRank}` : sql`NULL::float`;

  // Single SELECT with two correlated subqueries: latest scores + approved
  // field-values count. This stays efficient at 85-program scale; if Phase 6
  // grows the corpus we can move to a materialised view per ADR-011 revisit.
  const rowsSql = sql`
    SELECT
      programs.id              AS "programId",
      programs.name            AS "programName",
      programs.category        AS "programCategory",
      programs.status          AS "programStatus",
      countries.iso_code       AS "countryIso",
      countries.name           AS "countryName",
      countries.region         AS "countryRegion",
      latest_scores.composite_score                     AS composite,
      latest_scores.cme_score                           AS cme,
      latest_scores.paq_score                           AS paq,
      latest_scores.pillar_scores                       AS "pillarScores",
      COALESCE(field_counts.fields_populated, 0)::int   AS "fieldsPopulated",
      (latest_scores.metadata ->> 'phase2Placeholder')::boolean AS "phase2Placeholder",
      latest_scores.flagged_insufficient_disclosure     AS "flaggedInsufficientDisclosure",
      latest_scores.scored_at                           AS "scoredAt",
      field_counts.last_verified_at                     AS "lastVerifiedAt",
      ${searchRankSelect}                               AS "searchRank"
    FROM programs
    INNER JOIN countries ON countries.iso_code = programs.country_iso
    LEFT JOIN LATERAL (
      SELECT
        s.composite_score,
        s.cme_score,
        s.paq_score,
        s.pillar_scores,
        s.metadata,
        s.flagged_insufficient_disclosure,
        s.scored_at
      FROM scores s
      WHERE s.program_id = programs.id
      ORDER BY s.scored_at DESC
      LIMIT 1
    ) AS latest_scores ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS fields_populated,
        MAX(fv.extracted_at) AS last_verified_at
      FROM field_values fv
      WHERE fv.program_id = programs.id
        AND fv.status = 'approved'
    ) AS field_counts ON TRUE
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const totalSql = sql`
    SELECT COUNT(*)::int AS total
    FROM programs
    INNER JOIN countries ON countries.iso_code = programs.country_iso
    LEFT JOIN LATERAL (
      SELECT s.composite_score, s.metadata
      FROM scores s
      WHERE s.program_id = programs.id
      ORDER BY s.scored_at DESC
      LIMIT 1
    ) AS latest_scores ON TRUE
    ${whereClause}
  `;

  const scoredCountSql = sql`
    SELECT COUNT(DISTINCT s.program_id)::int AS scored_count
    FROM scores s
  `;

  const countriesFacetSql = sql`
    SELECT iso_code AS iso, name, region
    FROM countries
    ORDER BY name
  `;
  const regionsFacetSql = sql`
    SELECT DISTINCT region FROM countries ORDER BY region
  `;
  const categoriesFacetSql = sql`
    SELECT DISTINCT category FROM programs ORDER BY category
  `;

  const [rowsRaw, totalRaw, scoredRaw, countriesRaw, regionsRaw, categoriesRaw] = await Promise.all(
    [
      db.execute(rowsSql),
      db.execute(totalSql),
      db.execute(scoredCountSql),
      db.execute(countriesFacetSql),
      db.execute(regionsFacetSql),
      db.execute(categoriesFacetSql),
    ]
  );

  const rows: RankedProgramRow[] = (rowsRaw as unknown as RawRow[]).map((r) => ({
    programId: r.programId,
    programName: r.programName,
    programCategory: r.programCategory,
    programStatus: r.programStatus,
    countryIso: r.countryIso,
    countryName: r.countryName,
    countryRegion: r.countryRegion,
    composite: toNumber(r.composite),
    cme: toNumber(r.cme),
    paq: toNumber(r.paq),
    pillarScores: toPillarScores(r.pillarScores),
    fieldsPopulated:
      typeof r.fieldsPopulated === 'string' ? Number(r.fieldsPopulated) : r.fieldsPopulated,
    fieldsTotal: FIELDS_TOTAL,
    phase2Placeholder: r.phase2Placeholder === true,
    flaggedInsufficientDisclosure: r.flaggedInsufficientDisclosure === true,
    scoredAt: r.scoredAt ? new Date(r.scoredAt).toISOString() : null,
    lastVerifiedAt: r.lastVerifiedAt ? new Date(r.lastVerifiedAt).toISOString() : null,
    searchRank: r.searchRank,
  }));

  const totalCount = (totalRaw as unknown as { total: number }[])[0]?.total ?? 0;
  const scoredCount = (scoredRaw as unknown as { scored_count: number }[])[0]?.scored_count ?? 0;
  const countriesFacet =
    (countriesRaw as unknown as { iso: string; name: string; region: string }[]) ?? [];
  const regionsFacet = ((regionsRaw as unknown as { region: string }[]) ?? []).map((r) => r.region);
  const categoriesFacet = ((categoriesRaw as unknown as { category: string }[]) ?? []).map(
    (r) => r.category
  );

  return {
    rows,
    totalCount,
    scoredCount,
    facets: {
      countries: countriesFacet,
      regions: regionsFacet,
      categories: categoriesFacet,
    },
  };
}

/**
 * Cached wrapper. Tags allow Phase 5 policy-change webhooks to invalidate
 * via `revalidateTag('programs:all')` without redeploying.
 */
export const getRankedPrograms = unstable_cache(
  async (query: RankedProgramsQuery) => fetchRankedPrograms(query),
  ['ranked-programs'],
  { revalidate: 3600, tags: ['programs:all'] }
);
