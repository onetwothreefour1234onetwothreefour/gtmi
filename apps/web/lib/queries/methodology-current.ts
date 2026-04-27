import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import type { MethodologyCurrent, MethodologyVersionEntry } from './methodology-current-types';
import { groupFieldsByPillar, type FieldDefinitionInput } from './methodology-current-helpers';

interface VersionRow {
  versionTag: string;
  publishedAt: Date | null;
  pillarWeights: unknown;
  subFactorWeights: unknown;
  cmePaqSplit: unknown;
  changeNotes: string | null;
}

interface FieldDefinitionRow {
  key: string;
  label: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: string;
  dataType: string;
  normalizationFn: string;
  direction: string;
  sourceTierRequired: number;
}

interface VersionHistoryRow {
  versionTag: string;
  publishedAt: Date | null;
  changeNotes: string | null;
}

function readNumberRecord(raw: unknown): Record<string, number> {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string' && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return out;
}

function readCmePaqSplit(raw: unknown): { cme: number; paq: number } {
  const fallback = { cme: 0.3, paq: 0.7 };
  if (raw === null || raw === undefined || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const cme = typeof obj['cme'] === 'number' ? (obj['cme'] as number) : Number(obj['cme']);
  const paq = typeof obj['paq'] === 'number' ? (obj['paq'] as number) : Number(obj['paq']);
  if (!Number.isFinite(cme) || !Number.isFinite(paq)) return fallback;
  return { cme, paq };
}

async function fetchMethodologyCurrent(): Promise<MethodologyCurrent | null> {
  const versionSql = sql`
    SELECT
      mv.version_tag           AS "versionTag",
      mv.published_at          AS "publishedAt",
      mv.pillar_weights        AS "pillarWeights",
      mv.sub_factor_weights    AS "subFactorWeights",
      mv.cme_paq_split         AS "cmePaqSplit",
      mv.change_notes          AS "changeNotes"
    FROM methodology_versions mv
    ORDER BY mv.published_at DESC NULLS LAST, mv.version_tag DESC
    LIMIT 1
  `;

  const fieldsSql = sql`
    SELECT
      fd.key                       AS key,
      fd.label                     AS label,
      fd.pillar                    AS pillar,
      fd.sub_factor                AS "subFactor",
      fd.weight_within_sub_factor  AS "weightWithinSubFactor",
      fd.data_type                 AS "dataType",
      fd.normalization_fn          AS "normalizationFn",
      fd.direction                 AS direction,
      fd.source_tier_required      AS "sourceTierRequired"
    FROM field_definitions fd
    ORDER BY fd.pillar ASC, fd.sub_factor ASC, fd.key ASC
  `;

  const historySql = sql`
    SELECT
      mv.version_tag           AS "versionTag",
      mv.published_at          AS "publishedAt",
      mv.change_notes          AS "changeNotes"
    FROM methodology_versions mv
    ORDER BY mv.published_at DESC NULLS LAST, mv.version_tag DESC
  `;

  const [versionRaw, fieldsRaw, historyRaw] = await Promise.all([
    db.execute(versionSql),
    db.execute(fieldsSql),
    db.execute(historySql),
  ]);

  const versionRows = versionRaw as unknown as VersionRow[];
  if (versionRows.length === 0) return null;
  const v = versionRows[0]!;

  const pillarWeights = readNumberRecord(v.pillarWeights);
  const subFactorWeights = readNumberRecord(v.subFactorWeights);
  const cmePaqSplit = readCmePaqSplit(v.cmePaqSplit);

  const fieldInputs: FieldDefinitionInput[] = (fieldsRaw as unknown as FieldDefinitionRow[]).map(
    (f) => ({
      key: f.key,
      label: f.label,
      pillar: f.pillar,
      subFactor: f.subFactor,
      weightWithinSubFactor: Number(f.weightWithinSubFactor),
      dataType: f.dataType,
      normalizationFn: f.normalizationFn,
      direction: f.direction,
      sourceTierRequired: f.sourceTierRequired,
    })
  );
  const pillars = groupFieldsByPillar(fieldInputs, pillarWeights, subFactorWeights);

  const history: MethodologyVersionEntry[] = (historyRaw as unknown as VersionHistoryRow[]).map(
    (r) => ({
      versionTag: r.versionTag,
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      changeNotes: r.changeNotes,
    })
  );

  return {
    versionTag: v.versionTag,
    publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
    cmePaqSplit,
    pillars,
    history,
  };
}

export const getMethodologyCurrent = unstable_cache(
  async () => fetchMethodologyCurrent(),
  ['methodology-current'],
  { revalidate: 3600, tags: ['methodology:current'] }
);
