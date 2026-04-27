import 'server-only';
import { db } from '@gtmi/db';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import type { PillarKey } from '@/lib/theme';
import type { FieldValueStatus } from '@/lib/provenance';
import type {
  ProgramDetail,
  ProgramDetailFieldValue,
  ProgramDetailPolicyChange,
  ProgramDetailScore,
  ProgramDetailSource,
  PillarScores,
} from './program-detail-types';
import { computeMedianPillarScores } from './program-detail-helpers';

export { computeMedianPillarScores } from './program-detail-helpers';

const PILLAR_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;

interface HeaderRow {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  programDescriptionMd: string | null;
  launchYear: number | null;
  closureYear: number | null;
  longSummaryMd: string | null;
  longSummaryUpdatedAt: Date | null;
  longSummaryReviewer: string | null;
  countryIso: string;
  countryName: string;
  countryRegion: string;
}

interface ScoreRow {
  composite: string | null;
  cme: string | null;
  paq: string | null;
  pillarScores: unknown;
  subFactorScores: unknown;
  metadata: unknown;
  flaggedInsufficientDisclosure: boolean | null;
  scoredAt: Date | null;
  methodologyVersionTag: string | null;
}

interface FieldValueRow {
  fieldValueId: string;
  fieldDefinitionId: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: string;
  dataType: string;
  normalizationFn: string;
  direction: string;
  valueRaw: string | null;
  valueIndicatorScore: string | null;
  status: string;
  provenance: unknown;
  extractedAt: Date | null;
  reviewedAt: Date | null;
}

interface SourceRow {
  id: string;
  url: string;
  tier: number;
  sourceCategory: string;
  isPrimary: boolean;
  lastScrapedAt: Date | null;
}

interface PolicyChangeRow {
  id: string;
  detectedAt: Date;
  severity: string;
  fieldKey: string;
  fieldLabel: string;
  summary: string | null;
  paqDelta: string | null;
}

interface CohortMemberRow {
  programId: string;
  programName: string;
  pillarScores: unknown;
}

function toNumber(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPillarScores(raw: unknown): PillarScores | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: Partial<PillarScores> = {};
  for (const k of PILLAR_KEYS) {
    const v = obj[k];
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string' && Number.isFinite(Number(v))) out[k] = Number(v);
    else return null;
  }
  return out as PillarScores;
}

function toSubFactorScores(raw: unknown): Record<string, number> | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string' && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function readPlaceholderFlag(metadata: unknown): boolean {
  if (metadata === null || metadata === undefined || typeof metadata !== 'object') return false;
  const obj = metadata as Record<string, unknown>;
  return obj['phase2Placeholder'] === true;
}

function isPillarKey(s: string): s is PillarKey {
  return s === 'A' || s === 'B' || s === 'C' || s === 'D' || s === 'E';
}

function isSeverity(s: string): s is 'minor' | 'material' | 'breaking' {
  return s === 'minor' || s === 'material' || s === 'breaking';
}

async function fetchProgramDetail(programId: string): Promise<ProgramDetail | null> {
  const headerSql = sql`
    SELECT
      programs.id                 AS "programId",
      programs.name               AS "programName",
      programs.category           AS "programCategory",
      programs.status             AS "programStatus",
      programs.description_md     AS "programDescriptionMd",
      programs.launch_year        AS "launchYear",
      programs.closure_year       AS "closureYear",
      programs.long_summary_md         AS "longSummaryMd",
      programs.long_summary_updated_at AS "longSummaryUpdatedAt",
      programs.long_summary_reviewer   AS "longSummaryReviewer",
      countries.iso_code          AS "countryIso",
      countries.name              AS "countryName",
      countries.region            AS "countryRegion"
    FROM programs
    INNER JOIN countries ON countries.iso_code = programs.country_iso
    WHERE programs.id = ${programId}
    LIMIT 1
  `;

  const scoreSql = sql`
    SELECT
      s.composite_score                AS composite,
      s.cme_score                      AS cme,
      s.paq_score                      AS paq,
      s.pillar_scores                  AS "pillarScores",
      s.sub_factor_scores              AS "subFactorScores",
      s.metadata                       AS metadata,
      s.flagged_insufficient_disclosure AS "flaggedInsufficientDisclosure",
      s.scored_at                      AS "scoredAt",
      mv.version_tag                   AS "methodologyVersionTag"
    FROM scores s
    LEFT JOIN methodology_versions mv ON mv.id = s.methodology_version_id
    WHERE s.program_id = ${programId}
    ORDER BY s.scored_at DESC
    LIMIT 1
  `;

  const fieldValuesSql = sql`
    SELECT
      fv.id                          AS "fieldValueId",
      fd.id                          AS "fieldDefinitionId",
      fd.key                         AS "fieldKey",
      fd.label                       AS "fieldLabel",
      fd.pillar                      AS pillar,
      fd.sub_factor                  AS "subFactor",
      fd.weight_within_sub_factor    AS "weightWithinSubFactor",
      fd.data_type                   AS "dataType",
      fd.normalization_fn            AS "normalizationFn",
      fd.direction                   AS direction,
      fv.value_raw                   AS "valueRaw",
      fv.value_indicator_score       AS "valueIndicatorScore",
      fv.status                      AS status,
      fv.provenance                  AS provenance,
      fv.extracted_at                AS "extractedAt",
      fv.reviewed_at                 AS "reviewedAt"
    FROM field_definitions fd
    LEFT JOIN field_values fv
      ON fv.field_definition_id = fd.id AND fv.program_id = ${programId}
    ORDER BY fd.pillar, fd.sub_factor, fd.key
  `;

  const sourcesSql = sql`
    SELECT
      sources.id                  AS id,
      sources.url                 AS url,
      sources.tier                AS tier,
      sources.source_category     AS "sourceCategory",
      sources.is_primary          AS "isPrimary",
      sources.last_scraped_at     AS "lastScrapedAt"
    FROM sources
    WHERE sources.program_id = ${programId}
    ORDER BY sources.tier, sources.is_primary DESC, sources.url
  `;

  const policyChangesSql = sql`
    SELECT
      pc.id                       AS id,
      pc.detected_at              AS "detectedAt",
      pc.severity                 AS severity,
      fd.key                      AS "fieldKey",
      fd.label                    AS "fieldLabel",
      pc.summary_text             AS summary,
      pc.paq_delta                AS "paqDelta"
    FROM policy_changes pc
    INNER JOIN field_definitions fd ON fd.id = pc.field_definition_id
    WHERE pc.program_id = ${programId}
      AND pc.summary_human_approved = true
    ORDER BY pc.detected_at DESC
  `;

  const cohortSql = sql`
    SELECT
      s.program_id                AS "programId",
      programs.name               AS "programName",
      s.pillar_scores             AS "pillarScores"
    FROM scores s
    INNER JOIN programs ON programs.id = s.program_id
    WHERE s.program_id != ${programId}
      AND s.pillar_scores IS NOT NULL
    ORDER BY s.scored_at DESC
  `;

  const [headerRaw, scoreRaw, fvRaw, sourcesRaw, policyRaw, cohortRaw] = await Promise.all([
    db.execute(headerSql),
    db.execute(scoreSql),
    db.execute(fieldValuesSql),
    db.execute(sourcesSql),
    db.execute(policyChangesSql),
    db.execute(cohortSql),
  ]);

  const headerRows = headerRaw as unknown as HeaderRow[];
  if (headerRows.length === 0) return null;
  const h = headerRows[0]!;

  const scoreRows = scoreRaw as unknown as ScoreRow[];
  const score: ProgramDetailScore | null = scoreRows[0]
    ? (() => {
        const r = scoreRows[0]!;
        return {
          composite: toNumber(r.composite),
          cme: toNumber(r.cme),
          paq: toNumber(r.paq),
          pillarScores: toPillarScores(r.pillarScores),
          subFactorScores: toSubFactorScores(r.subFactorScores),
          phase2Placeholder: readPlaceholderFlag(r.metadata),
          flaggedInsufficientDisclosure: r.flaggedInsufficientDisclosure === true,
          scoredAt: r.scoredAt ? new Date(r.scoredAt).toISOString() : null,
          methodologyVersion: r.methodologyVersionTag,
        };
      })()
    : null;

  const fieldValues: ProgramDetailFieldValue[] = (fvRaw as unknown as FieldValueRow[])
    .filter((r) => isPillarKey(r.pillar))
    .map((r) => ({
      fieldDefinitionId: r.fieldDefinitionId,
      fieldKey: r.fieldKey,
      fieldLabel: r.fieldLabel,
      pillar: r.pillar as PillarKey,
      subFactor: r.subFactor,
      weightWithinSubFactor: Number(r.weightWithinSubFactor),
      dataType: r.dataType,
      normalizationFn: r.normalizationFn,
      direction: r.direction,
      valueRaw: r.valueRaw,
      valueIndicatorScore: toNumber(r.valueIndicatorScore),
      status: (r.status as FieldValueStatus) ?? 'draft',
      provenance: r.provenance ?? null,
      extractedAt: r.extractedAt ? new Date(r.extractedAt).toISOString() : null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    }));

  const sources: ProgramDetailSource[] = (sourcesRaw as unknown as SourceRow[]).map((r) => ({
    id: r.id,
    url: r.url,
    tier: r.tier,
    sourceCategory: r.sourceCategory,
    isPrimary: r.isPrimary,
    lastScrapedAt: r.lastScrapedAt ? new Date(r.lastScrapedAt).toISOString() : null,
  }));

  const policyChanges: ProgramDetailPolicyChange[] = (policyRaw as unknown as PolicyChangeRow[])
    .filter((r) => isSeverity(r.severity))
    .map((r) => ({
      id: r.id,
      detectedAt: new Date(r.detectedAt).toISOString(),
      severity: r.severity as 'minor' | 'material' | 'breaking',
      fieldKey: r.fieldKey,
      fieldLabel: r.fieldLabel,
      summary: r.summary ?? '',
      paqDelta: toNumber(r.paqDelta),
    }));

  const cohortMembers = (cohortRaw as unknown as CohortMemberRow[])
    .map((r) => ({
      programId: r.programId,
      programName: r.programName,
      pillarScores: toPillarScores(r.pillarScores),
    }))
    .filter(
      (m): m is { programId: string; programName: string; pillarScores: PillarScores } =>
        m.pillarScores !== null
    );

  const cohortPillarScores = cohortMembers.map((m) => m.pillarScores);
  // Include the focal program in the median if it's scored.
  if (score?.pillarScores) cohortPillarScores.push(score.pillarScores);
  const medianPillarScores = computeMedianPillarScores(cohortPillarScores);

  return {
    header: {
      programId: h.programId,
      programName: h.programName,
      programCategory: h.programCategory,
      programStatus: h.programStatus,
      programDescriptionMd: h.programDescriptionMd,
      launchYear: h.launchYear,
      closureYear: h.closureYear,
      countryIso: h.countryIso,
      countryName: h.countryName,
      countryRegion: h.countryRegion,
    },
    score,
    longSummary: {
      bodyMd: h.longSummaryMd,
      updatedAt: h.longSummaryUpdatedAt ? new Date(h.longSummaryUpdatedAt).toISOString() : null,
      reviewer: h.longSummaryReviewer,
    },
    fieldValues,
    sources,
    policyChanges,
    cohort: {
      scoredCount: cohortMembers.length + (score?.pillarScores ? 1 : 0),
      medianPillarScores,
      compareCandidates: cohortMembers,
    },
  };
}

export const getProgramDetail = (programId: string) =>
  unstable_cache(async () => fetchProgramDetail(programId), ['program-detail', programId], {
    revalidate: 3600,
    tags: [`program:${programId}`, 'programs:all'],
  })();
