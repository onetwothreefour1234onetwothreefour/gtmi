'use server';

import { db, fieldValues, fieldDefinitions } from '@gtmi/db';
import { normalizeRawValue, ScoringError } from '@gtmi/scoring';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireReviewer(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
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

  await db.update(fieldValues).set(update).where(eq(fieldValues.id, id));
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
}

export async function rejectFieldValue(id: string): Promise<void> {
  const userId = await requireReviewer();
  await db
    .update(fieldValues)
    .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: userId })
    .where(eq(fieldValues.id, id));
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
}
