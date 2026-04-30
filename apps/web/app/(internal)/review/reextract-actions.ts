'use server';

// Phase 3.8 / P3.5 — focused re-extraction. Reads the current
// field_values row's source URL out of the cached scrape, builds a
// rubric-grounded re-extraction prompt that includes the previous
// valueRaw and the analyst's rejection reason, and calls the LLM with
// a one-off prompt. The result is written back as pending_review so
// the universal gate (P1) and the rubric-aware editor (P2) handle the
// next round.

import {
  db,
  fieldDefinitions,
  fieldValues,
  methodologyVersions,
  programs,
  scrapeCache,
  countries,
  renderAllowedValues,
} from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { ExtractStageImpl, buildFocusedReextractionPrompt } from '@gtmi/extraction';
import { revalidatePath } from 'next/cache';

interface ReextractResult {
  status: 'pending_review' | 'no_change' | 'no_source' | 'no_scrape';
  valueRaw: string | null;
  sourceSentence: string | null;
}

function readSourceUrlFromProvenance(provenance: unknown): string | null {
  if (provenance === null || typeof provenance !== 'object') return null;
  const v = (provenance as Record<string, unknown>).sourceUrl;
  return typeof v === 'string' ? v : null;
}

interface CategoricalRubric {
  categories: Array<{ value: string; score?: number; description?: string }>;
}
function isCategoricalRubric(r: unknown): r is CategoricalRubric {
  if (!r || typeof r !== 'object') return false;
  const cats = (r as { categories?: unknown }).categories;
  return Array.isArray(cats);
}

export async function reextractFieldValue(
  id: string,
  rejectReason?: string
): Promise<ReextractResult> {
  if (!id) throw new Error('reextractFieldValue: missing field_value id');

  const rows = await db
    .select({
      valueRaw: fieldValues.valueRaw,
      programId: fieldValues.programId,
      provenance: fieldValues.provenance,
      methodologyVersion: methodologyVersions.versionTag,
      def: {
        id: fieldDefinitions.id,
        key: fieldDefinitions.key,
        normalizationFn: fieldDefinitions.normalizationFn,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
        extractionPromptMd: fieldDefinitions.extractionPromptMd,
      },
      program: {
        id: programs.id,
        name: programs.name,
        countryIso: programs.countryIso,
      },
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .innerJoin(programs, eq(programs.id, fieldValues.programId))
    .leftJoin(methodologyVersions, eq(methodologyVersions.id, fieldValues.methodologyVersionId))
    .where(eq(fieldValues.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error(`reextractFieldValue: no field_values row with id=${id}`);

  const sourceUrl = readSourceUrlFromProvenance(row.provenance);
  if (!sourceUrl) {
    return { status: 'no_source', valueRaw: null, sourceSentence: null };
  }

  // Pull cached scrape content. Re-extraction never re-scrapes — if the
  // cache is empty for this URL the analyst should run the upstream
  // pipeline first (separate concern from rubric refinement).
  const scrapes = await db
    .select({
      contentMarkdown: scrapeCache.contentMarkdown,
      contentHash: scrapeCache.contentHash,
      scrapedAt: scrapeCache.scrapedAt,
    })
    .from(scrapeCache)
    .where(eq(scrapeCache.url, sourceUrl))
    .limit(1);

  if (scrapes.length === 0) {
    return { status: 'no_scrape', valueRaw: null, sourceSentence: null };
  }
  const scrape = scrapes[0]!;

  // Country name for the prompt's {program_country} placeholder.
  const countryRows = await db
    .select({ name: countries.name })
    .from(countries)
    .where(eq(countries.isoCode, row.program.countryIso))
    .limit(1);
  const countryDisplay = countryRows[0]?.name ?? row.program.countryIso;

  const rubricVocabBlock = isCategoricalRubric(row.def.scoringRubricJsonb)
    ? renderAllowedValues(row.def.scoringRubricJsonb)
    : null;

  const focusedPrompt = buildFocusedReextractionPrompt({
    basePromptMd: row.def.extractionPromptMd,
    previousValueRaw: row.valueRaw ?? null,
    rejectReason: rejectReason?.trim() || null,
    rubricVocabBlock,
  });

  // ExtractStageImpl.executeWithPrompt bypasses the fieldPrompts
  // constructor map entirely; we feed it the focused prompt directly.
  const stage = new ExtractStageImpl(new Map());
  const extraction = await stage.executeWithPrompt(
    {
      url: sourceUrl,
      contentMarkdown: scrape.contentMarkdown,
      contentHash: scrape.contentHash,
      httpStatus: 200,
      scrapedAt: scrape.scrapedAt,
    },
    row.def.key,
    row.programId,
    row.program.name,
    countryDisplay,
    focusedPrompt
  );

  // No-change short-circuit: if the LLM returned the same raw, don't
  // bump extractedAt — keep the original timestamp so the analyst sees
  // the stale row was actually re-checked.
  if (extraction.valueRaw === row.valueRaw) {
    return {
      status: 'no_change',
      valueRaw: extraction.valueRaw,
      sourceSentence: extraction.sourceSentence,
    };
  }

  // Write back as pending_review with the new raw + sentence; let the
  // P1 universal gate handle normalization on next read.
  const newProvenance: Record<string, unknown> = {
    ...(typeof row.provenance === 'object' && row.provenance !== null
      ? (row.provenance as Record<string, unknown>)
      : {}),
    sourceSentence: extraction.sourceSentence,
    characterOffsets: extraction.characterOffsets,
    extractionConfidence: extraction.extractionConfidence,
    extractionModel: extraction.extractionModel,
    reextractedAt: new Date().toISOString(),
    reextractRejectReason: rejectReason?.trim() ?? null,
  };

  await db
    .update(fieldValues)
    .set({
      valueRaw: extraction.valueRaw,
      valueNormalized: null,
      valueIndicatorScore: null,
      provenance: newProvenance,
      status: 'pending_review',
      extractedAt: extraction.extractedAt,
      reviewedAt: null,
    })
    .where(eq(fieldValues.id, id));

  revalidatePath('/review');
  revalidatePath(`/review/${id}`);

  return {
    status: 'pending_review',
    valueRaw: extraction.valueRaw,
    sourceSentence: extraction.sourceSentence,
  };
}
