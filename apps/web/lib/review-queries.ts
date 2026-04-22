import 'server-only';
import { db, fieldValues, fieldDefinitions, programs, countries, sources } from '@gtmi/db';
import { eq, desc } from 'drizzle-orm';

export type ReviewListRow = {
  id: string;
  programId: string;
  programName: string;
  countryIso: string;
  countryName: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: string;
  status: string;
  valueRaw: string | null;
  extractedAt: Date | null;
};

export type ReviewDetailRow = ReviewListRow & {
  valueNormalized: unknown;
  provenance: unknown;
  sourceUrl: string | null;
  sourceTier: number | null;
  extractionPromptMd: string;
  scoringRubricJsonb: unknown;
};

export async function listPendingReview(): Promise<ReviewListRow[]> {
  const rows = await db
    .select({
      id: fieldValues.id,
      programId: fieldValues.programId,
      programName: programs.name,
      countryIso: programs.countryIso,
      countryName: countries.name,
      fieldKey: fieldDefinitions.key,
      fieldLabel: fieldDefinitions.label,
      pillar: fieldDefinitions.pillar,
      status: fieldValues.status,
      valueRaw: fieldValues.valueRaw,
      extractedAt: fieldValues.extractedAt,
    })
    .from(fieldValues)
    .innerJoin(programs, eq(programs.id, fieldValues.programId))
    .innerJoin(countries, eq(countries.isoCode, programs.countryIso))
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(eq(fieldValues.status, 'pending_review'))
    .orderBy(desc(fieldValues.extractedAt));

  return rows;
}

export async function getReviewDetail(id: string): Promise<ReviewDetailRow | null> {
  const rows = await db
    .select({
      id: fieldValues.id,
      programId: fieldValues.programId,
      programName: programs.name,
      countryIso: programs.countryIso,
      countryName: countries.name,
      fieldKey: fieldDefinitions.key,
      fieldLabel: fieldDefinitions.label,
      pillar: fieldDefinitions.pillar,
      status: fieldValues.status,
      valueRaw: fieldValues.valueRaw,
      valueNormalized: fieldValues.valueNormalized,
      provenance: fieldValues.provenance,
      extractedAt: fieldValues.extractedAt,
      sourceUrl: sources.url,
      sourceTier: sources.tier,
      extractionPromptMd: fieldDefinitions.extractionPromptMd,
      scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
    })
    .from(fieldValues)
    .innerJoin(programs, eq(programs.id, fieldValues.programId))
    .innerJoin(countries, eq(countries.isoCode, programs.countryIso))
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .leftJoin(sources, eq(sources.id, fieldValues.sourceId))
    .where(eq(fieldValues.id, id))
    .limit(1);

  return rows[0] ?? null;
}
