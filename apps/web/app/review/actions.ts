'use server';

import { db, fieldValues } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// PLACEHOLDER: no auth wired yet — these actions will gate on the team-member
// role once Supabase auth is connected. For internal use only.

export async function approveFieldValue(id: string, editedRaw?: string): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'approved',
    reviewedAt: new Date(),
  };
  if (editedRaw !== undefined && editedRaw.trim().length > 0) {
    update['valueRaw'] = editedRaw;
    // NOTE: valueNormalized is left stale on manual edit. Full UI should
    // re-run the normalization pipeline or expose structured inputs.
  }
  await db.update(fieldValues).set(update).where(eq(fieldValues.id, id));
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
}

export async function rejectFieldValue(id: string): Promise<void> {
  await db
    .update(fieldValues)
    .set({ status: 'rejected', reviewedAt: new Date() })
    .where(eq(fieldValues.id, id));
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
}
