/**
 * Phase 2 audit — read-only verification of PAQ scoring state.
 */
import { db, fieldDefinitions, fieldValues, countries, scores, programs } from '@gtmi/db';
import { eq, and } from 'drizzle-orm';

async function main() {
  const PROGRAM_ID = 'e1687f65-5959-469a-8615-d99ed20bac1b';

  // 1. The written score row
  console.log('\n=== 1. SCORES ROW ===');
  const scoreRows = await db.select().from(scores).where(eq(scores.programId, PROGRAM_ID));
  for (const s of scoreRows) {
    console.log(JSON.stringify(s, null, 2));
  }

  // 2. AUS country CME columns
  console.log('\n=== 2. AUS COUNTRY ROW ===');
  const aus = await db.select().from(countries).where(eq(countries.isoCode, 'AUS'));
  for (const c of aus) {
    console.log(JSON.stringify(c, null, 2));
  }

  // 3. Approved + queued field values for the program
  console.log('\n=== 3. FIELD VALUES FOR PROGRAM ===');
  const fvs = await db
    .select({
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      valueRaw: fieldValues.valueRaw,
      valueNormalized: fieldValues.valueNormalized,
      status: fieldValues.status,
    })
    .from(fieldValues)
    .where(eq(fieldValues.programId, PROGRAM_ID));

  const defs = await db.select().from(fieldDefinitions);
  const defById = new Map(defs.map((d) => [d.id, d]));

  const enriched = fvs.map((fv) => {
    const d = defById.get(fv.fieldDefinitionId);
    return {
      key: d?.key ?? '?',
      label: d?.label ?? '?',
      pillar: d?.pillar,
      subFactor: d?.subFactor,
      normalizationFn: d?.normalizationFn,
      direction: d?.direction,
      weightWithinSubFactor: d?.weightWithinSubFactor,
      status: fv.status,
      valueRaw:
        typeof fv.valueRaw === 'string' ? fv.valueRaw.slice(0, 120) : JSON.stringify(fv.valueRaw),
      valueNormalized: fv.valueNormalized,
    };
  });
  enriched.sort((a, b) => (a.status + a.key).localeCompare(b.status + b.key));
  for (const e of enriched) {
    console.log(
      `[${e.status.padEnd(10)}] ${e.key.padEnd(8)} pillar=${e.pillar} subF=${e.subFactor} normFn=${e.normalizationFn} dir=${e.direction} w=${e.weightWithinSubFactor} normVal=${JSON.stringify(e.valueNormalized)} raw=${e.valueRaw}`
    );
  }

  // 4. Program row (sanity)
  console.log('\n=== 4. PROGRAM ROW ===');
  const prg = await db.select().from(programs).where(eq(programs.id, PROGRAM_ID));
  console.log(JSON.stringify(prg[0], null, 2));

  // 5. E.2.2 field definition — full rubric
  console.log('\n=== 5. E.2.2 FIELD DEFINITION ===');
  const e22 = defs.find((d) => d.key === 'E.2.2');
  console.log(JSON.stringify(e22, null, 2));

  // 6. A.3.2 field definition — for the rubric mismatch bug
  console.log('\n=== 6. A.3.2 FIELD DEFINITION ===');
  const a32 = defs.find((d) => d.key === 'A.3.2');
  console.log(JSON.stringify(a32, null, 2));

  // 7. Methodology-scope summary
  console.log('\n=== 7. METHODOLOGY SCOPE ===');
  console.log(`Total field definitions in DB: ${defs.length}`);
  const byPillar: Record<string, number> = {};
  const bySubFactor: Record<string, number> = {};
  for (const d of defs) {
    byPillar[d.pillar] = (byPillar[d.pillar] ?? 0) + 1;
    bySubFactor[d.subFactor] = (bySubFactor[d.subFactor] ?? 0) + 1;
  }
  console.log('By pillar:', byPillar);
  console.log('By sub-factor:', bySubFactor);

  // 8. Approved field values — raw view of what scoring consumed
  console.log('\n=== 8. APPROVED FIELD VALUES (what was scored) ===');
  const approved = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, PROGRAM_ID), eq(fieldValues.status, 'approved')));
  for (const fv of approved) {
    const d = defById.get(fv.fieldDefinitionId);
    console.log(
      `  ${d?.key}: normFn=${d?.normalizationFn} dir=${d?.direction} w=${d?.weightWithinSubFactor} raw=${JSON.stringify(fv.valueRaw).slice(0, 80)} norm=${JSON.stringify(fv.valueNormalized)}`
    );
    console.log(`    provenance: ${JSON.stringify(fv.provenance).slice(0, 200)}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
