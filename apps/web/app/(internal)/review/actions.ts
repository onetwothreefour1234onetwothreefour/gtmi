'use server';

import { db, fieldValues, fieldDefinitions, reviewQueue } from '@gtmi/db';
import { normalizeRawValue, ScoringError } from '@gtmi/scoring';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function approveFieldValue(id: string, editedRaw?: string): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: null,
  };

  if (editedRaw !== undefined && editedRaw.trim().length > 0) {
    update['valueRaw'] = editedRaw;

    const defRows = await db
      .select({
        normalizationFn: fieldDefinitions.normalizationFn,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      })
      .from(fieldDefinitions)
      .innerJoin(fieldValues, eq(fieldValues.fieldDefinitionId, fieldDefinitions.id))
      .where(eq(fieldValues.id, id))
      .limit(1);

    if (defRows[0]) {
      try {
        const reNormalized = normalizeRawValue(editedRaw.trim(), defRows[0]);
        update['valueNormalized'] = reNormalized;
      } catch (err) {
        const msg = err instanceof ScoringError ? err.message : String(err);
        console.warn(`[approveFieldValue] Re-normalization failed for ${id}: ${msg}`);
        update['valueNormalized'] = null;
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(fieldValues).set(update).where(eq(fieldValues.id, id));
      await tx
        .update(reviewQueue)
        .set({ status: 'approved', resolvedAt: new Date() })
        .where(eq(reviewQueue.fieldValueId, id));
    });
  } catch (err) {
    console.error(`[review/actions] approve transaction failed for ${id}:`, err);
    throw err;
  }
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  redirect('/review');
}

export async function rejectFieldValue(id: string): Promise<void> {
  console.log(`[review/actions] reject called for field_value ${id}`);
  try {
    await db.transaction(async (tx) => {
      const updatedFv = await tx
        .update(fieldValues)
        .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: null })
        .where(eq(fieldValues.id, id))
        .returning({ id: fieldValues.id });
      if (updatedFv.length === 0) {
        throw new Error(`field_values row ${id} not found — reject is a no-op`);
      }
      const updatedRq = await tx
        .update(reviewQueue)
        .set({ status: 'rejected', resolvedAt: new Date() })
        .where(eq(reviewQueue.fieldValueId, id))
        .returning({ id: reviewQueue.id });
      console.log(
        `[review/actions] reject ${id}: field_values=${updatedFv.length} row, review_queue=${updatedRq.length} row(s)`
      );
    });
  } catch (err) {
    console.error(`[review/actions] reject transaction failed for ${id}:`, err);
    throw err;
  }
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  redirect('/review');
}

/**
 * Phase 4-E: bulk-approve every pending row that clears the auto-approve
 * gate (extractionConfidence ≥ 0.85, validationConfidence ≥ 0.85, and
 * provenance.isValid !== false). Triggered from the queue header after a
 * client-side confirmation dialog.
 *
 * Returns the count of approved rows so the caller can revalidate UI hints.
 * Wrapped in a single transaction so a failure rolls every row back.
 */
export async function bulkApproveHighConfidence(): Promise<{ approved: number }> {
  const candidates = await db
    .select({ id: fieldValues.id })
    .from(fieldValues)
    .where(
      and(
        eq(fieldValues.status, 'pending_review'),
        sql`(${fieldValues.provenance} ->> 'extractionConfidence')::float >= 0.85`,
        sql`(${fieldValues.provenance} ->> 'validationConfidence')::float >= 0.85`,
        sql`(${fieldValues.provenance} ->> 'isValid') IS DISTINCT FROM 'false'`
      )
    );

  if (candidates.length === 0) {
    return { approved: 0 };
  }

  const ids = candidates.map((c) => c.id);
  const reviewedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(fieldValues)
        .set({ status: 'approved', reviewedAt, reviewedBy: null })
        .where(inArray(fieldValues.id, ids));
      await tx
        .update(reviewQueue)
        .set({ status: 'approved', resolvedAt: reviewedAt })
        .where(inArray(reviewQueue.fieldValueId, ids));
    });
  } catch (err) {
    console.error(`[review/actions] bulk-approve transaction failed for ${ids.length} rows:`, err);
    throw err;
  }

  revalidatePath('/review');
  return { approved: ids.length };
}
