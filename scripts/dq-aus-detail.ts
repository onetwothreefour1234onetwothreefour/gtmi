import { db, fieldDefinitions, fieldValues, scores, client } from '@gtmi/db';
import { eq, and, sql } from 'drizzle-orm';

const programId = 'e1687f65-5959-469a-8615-d99ed20bac1b';

async function main() {
  const rows = await db
    .select({
      key: fieldDefinitions.key,
      label: fieldDefinitions.label,
      pillar: fieldDefinitions.pillar,
      subFactor: fieldDefinitions.subFactor,
      norm: fieldDefinitions.normalizationFn,
      dtype: fieldDefinitions.dataType,
      weight: fieldDefinitions.weightWithinSubFactor,
      tier2: fieldDefinitions.tier2Allowed,
      status: fieldValues.status,
      raw: fieldValues.valueRaw,
      norm_value: fieldValues.valueNormalized,
      score: fieldValues.valueIndicatorScore,
      prov: fieldValues.provenance,
    })
    .from(fieldDefinitions)
    .leftJoin(
      fieldValues,
      and(
        eq(fieldValues.fieldDefinitionId, fieldDefinitions.id),
        eq(fieldValues.programId, programId)
      )
    );

  console.log('TOTAL_DEFS:', rows.length);
  const missing = rows.filter((r) => !r.status);
  console.log('MISSING_FIELD_VALUES_COUNT:', missing.length);
  console.log('MISSING_KEYS:', missing.map((m) => m.key).join(','));

  const dup = await db.execute(sql`
    SELECT fd.key, count(*) AS n
    FROM field_values fv
    JOIN field_definitions fd ON fd.id = fv.field_definition_id
    WHERE fv.program_id = ${programId}
    GROUP BY fd.key HAVING count(*) > 1
  `);
  const dupArr = Array.isArray(dup) ? dup : ((dup as unknown as { rows?: unknown[] }).rows ?? []);
  console.log('DUPLICATES:', JSON.stringify(dupArr));

  console.log('\n--- SCORES TABLE ---');
  const sc = await db.select().from(scores).where(eq(scores.programId, programId));
  console.log(JSON.stringify(sc, null, 2));

  console.log('\n--- INDICATOR-SCORE SUMMARY ---');
  let scored = 0;
  let unscored = 0;
  const unscoredKeys: string[] = [];
  for (const r of rows) {
    if (r.score != null) scored++;
    else {
      unscored++;
      unscoredKeys.push(r.key);
    }
  }
  console.log('scored=', scored, 'unscored=', unscored);
  console.log('UNSCORED_KEYS:', unscoredKeys.join(','));

  console.log('\n--- COUNTS BY MODEL ---');
  const byModel: Record<string, number> = {};
  for (const r of rows) {
    const m = (r.prov as Record<string, unknown> | null)?.['extractionModel'] as string | undefined;
    const k = m ?? 'NO_PROV';
    byModel[k] = (byModel[k] ?? 0) + 1;
  }
  console.log(JSON.stringify(byModel, null, 2));

  console.log('\n--- COUNTS BY STATUS ---');
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const k = r.status ?? 'NO_FV';
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }
  console.log(JSON.stringify(byStatus, null, 2));

  console.log(
    '\n--- ROW DETAIL (key | pillar.sub | norm_fn | dtype | weight | status | score | model | tier | conf | raw | normalized) ---'
  );
  rows.sort((a, b) => a.key.localeCompare(b.key));
  for (const r of rows) {
    const p = (r.prov ?? {}) as Record<string, unknown>;
    console.log(
      [
        r.key,
        `${r.pillar}.${r.subFactor}`,
        r.norm ?? '-',
        r.dtype ?? '-',
        r.weight,
        r.status ?? 'NO_FV',
        r.score ?? '-',
        (p['extractionModel'] as string) ?? '-',
        (p['sourceTier'] as number | null) ?? '-',
        (p['extractionConfidence'] as number) ?? '-',
        (r.raw ?? '').toString().slice(0, 60),
        JSON.stringify(r.norm_value)?.slice(0, 60) ?? '-',
      ].join(' | ')
    );
  }

  console.log('\n--- INVARIANT CHECKS ---');
  for (const r of rows) {
    const p = (r.prov ?? {}) as Record<string, unknown>;
    const conf = (p['extractionConfidence'] as number) ?? 0;
    const status = r.status;
    const flags: string[] = [];
    if (status === 'approved' && conf < 0.85) flags.push(`approved-but-conf<0.85 (${conf})`);
    if (status === 'pending_review' && conf >= 0.85) flags.push(`pending-but-conf>=0.85 (${conf})`);
    const su = (p['sourceUrl'] as string) ?? '';
    const isDerivedKey = [
      'A.1.2',
      'D.2.2',
      'D.2.3',
      'B.2.4',
      'D.1.3',
      'D.1.4',
      'C.3.2',
      'E.3.1',
      'E.3.2',
    ].includes(r.key);
    if ((su.startsWith('derived-') || su.startsWith('internal:')) && !isDerivedKey)
      flags.push(`synthetic-source-on-non-derived (${su})`);
    if (flags.length > 0) console.log(`  ${r.key}: ${flags.join('; ')}`);
  }
}

main()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
