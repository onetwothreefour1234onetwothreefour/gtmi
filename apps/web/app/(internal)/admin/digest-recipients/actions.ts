'use server';

import { db, digestRecipients } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO3_RE = /^[A-Z]{3}$/;

const VALID_SEVERITIES = new Set(['breaking', 'material', 'minor', 'url_broken', 'imd_refresh']);

function parseCsvList(raw: FormDataEntryValue | null): string[] | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Phase 3.10d / J.3 — insert a recipient. tenantId is intentionally
 * pinned to NULL today; ADR-027 step 2 (Firebase Auth) is what
 * lights up real per-tenant rows.
 */
export async function createDigestRecipient(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('createDigestRecipient: invalid email');

  const severityRaw = parseCsvList(formData.get('severityFilter'));
  const countryRaw = parseCsvList(formData.get('countryIsoFilter'));

  if (severityRaw) {
    for (const s of severityRaw) {
      if (!VALID_SEVERITIES.has(s)) {
        throw new Error(
          `createDigestRecipient: severity "${s}" must be one of ${Array.from(VALID_SEVERITIES).join(', ')}`
        );
      }
    }
  }
  if (countryRaw) {
    for (const c of countryRaw) {
      if (!ISO3_RE.test(c)) {
        throw new Error(
          `createDigestRecipient: countryIsoFilter "${c}" must be 3 uppercase letters`
        );
      }
    }
  }

  await db
    .insert(digestRecipients)
    .values({
      email,
      tenantId: null,
      severityFilter: severityRaw,
      countryIsoFilter: countryRaw,
      active: true,
    })
    .onConflictDoUpdate({
      target: [digestRecipients.tenantId, digestRecipients.email],
      set: {
        active: true,
        severityFilter: severityRaw,
        countryIsoFilter: countryRaw,
        updatedAt: new Date(),
      },
    });

  revalidatePath('/admin/digest-recipients');
}

export async function toggleDigestRecipient(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const next = String(formData.get('active') ?? '').trim() === 'true';
  if (!UUID_RE.test(id)) throw new Error('toggleDigestRecipient: invalid id');

  await db
    .update(digestRecipients)
    .set({ active: next, updatedAt: new Date() })
    .where(eq(digestRecipients.id, id));
  revalidatePath('/admin/digest-recipients');
}

export async function deleteDigestRecipient(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!UUID_RE.test(id)) throw new Error('deleteDigestRecipient: invalid id');
  await db.delete(digestRecipients).where(eq(digestRecipients.id, id));
  revalidatePath('/admin/digest-recipients');
}
