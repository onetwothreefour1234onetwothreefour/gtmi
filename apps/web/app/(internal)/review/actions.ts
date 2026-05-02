'use server';

import { db, fieldValues, fieldDefinitions, reviewQueue } from '@gtmi/db';
import { normalizeRawValue, PHASE2_PLACEHOLDER_PARAMS, scoreSingleIndicator } from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Phase 3.7 / ADR-017 — bidirectional review actions.
//
// Status transitions are now additive. The DB column is varchar(50)
// with no state-machine constraint, so any → any is allowed; the UI
// decides which control to show, the action accepts what the UI sends.
//
//   pending_review ──approve──▶ approved ──edit / unapprove / reject──┐
//          ▲                       │                                  │
//          │                       └────re-pending────▶ pending_review ─┘
//          │                                                           │
//          └────────────────────re-pending───────── rejected ◀──reject─┘
//
// Reviewer attribution is `null` until Cloud Run IAM / IAP lands;
// every transition still stamps `reviewed_at` so the row's last-touched
// time is accurate.

interface FieldDefForRow {
  id: string;
  key: string;
  pillar: string;
  subFactor: string;
  // drizzle returns decimal columns as strings; we cast to number when
  // building the FieldDefinitionRecord for scoring.
  weightWithinSubFactor: string;
  normalizationFn: string;
  direction: string;
  scoringRubricJsonb: unknown;
}

async function readFieldDefForRow(rowId: string): Promise<FieldDefForRow | null> {
  const rows = await db
    .select({
      id: fieldDefinitions.id,
      key: fieldDefinitions.key,
      pillar: fieldDefinitions.pillar,
      subFactor: fieldDefinitions.subFactor,
      weightWithinSubFactor: fieldDefinitions.weightWithinSubFactor,
      normalizationFn: fieldDefinitions.normalizationFn,
      direction: fieldDefinitions.direction,
      scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
    })
    .from(fieldDefinitions)
    .innerJoin(fieldValues, eq(fieldValues.fieldDefinitionId, fieldDefinitions.id))
    .where(eq(fieldValues.id, rowId))
    .limit(1);
  return rows[0] ?? null;
}

function computeScoreFor(
  def: FieldDefForRow,
  valueNormalized: unknown
): { score: string | null; valueNormalized: unknown } {
  if (valueNormalized === null || valueNormalized === undefined) {
    return { score: null, valueNormalized };
  }
  try {
    const fieldDefinition: FieldDefinitionRecord = {
      id: def.id,
      key: def.key,
      pillar: def.pillar,
      subFactor: def.subFactor,
      weightWithinSubFactor: Number(def.weightWithinSubFactor),
      normalizationFn: def.normalizationFn as FieldDefinitionRecord['normalizationFn'],
      direction: def.direction as FieldDefinitionRecord['direction'],
      scoringRubricJsonb: def.scoringRubricJsonb as FieldDefinitionRecord['scoringRubricJsonb'],
    };
    const score = scoreSingleIndicator({
      fieldDefinition,
      valueNormalized,
      normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
    });
    return { score: score === null ? null : String(score), valueNormalized };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[review/actions] scoreSingleIndicator failed for ${def.key}: ${msg}`);
    return { score: null, valueNormalized };
  }
}

/**
 * Approve a row. Accepted from any starting status — the UI shows the
 * button only when it makes sense. Optionally rewrites the raw value
 * (re-runs normalization + scoring).
 */
export async function approveFieldValue(id: string, editedRaw?: string): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: null,
  };

  // If the analyst supplied an edited raw, re-normalize and re-score.
  // Otherwise leave the existing value_normalized + value_indicator_score
  // untouched.
  if (editedRaw !== undefined && editedRaw.trim().length > 0) {
    update['valueRaw'] = editedRaw.trim();
    const def = await readFieldDefForRow(id);
    if (def) {
      try {
        const reNormalized = normalizeRawValue(editedRaw.trim(), {
          normalizationFn: def.normalizationFn,
          scoringRubricJsonb: def.scoringRubricJsonb,
        });
        update['valueNormalized'] = reNormalized;
        const { score } = computeScoreFor(def, reNormalized);
        update['valueIndicatorScore'] = score;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[approveFieldValue] Re-normalization failed for ${id}: ${msg}`);
        update['valueNormalized'] = null;
        update['valueIndicatorScore'] = null;
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

/**
 * Reject a row. Accepted from any starting status. Optional `reason`
 * is persisted into provenance.rejectReason (jsonb merge) so the audit
 * trail survives.
 */
export async function rejectFieldValue(id: string, reason?: string): Promise<void> {
  console.log(`[review/actions] reject called for field_value ${id}`);
  const trimmed = reason?.trim();
  try {
    await db.transaction(async (tx) => {
      // Merge rejectReason into provenance jsonb when a reason is given.
      // Otherwise leave provenance untouched.
      const updateClause: Record<string, unknown> = {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: null,
      };
      if (trimmed) {
        updateClause['provenance'] =
          sql`coalesce(${fieldValues.provenance}, '{}'::jsonb) || jsonb_build_object('rejectReason', ${trimmed}::text)`;
      }
      const updatedFv = await tx
        .update(fieldValues)
        .set(updateClause)
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
 * Phase 3.7 / ADR-017 — edit an already-approved row.
 *
 * Rewrites valueRaw, re-runs normalizeRawValue, recomputes
 * value_indicator_score, stamps reviewed_at. Status STAYS approved.
 *
 * Throws if no editedRaw is supplied.
 */
export async function editApprovedFieldValue(id: string, editedRaw: string): Promise<void> {
  if (!editedRaw || editedRaw.trim().length === 0) {
    throw new Error('editApprovedFieldValue: editedRaw is required');
  }
  const trimmed = editedRaw.trim();
  const def = await readFieldDefForRow(id);
  if (!def) {
    throw new Error(`editApprovedFieldValue: no row or field_definition for id ${id}`);
  }

  const update: Record<string, unknown> = {
    valueRaw: trimmed,
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: null,
  };

  try {
    const reNormalized = normalizeRawValue(trimmed, {
      normalizationFn: def.normalizationFn,
      scoringRubricJsonb: def.scoringRubricJsonb,
    });
    update['valueNormalized'] = reNormalized;
    const { score } = computeScoreFor(def, reNormalized);
    update['valueIndicatorScore'] = score;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[editApprovedFieldValue] Re-normalization failed for ${id}: ${msg}`);
    update['valueNormalized'] = null;
    update['valueIndicatorScore'] = null;
  }

  try {
    await db.update(fieldValues).set(update).where(eq(fieldValues.id, id));
  } catch (err) {
    console.error(`[review/actions] edit-approved update failed for ${id}:`, err);
    throw err;
  }
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  redirect(`/review/${id}`);
}

/**
 * Phase 3.7 / ADR-017 — re-pend an approved or rejected row.
 *
 * Sets status='pending_review', clears reviewed_at. The row's
 * valueRaw / valueNormalized / valueIndicatorScore are kept so the
 * analyst can see the prior decision. The review_queue row is reset
 * to pending; if no review_queue row exists (e.g. the field was
 * auto-approved without ever being queued), a new one is inserted so
 * the queue page surfaces it again.
 */
export async function unapproveFieldValue(id: string): Promise<void> {
  console.log(`[review/actions] unapprove called for field_value ${id}`);
  try {
    await db.transaction(async (tx) => {
      const updatedFv = await tx
        .update(fieldValues)
        .set({ status: 'pending_review', reviewedAt: null, reviewedBy: null })
        .where(eq(fieldValues.id, id))
        .returning({ id: fieldValues.id });
      if (updatedFv.length === 0) {
        throw new Error(`field_values row ${id} not found — unapprove is a no-op`);
      }
      const updatedRq = await tx
        .update(reviewQueue)
        .set({ status: 'pending_review', resolvedAt: null })
        .where(eq(reviewQueue.fieldValueId, id))
        .returning({ id: reviewQueue.id });
      if (updatedRq.length === 0) {
        // No queue row exists for this field-value — insert one so the
        // pending list surfaces it again.
        await tx.insert(reviewQueue).values({
          fieldValueId: id,
          flaggedReason: 'Re-pended via /review',
          priority: 50,
          status: 'pending_review',
        });
      }
    });
  } catch (err) {
    console.error(`[review/actions] unapprove transaction failed for ${id}:`, err);
    throw err;
  }
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  redirect(`/review/${id}`);
}

/**
 * Phase 3.8 / ADR-020 — bulk-approve EVERY pending row regardless of
 * confidence. Distinct from the existing high-confidence path: this
 * SKIPS the extractionConfidence ≥ 0.85 / validationConfidence ≥ 0.85
 * gate so the analyst can clear borderline rows after eyeballing them.
 *
 * The ADR-019 categorical-rubric gate STAYS ON — out-of-rubric raws
 * (e.g. C.3.1 'not_stated') still cannot one-click approve into the
 * public score. Methodology integrity is non-negotiable; the only thing
 * being relaxed is "is the LLM confident enough".
 *
 * Returns the count approved. Wrapped in a single transaction so a
 * partial failure rolls every row back.
 */
export async function bulkApproveAllPending(): Promise<{ approved: number }> {
  const candidates = await db
    .select({ id: fieldValues.id })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(
      and(
        eq(fieldValues.status, 'pending_review'),
        sql`(
          ${fieldDefinitions.normalizationFn} <> 'categorical'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(${fieldDefinitions.scoringRubricJsonb} -> 'categories') AS elem
            WHERE elem ->> 'value' = ${fieldValues.valueRaw}
          )
        )`
      )
    );

  if (candidates.length === 0) return { approved: 0 };

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
    console.error(
      `[review/actions] bulkApproveAllPending transaction failed for ${ids.length} rows:`,
      err
    );
    throw err;
  }

  console.log(`[review/actions] bulkApproveAllPending approved ${ids.length} rows`);
  revalidatePath('/review');
  return { approved: ids.length };
}

/**
 * Phase 4-E: bulk-approve every pending row that clears the auto-approve
 * gate (extractionConfidence ≥ 0.85, validationConfidence ≥ 0.85, and
 * provenance.isValid !== false). Triggered from the queue header after a
 * client-side confirmation dialog.
 *
 * Phase 3.7 / ADR-019 adds a categorical-rubric EXISTS clause so
 * coverage-gap sentinels (`not_stated`, `not_addressed`) cannot
 * one-click approve into the public score.
 *
 * Returns the count of approved rows so the caller can revalidate UI hints.
 * Wrapped in a single transaction so a failure rolls every row back.
 */
export async function bulkApproveHighConfidence(): Promise<{ approved: number }> {
  const candidates = await db
    .select({ id: fieldValues.id })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(
      and(
        eq(fieldValues.status, 'pending_review'),
        sql`(${fieldValues.provenance} ->> 'extractionConfidence')::float >= 0.85`,
        sql`(${fieldValues.provenance} ->> 'validationConfidence')::float >= 0.85`,
        sql`(${fieldValues.provenance} ->> 'isValid') IS DISTINCT FROM 'false'`,
        sql`(
          ${fieldDefinitions.normalizationFn} <> 'categorical'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(${fieldDefinitions.scoringRubricJsonb} -> 'categories') AS elem
            WHERE elem ->> 'value' = ${fieldValues.valueRaw}
          )
        )`
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

// Phase 3.10b.7 — review-queue assignment.
//
// Pre-auth: the UUID is supplied by the analyst (pasted into the
// inline prompt or arriving via the ?reviewer=… URL param). Post-auth
// (Phase 5 / IAP), a thin wrapper will pull the current Supabase user
// id and pass it through.
//
// Idempotent: re-assignment to the same user bumps assigned_at; null
// clears both columns; transitions don't fight the existing approve /
// reject flow.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assignReviewer(formData: FormData): Promise<void> {
  const rowId = String(formData.get('rowId') ?? '').trim();
  const reviewerRaw = String(formData.get('reviewer') ?? '').trim();
  if (!UUID_RE.test(rowId)) throw new Error('assignReviewer: invalid rowId');
  if (reviewerRaw !== '' && !UUID_RE.test(reviewerRaw)) {
    throw new Error('assignReviewer: reviewer must be a UUID or empty');
  }
  const reviewer = reviewerRaw === '' ? null : reviewerRaw;
  await db
    .update(reviewQueue)
    .set({
      assignedTo: reviewer,
      assignedAt: reviewer ? new Date() : null,
    })
    .where(eq(reviewQueue.fieldValueId, rowId));
  revalidatePath('/review');
}
