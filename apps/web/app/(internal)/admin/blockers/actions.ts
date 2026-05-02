'use server';

import { db, blockerDomains } from '@gtmi/db';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Phase 3.10 — manual override insert into the blocker_domains
 * registry. Adds a row with detection_signal='manual_override' so the
 * audit trail differentiates analyst-flagged blockers from the W15
 * auto-detected rows.
 *
 * Idempotent on conflict: existing rows have last_seen_at bumped and
 * the signal flipped to manual_override (the manual flag wins —
 * analyst saw it last).
 */
export async function addManualBlocker(formData: FormData): Promise<void> {
  const rawDomain = String(formData.get('domain') ?? '')
    .trim()
    .toLowerCase();
  const rawNote = String(formData.get('note') ?? '').trim();
  if (rawDomain === '') {
    throw new Error('Domain is required');
  }
  // Strip protocol / path if pasted by mistake.
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const notes = rawNote ? { manualNote: rawNote, addedAt: new Date().toISOString() } : null;

  await db
    .insert(blockerDomains)
    .values({
      domain,
      detectionSignal: 'manual_override',
      detectedForProgramId: null,
      notes,
    })
    .onConflictDoUpdate({
      target: blockerDomains.domain,
      set: {
        lastSeenAt: sql`now()`,
        detectionSignal: 'manual_override',
        notes,
      },
    });

  revalidatePath('/admin/blockers');
}

/**
 * Phase 3.10 — clear a blocker manually. Used when the analyst has
 * verified that a domain has fixed its anti-bot wall. The next canary
 * will exercise the full cascade against the domain again.
 */
export async function clearBlocker(formData: FormData): Promise<void> {
  const rawDomain = String(formData.get('domain') ?? '')
    .trim()
    .toLowerCase();
  if (rawDomain === '') {
    throw new Error('Domain is required');
  }
  await db.delete(blockerDomains).where(eq(blockerDomains.domain, rawDomain));
  revalidatePath('/admin/blockers');
}
