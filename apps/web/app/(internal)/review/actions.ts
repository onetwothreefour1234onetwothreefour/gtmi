'use server';

import { db, fieldValues, fieldDefinitions, reviewQueue } from '@gtmi/db';
import { normalizeRawValue, ScoringError } from '@gtmi/scoring';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireReviewer(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error('[review/actions] requireReviewer: no authenticated user');
    throw new Error('Unauthorized');
  }
  return user.id;
}

export async function approveFieldValue(id: string, editedRaw?: string): Promise<void> {
  const userId = await requireReviewer();

  const update: Record<string, unknown> = {
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  if (editedRaw !== undefined && editedRaw.trim().length > 0) {
    update['valueRaw'] = editedRaw;

    // Re-run normalization so value_normalized stays in sync with the edited raw value.
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
        // Log but don't block the approve — reviewer may be entering a non-numeric value
        // that the LLM would also not be able to normalize. Surface in DB as null.
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
  // redirect throws NEXT_REDIRECT; must be the final statement so the framework
  // intercepts it. Do not wrap in try/catch — that swallows the redirect signal.
  redirect('/review');
}

export async function rejectFieldValue(id: string): Promise<void> {
  const userId = await requireReviewer();
  console.log(`[review/actions] reject called for field_value ${id} by ${userId}`);
  try {
    await db.transaction(async (tx) => {
      const updatedFv = await tx
        .update(fieldValues)
        .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: userId })
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
  // redirect throws NEXT_REDIRECT; must be the final statement so the framework
  // intercepts it. Do not wrap in try/catch — that swallows the redirect signal.
  redirect('/review');
}
