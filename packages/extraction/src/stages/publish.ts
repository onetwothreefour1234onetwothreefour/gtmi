import { db, fieldDefinitions, fieldValues, methodologyVersions } from '@gtmi/db';
import { normalizeRawValue, ScoringError } from '@gtmi/scoring';
import { eq } from 'drizzle-orm';
import type { ExtractionOutput, ValidationResult } from '../types/extraction';
import type { ProvenanceRecord } from '../types/provenance';
import type { PublishStage } from '../types/pipeline';

// Ordered most-specific first so "A$" matches before bare "$".
const CURRENCY_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'AUD', re: /^(?:AUD|A\$)\s*/i },
  { code: 'SGD', re: /^(?:SGD|S\$)\s*/i },
  { code: 'HKD', re: /^(?:HKD|HK\$)\s*/i },
  { code: 'NZD', re: /^(?:NZD|NZ\$)\s*/i },
  { code: 'CAD', re: /^(?:CAD|C\$)\s*/i },
  { code: 'USD', re: /^(?:USD|US\$)\s*/i },
  { code: 'EUR', re: /^(?:EUR|€)\s*/i },
  { code: 'GBP', re: /^(?:GBP|£)\s*/i },
  { code: 'JPY', re: /^(?:JPY|¥)\s*/i },
  { code: 'INR', re: /^(?:INR|₹)\s*/i },
  { code: 'AED', re: /^AED\s*/i },
  { code: 'SAR', re: /^SAR\s*/i },
  { code: 'QAR', re: /^QAR\s*/i },
  { code: 'MYR', re: /^(?:MYR|RM)\s*/i },
  { code: 'THB', re: /^(?:THB|฿)\s*/i },
  { code: 'CHF', re: /^CHF\s*/i },
  { code: 'SEK', re: /^SEK\s*/i },
  { code: 'DKK', re: /^DKK\s*/i },
  { code: 'NOK', re: /^NOK\s*/i },
];

function detectCurrency(valueRaw: string): { code: string; stripped: string } | null {
  for (const { code, re } of CURRENCY_PATTERNS) {
    if (re.test(valueRaw)) {
      return { code, stripped: valueRaw.replace(re, '') };
    }
  }
  return null;
}

export class PublishStageImpl implements PublishStage {
  async execute(
    extraction: ExtractionOutput,
    _validation: ValidationResult,
    provenance: ProvenanceRecord
  ): Promise<void> {
    if (provenance.reviewDecision === 'reject') {
      throw new Error(
        `Publish rejected: value for field ${extraction.fieldDefinitionKey} / program ${extraction.programId} was rejected by reviewer.`
      );
    }
    if (provenance.reviewDecision === 'request_reextraction') {
      throw new Error(
        `Publish blocked: re-extraction was requested for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}.`
      );
    }

    const missing: string[] = [];
    if (!provenance.sourceUrl) missing.push('sourceUrl');
    if (!provenance.contentHash) missing.push('contentHash');
    if (!provenance.extractionModel) missing.push('extractionModel');
    if (!provenance.validationModel) missing.push('validationModel');
    if (!provenance.methodologyVersion) missing.push('methodologyVersion');
    if (typeof provenance.scrapeTimestamp !== 'string') missing.push('scrapeTimestamp');
    if (missing.length > 0) {
      throw new Error(
        `Publish failed: missing required provenance fields [${missing.join(', ')}] for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}`
      );
    }

    const fieldDefRows = await db
      .select({
        id: fieldDefinitions.id,
        normalizationFn: fieldDefinitions.normalizationFn,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.key, extraction.fieldDefinitionKey))
      .limit(1);

    if (fieldDefRows.length === 0) {
      throw new Error(
        `Publish failed: no field_definition found with key "${extraction.fieldDefinitionKey}"`
      );
    }
    const fieldDef = fieldDefRows[0]!;
    const fieldDefinitionId = fieldDef.id;

    const rawAsString =
      typeof extraction.valueRaw === 'string' ? extraction.valueRaw : String(extraction.valueRaw);

    // For numeric fields, detect and preserve currency code before normalization strips it.
    let rawForNormalization = rawAsString;
    let valueCurrency: string | undefined;
    if (fieldDef.normalizationFn === 'min_max' || fieldDef.normalizationFn === 'z_score') {
      const detected = detectCurrency(rawAsString);
      if (detected) {
        valueCurrency = detected.code;
        rawForNormalization = detected.stripped;
        console.log(
          `  [${extraction.fieldDefinitionKey}] Currency detected: ${valueCurrency} (stripped from "${rawAsString}")`
        );
      }
    }

    let valueNormalized: number | string | boolean;
    try {
      valueNormalized = normalizeRawValue(rawForNormalization, fieldDef);
    } catch (error) {
      const msg = error instanceof ScoringError ? error.message : String(error);
      throw new Error(
        `Normalization failed for field "${extraction.fieldDefinitionKey}" / program "${extraction.programId}": ${msg}`
      );
    }

    const methodologyRows = await db
      .select({ id: methodologyVersions.id })
      .from(methodologyVersions)
      .where(eq(methodologyVersions.versionTag, provenance.methodologyVersion))
      .limit(1);

    if (methodologyRows.length === 0) {
      throw new Error(
        `Publish failed: no methodology_version found with version_tag "${provenance.methodologyVersion}"`
      );
    }
    const methodologyVersionId = methodologyRows[0]!.id;

    // Merge detected currency into provenance JSONB — no schema change needed.
    const provenanceToStore = valueCurrency ? { ...provenance, valueCurrency } : provenance;

    // source_id is intentionally left null: the sources table holds pre-seeded
    // static program-level URLs, while Stage 0 discovers URLs dynamically. Most
    // discovered URLs will not match a sources row. The full source URL, tier,
    // and geographic level are preserved in the JSONB provenance record.
    const inserted = await db
      .insert(fieldValues)
      .values({
        programId: extraction.programId,
        fieldDefinitionId,
        valueRaw: extraction.valueRaw,
        valueNormalized,
        provenance: provenanceToStore,
        status: 'approved',
        extractedAt: extraction.extractedAt,
        reviewedAt: provenance.reviewedAt,
        methodologyVersionId,
      })
      .onConflictDoUpdate({
        target: [fieldValues.programId, fieldValues.fieldDefinitionId],
        set: {
          valueRaw: extraction.valueRaw,
          valueNormalized,
          provenance: provenanceToStore,
          status: 'approved',
          extractedAt: extraction.extractedAt,
          reviewedAt: provenance.reviewedAt,
          methodologyVersionId,
        },
      })
      .returning({ id: fieldValues.id });

    const insertedId = inserted[0]?.id;
    if (!insertedId) {
      throw new Error(
        `Publish failed: insert into field_values returned no ID for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}`
      );
    }

    console.log(
      `Published [${insertedId}] — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}, methodology: ${provenance.methodologyVersion}`
    );
  }
}
