'use server';

import { db, methodologyVersions } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Phase 3.10d / D.4 — light-touch edit of methodology_versions.change_notes.
 *
 * Weights, normalization choices, rubrics, and CME/PAQ split are intentionally
 * NOT editable here: a wrong click would silently break the public composite.
 * Those are still source-of-truth in code (packages/scoring + seed); this
 * surface only edits the human-readable changelog.
 */
export async function updateMethodologyChangeNotes(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const notes = String(formData.get('changeNotes') ?? '').trim();
  if (!UUID_RE.test(id)) {
    throw new Error('updateMethodologyChangeNotes: invalid id');
  }
  await db
    .update(methodologyVersions)
    .set({ changeNotes: notes === '' ? null : notes })
    .where(eq(methodologyVersions.id, id));
  revalidatePath('/admin/methodology');
}
