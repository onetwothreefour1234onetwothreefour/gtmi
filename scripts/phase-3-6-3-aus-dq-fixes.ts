/**
 * Phase 3.6.3 — one-off data fixes for AUS 482 Core Skills Stream
 * arising from the data-quality plan. This script is read+write but
 * idempotent: re-running it produces no further changes.
 *
 * Operations (in order):
 *
 *  1. Re-derive D.1.3 for AUS using the corrected
 *     COUNTRY_PR_PRESENCE_POLICY (AUS / CAN / USA had citizenship-residence
 *     proxies for D.1.3; the corrected lookup sets required=false with a
 *     clear note for these three countries). Updates the existing
 *     field_values row in place.
 *
 *  2. Re-publish the four derive-knowledge fields (B.2.4, D.1.3, D.1.4,
 *     D.2.3) so value_normalized is populated by the FIX 5 publish path.
 *     The publish path now JSON-parses valueRaw for boolean_with_annotation
 *     rows and maps "permitted" / "not_permitted" → true / false for D.2.3.
 *
 *  3. Reshape B.2.3 from the LLM compliance failure ("AUD 1,800" plain
 *     string) into the boolean_with_annotation shape:
 *         { hasLevy: true, notes: "Skilling Australians Fund (SAF) levy
 *           AUD 1,800 / year (~USD 1,180) for the 4-year stream." }
 *     value_normalized is populated. Status remains pending_review for
 *     analyst confirmation of the levy amount.
 *
 *  4. Re-validate the five high-confidence-but-pending rows
 *     (C.1.1, C.1.3, C.3.1, D.3.3, E.2.1) against the FIX 1 validator
 *     prompt. The cache key incorporates promptHash, so the prompt change
 *     forces a cache miss. If the new validator returns isValid=true and
 *     extractionConfidence + new validationConfidence both clear the
 *     0.85 auto-approve threshold, the row is promoted to status='approved'
 *     with a synthetic reviewedBy='auto-revalidation-3.6.3' marker.
 *     Otherwise the row stays pending_review (no regression).
 *
 * Usage:
 *   pnpm exec tsx scripts/phase-3-6-3-aus-dq-fixes.ts
 *
 * Re-running is safe; each step checks for idempotence before acting.
 */

import 'dotenv/config';
import { client, db, fieldDefinitions, fieldValues, programs, scrapeCache } from '@gtmi/db';
import {
  COUNTRY_PR_PRESENCE_POLICY,
  PublishStageImpl,
  ValidateStageImpl,
  deriveD13,
} from '@gtmi/extraction';
import type { ExtractionOutput, ProvenanceRecord, ScrapeResult } from '@gtmi/extraction';
import { and, eq } from 'drizzle-orm';

const PROGRAM_ID = 'e1687f65-5959-469a-8615-d99ed20bac1b';
const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_THRESHOLD = 0.85;

async function fixD13ForAus(): Promise<void> {
  console.log('\n[1/4] Re-deriving AUS D.1.3 against corrected lookup...');
  const policy = COUNTRY_PR_PRESENCE_POLICY['AUS'];
  if (!policy) throw new Error('AUS missing from COUNTRY_PR_PRESENCE_POLICY');
  const result = deriveD13({
    programId: PROGRAM_ID,
    countryIso: 'AUS',
    methodologyVersion: METHODOLOGY_VERSION,
    policy,
  });
  if (!result) {
    console.log('  D.1.3 derive returned null — leaving existing row untouched.');
    return;
  }
  const publish = new PublishStageImpl();
  await publish.executeDerived(result.extraction, result.provenance);
  console.log(
    `  D.1.3 republished: required=${policy.d13.required}, daysPerYear=${policy.d13.daysPerYear}`
  );
}

async function reRepublishDerivedKnowledge(): Promise<void> {
  console.log('\n[2/4] Re-publishing derive-knowledge AUS rows so value_normalized populates...');
  const targetKeys = ['B.2.4', 'D.1.3', 'D.1.4', 'D.2.3'];
  const rows = await db
    .select({
      key: fieldDefinitions.key,
      raw: fieldValues.valueRaw,
      norm: fieldValues.valueNormalized,
      prov: fieldValues.provenance,
      status: fieldValues.status,
      fvId: fieldValues.id,
      fdId: fieldValues.fieldDefinitionId,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(eq(fieldValues.programId, PROGRAM_ID));
  for (const r of rows) {
    if (!targetKeys.includes(r.key)) continue;
    const prov = (r.prov ?? {}) as Record<string, unknown>;
    if (
      prov['extractionModel'] !== 'derived-knowledge' &&
      prov['extractionModel'] !== 'derived-computation'
    )
      continue;
    if (r.norm !== null) {
      console.log(`  ${r.key}: value_normalized already populated; skip.`);
      continue;
    }
    if (r.raw === null) {
      console.log(`  ${r.key}: value_raw is null; cannot reshape.`);
      continue;
    }
    const fakeExtraction: ExtractionOutput = {
      programId: PROGRAM_ID,
      fieldDefinitionKey: r.key,
      valueRaw: r.raw,
      sourceSentence: (prov['sourceSentence'] as string) ?? '',
      characterOffsets: { start: 0, end: 0 },
      extractionModel: prov['extractionModel'] as string,
      extractionConfidence: (prov['extractionConfidence'] as number) ?? 0.7,
      extractedAt: new Date(),
    };
    const newProv = {
      ...(prov as unknown as ProvenanceRecord & { derivedInputs?: Record<string, unknown> }),
      scrapeTimestamp: (prov['scrapeTimestamp'] as string) ?? new Date().toISOString(),
    } as ProvenanceRecord & { derivedInputs?: Record<string, unknown> };
    const publish = new PublishStageImpl();
    await publish.executeDerived(fakeExtraction, newProv);
    console.log(`  ${r.key}: republished via FIX 5 normalize path.`);
  }
}

async function fixB23(): Promise<void> {
  console.log('\n[3/4] Reshaping AUS B.2.3 from "AUD 1,800" plain string to JSON shape...');
  const fdRows = await db
    .select({ id: fieldDefinitions.id })
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.key, 'B.2.3'))
    .limit(1);
  if (fdRows.length === 0) throw new Error('B.2.3 field_definition missing');
  const fdId = fdRows[0]!.id;
  const fvRows = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, PROGRAM_ID), eq(fieldValues.fieldDefinitionId, fdId)))
    .limit(1);
  if (fvRows.length === 0) {
    console.log('  No B.2.3 row exists for AUS 482.');
    return;
  }
  const row = fvRows[0]!;
  if (row.valueNormalized !== null) {
    console.log(`  B.2.3 already has value_normalized populated; skip.`);
    return;
  }
  const reshaped = {
    hasLevy: true,
    notes:
      'Skilling Australians Fund (SAF) levy AUD 1,800 / year (~USD 1,180) for the 4-year stream; sponsor-borne.',
  };
  const newRaw = JSON.stringify(reshaped);
  await db
    .update(fieldValues)
    .set({
      valueRaw: newRaw,
      valueNormalized: reshaped,
    })
    .where(eq(fieldValues.id, row.id));
  console.log(`  B.2.3 reshaped → hasLevy=true, value_normalized populated.`);
}

async function reValidateFiveAusRows(): Promise<void> {
  console.log('\n[4/4] Re-validating the five C.1.1/C.1.3/C.3.1/D.3.3/E.2.1 rows...');
  const targets = ['C.1.1', 'C.1.3', 'C.3.1', 'D.3.3', 'E.2.1'];
  const rows = await db
    .select({
      key: fieldDefinitions.key,
      fvId: fieldValues.id,
      raw: fieldValues.valueRaw,
      norm: fieldValues.valueNormalized,
      prov: fieldValues.provenance,
      status: fieldValues.status,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(eq(fieldValues.programId, PROGRAM_ID));
  const validate = new ValidateStageImpl();
  let promoted = 0;
  let kept = 0;
  for (const r of rows) {
    if (!targets.includes(r.key)) continue;
    if (r.status !== 'pending_review') {
      console.log(`  ${r.key}: status=${r.status} (already approved or other); skip.`);
      continue;
    }
    const prov = (r.prov ?? {}) as Record<string, unknown>;
    const sourceUrl = prov['sourceUrl'] as string;
    const sourceSentence = (prov['sourceSentence'] as string) ?? '';
    const extConf = (prov['extractionConfidence'] as number) ?? 0;
    if (extConf < AUTO_APPROVE_THRESHOLD) {
      console.log(
        `  ${r.key}: extractionConfidence ${extConf} < 0.85; would not auto-approve. skip.`
      );
      kept++;
      continue;
    }
    // Pull the scrape from cache.
    const cacheRows = await db
      .select()
      .from(scrapeCache)
      .where(eq(scrapeCache.url, sourceUrl))
      .limit(1);
    if (cacheRows.length === 0) {
      console.log(`  ${r.key}: scrape_cache has no entry for sourceUrl; cannot re-validate. skip.`);
      kept++;
      continue;
    }
    const scrape: ScrapeResult = {
      url: sourceUrl,
      contentMarkdown: cacheRows[0]!.contentMarkdown ?? '',
      httpStatus: 200,
      contentHash: cacheRows[0]!.contentHash ?? '',
      scrapedAt: new Date(),
    };
    const fakeExtraction: ExtractionOutput = {
      programId: PROGRAM_ID,
      fieldDefinitionKey: r.key,
      valueRaw: r.raw ?? '',
      sourceSentence,
      characterOffsets: { start: 0, end: 0 },
      extractionModel: (prov['extractionModel'] as string) ?? 'claude-sonnet-4-6',
      extractionConfidence: extConf,
      extractedAt: new Date(),
    };
    const result = await validate.execute(fakeExtraction, scrape);
    const newApprovable =
      result.isValid &&
      result.validationConfidence >= AUTO_APPROVE_THRESHOLD &&
      extConf >= AUTO_APPROVE_THRESHOLD;
    if (!newApprovable) {
      console.log(
        `  ${r.key}: revalidation isValid=${result.isValid} valConf=${result.validationConfidence} — keep pending_review.`
      );
      kept++;
      continue;
    }
    const newProv: Record<string, unknown> = {
      ...prov,
      validationConfidence: result.validationConfidence,
      reviewedBy: 'auto-revalidation-3.6.3',
      reviewedAt: new Date().toISOString(),
      reviewDecision: 'approve',
    };
    await db
      .update(fieldValues)
      .set({
        status: 'approved',
        provenance: newProv as never,
        reviewedAt: new Date(),
      })
      .where(eq(fieldValues.id, r.fvId));
    console.log(
      `  ${r.key}: PROMOTED → approved (valConf=${result.validationConfidence.toFixed(2)}).`
    );
    promoted++;
  }
  console.log(`  Re-validation summary: promoted=${promoted}, kept_pending=${kept}`);
}

async function main(): Promise<void> {
  const programRows = await db.select().from(programs).where(eq(programs.id, PROGRAM_ID));
  if (programRows.length === 0) throw new Error(`No program ${PROGRAM_ID}`);

  await fixD13ForAus();
  await reRepublishDerivedKnowledge();
  await fixB23();
  await reValidateFiveAusRows();

  console.log('\nPhase 3.6.3 AUS data fixes — done.');
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
