// Phase 3.7 / ADR-019 — one-off cleanup. Reverts C.3.1 rows that were
// auto-approved past the bulk-approve gate while holding
// valueRaw='not_stated' (a coverage-gap sentinel that is NOT in the
// rubric `[full_access, levy_required, insurance_required, emergency_only,
// no_access]`). Diagnostic on 2026-04-29 found 3 such rows.
//
// Sets status='pending_review' and clears reviewed_at so the analyst
// has to re-decide each one (map to a real rubric value, or reject).
//
// Usage:
//   pnpm exec tsx scripts/fix-c31-not-stated-leak.ts            # dry run
//   pnpm exec tsx scripts/fix-c31-not-stated-leak.ts --execute  # apply
import { client, db, fieldDefinitions, fieldValues } from '@gtmi/db';
import { and, eq, sql } from 'drizzle-orm';

(async () => {
  const execute = process.argv.includes('--execute');
  const mode = execute ? 'EXECUTE' : 'DRY-RUN';
  console.log(`[fix-c31-not-stated-leak] mode=${mode}`);

  const c31 = await db
    .select({ id: fieldDefinitions.id, key: fieldDefinitions.key })
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.key, 'C.3.1'))
    .limit(1);
  if (c31.length === 0) {
    console.error('FATAL: no field_definition with key=C.3.1 found.');
    await client.end({ timeout: 5 });
    process.exit(1);
  }
  const c31Id = c31[0]!.id;

  const offending = await db
    .select({
      id: fieldValues.id,
      programId: fieldValues.programId,
      valueRaw: fieldValues.valueRaw,
      status: fieldValues.status,
      reviewedAt: fieldValues.reviewedAt,
    })
    .from(fieldValues)
    .where(
      and(
        eq(fieldValues.fieldDefinitionId, c31Id),
        eq(fieldValues.status, 'approved'),
        eq(fieldValues.valueRaw, 'not_stated')
      )
    );

  console.log(`Offending rows: ${offending.length}`);
  for (const r of offending) {
    console.log(
      `  row ${r.id}  program=${r.programId}  reviewedAt=${r.reviewedAt?.toISOString() ?? '(null)'}`
    );
  }

  if (offending.length === 0) {
    console.log('Nothing to revert.');
    await client.end({ timeout: 5 });
    process.exit(0);
  }

  if (!execute) {
    console.log('\nDry run — pass --execute to apply.');
    await client.end({ timeout: 5 });
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(fieldValues)
      .set({ status: 'pending_review', reviewedAt: null, valueIndicatorScore: null })
      .where(
        and(
          eq(fieldValues.fieldDefinitionId, c31Id),
          eq(fieldValues.status, 'approved'),
          eq(fieldValues.valueRaw, 'not_stated')
        )
      );
  });
  console.log(`Reverted ${offending.length} C.3.1 rows back to pending_review.`);

  // Sanity check.
  const after = (await db.execute(sql`
    SELECT count(*)::int AS n
    FROM field_values fv
    JOIN field_definitions fd ON fd.id = fv.field_definition_id
    WHERE fd.key = 'C.3.1'
      AND fv.status = 'approved'
      AND fv.value_raw = 'not_stated'
  `)) as unknown as Array<{ n: number }>;
  console.log(`Remaining C.3.1 'not_stated' approved rows: ${after[0]?.n ?? '?'}`);

  await client.end({ timeout: 5 });
  process.exit(0);
})().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    await client.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
