/**
 * Phase 3.6.4 — one-off re-derivation for SGP S Pass after FIX 1
 * (currency bare-$ inference) and FIX 2 (D.1.2 country-level lookup).
 *
 * Idempotent: re-running produces the same outputs.
 *
 * Steps:
 *   1. Patch the existing A.1.1 row's provenance.valueCurrency for SGP
 *      S Pass if it was left null (LLM returned "$3,300" → bare $ →
 *      pre-FIX 1 detectCurrency couldn't infer SGD). Re-derive A.1.2.
 *   2. Re-derive D.1.2 from COUNTRY_PR_TIMELINE (FIX 2 — was previously
 *      LLM_MISS for SGP).
 *   3. Re-derive D.2.2 using the freshly-derived D.1.2 + SGP
 *      citizenship-residence years.
 *
 * Usage:
 *   pnpm exec tsx scripts/phase-3-6-4-sgp-rederive.ts
 */

import 'dotenv/config';
import { client, db, fieldDefinitions, fieldValues, programs } from '@gtmi/db';
import {
  COUNTRY_CITIZENSHIP_RESIDENCE_YEARS,
  COUNTRY_MEDIAN_WAGE,
  COUNTRY_PR_TIMELINE,
  FX_RATES,
  PublishStageImpl,
  deriveA12,
  deriveD12,
  deriveD22,
  detectCurrency,
} from '@gtmi/extraction';
import { and, eq } from 'drizzle-orm';

const PROGRAM_ID = 'b72e8153-6c3f-4c11-9a90-72cd7cc3c81d'; // SGP S Pass
const METHODOLOGY_VERSION = '1.0.0';

async function patchA11CurrencyAndRederiveA12(countryIso: string): Promise<void> {
  console.log('\n[1/3] Patching A.1.1 valueCurrency and re-deriving A.1.2...');
  const fdRows = await db
    .select({ id: fieldDefinitions.id })
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.key, 'A.1.1'))
    .limit(1);
  if (fdRows.length === 0) throw new Error('A.1.1 field_definition missing');
  const fdId = fdRows[0]!.id;
  const fvRows = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, PROGRAM_ID), eq(fieldValues.fieldDefinitionId, fdId)))
    .limit(1);
  if (fvRows.length === 0) {
    console.log('  No A.1.1 row exists for SGP S Pass; cannot patch.');
    return;
  }
  const row = fvRows[0]!;
  const prov = (row.provenance ?? {}) as Record<string, unknown>;
  const existingCurrency = prov['valueCurrency'] as string | undefined;
  const valueRaw = row.valueRaw ?? '';
  let valueCurrency: string | null = existingCurrency ?? null;
  if (!valueCurrency) {
    const detected = detectCurrency(valueRaw, countryIso);
    if (detected) {
      valueCurrency = detected.code;
      const updated = { ...prov, valueCurrency: detected.code };
      await db
        .update(fieldValues)
        .set({ provenance: updated as never })
        .where(eq(fieldValues.id, row.id));
      console.log(
        `  A.1.1 valueCurrency patched: "${valueRaw}" + countryIso=${countryIso} → ${detected.code}`
      );
    } else {
      console.log(
        `  A.1.1 valueCurrency could not be inferred from "${valueRaw}"; skipping A.1.2.`
      );
      return;
    }
  } else {
    console.log(`  A.1.1 valueCurrency already set: ${valueCurrency}; skipping patch.`);
  }

  const a12 = deriveA12({
    programId: PROGRAM_ID,
    countryIso,
    methodologyVersion: METHODOLOGY_VERSION,
    a11ValueRaw: valueRaw,
    a11ValueCurrency: valueCurrency,
    a11SourceUrl: (prov['sourceUrl'] as string) ?? null,
    medianWage: COUNTRY_MEDIAN_WAGE[countryIso] ?? null,
    fxRate: valueCurrency ? (FX_RATES[valueCurrency.toUpperCase()] ?? null) : null,
  });
  if (!a12) {
    console.log('  deriveA12 returned null (skip-condition triggered).');
    return;
  }
  const publish = new PublishStageImpl();
  await publish.executeDerived(a12.extraction, a12.provenance);
  console.log(
    `  A.1.2 derived = ${a12.numericValue}% (raw=${a12.extraction.valueRaw}); pending_review.`
  );
}

async function rederiveD12(countryIso: string): Promise<void> {
  console.log('\n[2/3] Re-deriving D.1.2 from COUNTRY_PR_TIMELINE...');
  const policy = COUNTRY_PR_TIMELINE[countryIso] ?? null;
  const result = deriveD12({
    programId: PROGRAM_ID,
    countryIso,
    methodologyVersion: METHODOLOGY_VERSION,
    policy,
  });
  if (!result) {
    console.log('  deriveD12 returned null; D.1.2 stays missing.');
    return;
  }
  const publish = new PublishStageImpl();
  await publish.executeDerived(result.extraction, result.provenance);
  console.log(`  D.1.2 derived = ${result.numericValue} years; pending_review.`);
}

async function rederiveD22(countryIso: string): Promise<void> {
  console.log('\n[3/3] Re-deriving D.2.2 using new D.1.2 + citizenship-residence...');
  const timeline = COUNTRY_PR_TIMELINE[countryIso] ?? null;
  const citizenship = COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[countryIso] ?? null;
  if (!timeline || timeline.d12MinYearsToPr === null || !citizenship) {
    console.log('  D.2.2 inputs incomplete; skip.');
    return;
  }
  const result = deriveD22({
    programId: PROGRAM_ID,
    countryIso,
    methodologyVersion: METHODOLOGY_VERSION,
    d11Boolean: true, // SGP D.1.1 was extracted as true
    d12Years: timeline.d12MinYearsToPr,
    d12SourceUrl: timeline.sourceUrl,
    citizenshipResidence: citizenship,
  });
  if (!result) {
    console.log('  deriveD22 returned null.');
    return;
  }
  const publish = new PublishStageImpl();
  await publish.executeDerived(result.extraction, result.provenance);
  console.log(`  D.2.2 derived = ${result.numericValue} years; pending_review.`);
}

async function main(): Promise<void> {
  const programRows = await db.select().from(programs).where(eq(programs.id, PROGRAM_ID));
  if (programRows.length === 0) throw new Error(`No program ${PROGRAM_ID}`);
  const countryIso = programRows[0]!.countryIso;

  await patchA11CurrencyAndRederiveA12(countryIso);
  await rederiveD12(countryIso);
  await rederiveD22(countryIso);

  console.log('\nPhase 3.6.4 SGP re-derivation — done.');
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
