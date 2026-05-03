'use server';

import { db, programs } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^[A-Z]{3}$/;

const VALID_STATUSES = new Set(['active', 'closed', 'proposed', 'paused']);

function parseYear(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return n;
}

/**
 * Phase 3.10d / D.5 — create a new programme row.
 *
 * Sources, field_values, and downstream extraction are populated by the
 * pipeline; this surface only seeds the row so an analyst can hand-add a
 * programme without a code change.
 */
export async function createProgram(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const countryIso = String(formData.get('countryIso') ?? '')
    .trim()
    .toUpperCase();
  const category = String(formData.get('category') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const launchYear = parseYear(formData.get('launchYear'));
  const closureYear = parseYear(formData.get('closureYear'));

  if (name === '') throw new Error('createProgram: name is required');
  if (!ISO_RE.test(countryIso)) throw new Error('createProgram: countryIso must be 3 letters');
  if (category === '') throw new Error('createProgram: category is required');
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `createProgram: status must be one of ${Array.from(VALID_STATUSES).join(', ')}`
    );
  }

  const inserted = await db
    .insert(programs)
    .values({
      countryIso,
      name,
      category,
      status,
      launchYear,
      closureYear,
    })
    .returning({ id: programs.id });

  revalidatePath('/admin/programs');
  if (inserted[0]) {
    redirect(`/admin/programs/${inserted[0].id}`);
  }
}

/**
 * Phase 3.10d / D.5 — update a programme row's editable surface.
 * Only name / category / status / launchYear / closureYear are
 * editable; countryIso is intentionally pinned (changing it would
 * orphan field_values and scores against the wrong CME).
 */
export async function updateProgram(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!UUID_RE.test(id)) throw new Error('updateProgram: invalid id');

  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const launchYear = parseYear(formData.get('launchYear'));
  const closureYear = parseYear(formData.get('closureYear'));

  if (name === '') throw new Error('updateProgram: name is required');
  if (category === '') throw new Error('updateProgram: category is required');
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `updateProgram: status must be one of ${Array.from(VALID_STATUSES).join(', ')}`
    );
  }

  await db
    .update(programs)
    .set({
      name,
      category,
      status,
      launchYear,
      closureYear,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, id));

  revalidatePath('/admin/programs');
  revalidatePath(`/admin/programs/${id}`);
  revalidatePath(`/programs/${id}`);
}
