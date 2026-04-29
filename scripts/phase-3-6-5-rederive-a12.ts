/**
 * Phase 3.6.5 — re-derive A.1.2 with monthly/annual unit detection.
 *
 * Targets both AUS 482 (annual A.1.1 → no annualisation, ~80% expected)
 * and SGP S Pass (monthly A.1.1 → ×12 annualisation, ~49% expected) to
 * confirm the fix produces the right value in both directions.
 *
 * Reads each program's existing A.1.1 row provenance (valueRaw,
 * valueCurrency, sourceUrl, sourceSentence) and replays deriveA12 with
 * the source-sentence-driven unit detection.
 *
 * Idempotent: re-running produces the same outputs.
 */

import 'dotenv/config';
import { client, db, fieldDefinitions, fieldValues, programs } from '@gtmi/db';
import { COUNTRY_MEDIAN_WAGE, FX_RATES, PublishStageImpl, deriveA12 } from '@gtmi/extraction';
import { and, eq } from 'drizzle-orm';

const TARGETS = [
  { id: 'e1687f65-5959-469a-8615-d99ed20bac1b', label: 'AUS 482 Core Skills Stream' },
  { id: 'b72e8153-6c3f-4c11-9a90-72cd7cc3c81d', label: 'SGP S Pass' },
];

async function rederiveA12(programId: string, label: string): Promise<void> {
  console.log(`\n=== ${label} (${programId}) ===`);
  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  if (programRows.length === 0) {
    console.log(`  [skip] no program row.`);
    return;
  }
  const countryIso = programRows[0]!.countryIso;

  const fdRows = await db
    .select({ id: fieldDefinitions.id })
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.key, 'A.1.1'))
    .limit(1);
  const fdId = fdRows[0]!.id;

  const fvRows = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, programId), eq(fieldValues.fieldDefinitionId, fdId)))
    .limit(1);
  if (fvRows.length === 0) {
    console.log(`  [skip] no A.1.1 row.`);
    return;
  }
  const a11Row = fvRows[0]!;
  const prov = (a11Row.provenance ?? {}) as Record<string, unknown>;
  const valueRaw = a11Row.valueRaw ?? '';
  const valueCurrency = (prov['valueCurrency'] as string) ?? null;
  const sourceUrl = (prov['sourceUrl'] as string) ?? null;
  const sourceSentence = (prov['sourceSentence'] as string) ?? null;

  console.log(`  A.1.1 raw="${valueRaw}" currency=${valueCurrency}`);
  console.log(`  A.1.1 sourceSentence="${(sourceSentence ?? '').slice(0, 100)}"`);

  const r = deriveA12({
    programId,
    countryIso,
    methodologyVersion: '1.0.0',
    a11ValueRaw: valueRaw,
    a11ValueCurrency: valueCurrency,
    a11SourceUrl: sourceUrl,
    a11SourceSentence: sourceSentence,
    medianWage: COUNTRY_MEDIAN_WAGE[countryIso] ?? null,
    fxRate: valueCurrency ? (FX_RATES[valueCurrency.toUpperCase()] ?? null) : null,
  });
  if (!r) {
    console.log(`  deriveA12 returned null.`);
    return;
  }
  const publish = new PublishStageImpl();
  await publish.executeDerived(r.extraction, r.provenance);
  console.log(`  A.1.2 = ${r.numericValue}% (raw=${r.extraction.valueRaw}); pending_review.`);
}

async function main() {
  for (const t of TARGETS) await rederiveA12(t.id, t.label);
  console.log('\nPhase 3.6.5 A.1.2 re-derivation — done.');
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
