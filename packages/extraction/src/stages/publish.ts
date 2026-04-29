import { db, fieldDefinitions, fieldValues, methodologyVersions, programs } from '@gtmi/db';
import {
  BOOLEAN_WITH_ANNOTATION_KEYS,
  getRegionalSubstitute,
  normalizeRawValue,
  PHASE2_PLACEHOLDER_PARAMS,
  ScoringError,
  scoreSingleIndicator,
} from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import type { ExtractionOutput, ValidationResult } from '../types/extraction';
import type { ProvenanceRecord } from '../types/provenance';
import type { PublishStage } from '../types/pipeline';
import { detectCurrency } from '../utils/currency';

const COUNTRY_SUBSTITUTE_MODEL = 'country-substitute-regional';

/**
 * Phase 3.7 / ADR-019 — rubric helpers used by the categorical
 * pre-flight gate. The on-disk shape is
 * `{ categories: [{ value: string, score: number, description: string }, ...] }`.
 *
 * Exported for unit testing.
 */
export function isCategoricalRubric(
  rubric: unknown
): rubric is { categories: Array<{ value: string }> } {
  return (
    typeof rubric === 'object' &&
    rubric !== null &&
    !Array.isArray(rubric) &&
    Array.isArray((rubric as { categories?: unknown }).categories)
  );
}

export function rubricValues(rubric: { categories: Array<{ value: string }> }): string[] {
  return rubric.categories
    .map((c) => (typeof c.value === 'string' ? c.value : null))
    .filter((v): v is string => v !== null);
}

export function rubricIncludesValue(
  rubric: { categories: Array<{ value: string }> },
  rawValue: string
): boolean {
  return rubricValues(rubric).includes(rawValue);
}

/**
 * Phase 3.5 / ADR-014 — synthetic provenance sentinels for country-substitute rows.
 * Every key required by `verify-provenance.ts` is populated; `sourceTier` is
 * the only nullable required key (null means "no real source").
 *
 * Exported for testing.
 */
export function buildCountrySubstituteProvenance(args: {
  fieldKey: string;
  countryIso: string;
  region: string;
  substitutedValue: string;
  methodologyVersion: string;
}): ProvenanceRecord {
  const sentinel = `country-substitute-regional:${args.fieldKey}:${args.countryIso}:${args.region}:${args.substitutedValue}`;
  return {
    sourceUrl: `internal:country-substitute-regional/${args.fieldKey}/${args.countryIso}`,
    geographicLevel: 'regional',
    sourceTier: null,
    scrapeTimestamp: new Date().toISOString(),
    contentHash: createHash('sha256').update(sentinel, 'utf8').digest('hex'),
    sourceSentence: `Regional default applied for ${args.fieldKey} in ${args.countryIso} (region: ${args.region}); no government source extracted.`,
    characterOffsets: { start: 0, end: 0 },
    extractionModel: COUNTRY_SUBSTITUTE_MODEL,
    extractionConfidence: 1.0,
    validationModel: COUNTRY_SUBSTITUTE_MODEL,
    validationConfidence: 1.0,
    crossCheckResult: 'not_checked',
    crossCheckUrl: null,
    reviewedBy: 'auto',
    reviewedAt: new Date(),
    methodologyVersion: args.methodologyVersion,
    reviewDecision: 'approve',
  };
}

const ALLOWED_BOOLEAN_ANNOTATION_KEYS = new Set([
  'hasLevy',
  'hasMandatoryNonGovCosts',
  'required',
  'daysPerYear',
  'notes',
]);

/**
 * Phase 3.5: shape-validate the structured object for boolean_with_annotation
 * fields BEFORE writing to field_values. The scoring engine will throw if the
 * primary boolean key is missing — surface that here so the publish error is
 * specific instead of "Normalization failed".
 *
 * Exported for testing.
 */
export function validateBooleanWithAnnotationShape(
  fieldKey: string,
  parsed: Record<string, unknown>
): void {
  const requiredBoolKey = BOOLEAN_WITH_ANNOTATION_KEYS[fieldKey];
  if (!requiredBoolKey) {
    throw new Error(
      `boolean_with_annotation: no boolean key registered for field "${fieldKey}" — methodology-v2 misconfigured`
    );
  }
  if (typeof parsed[requiredBoolKey] !== 'boolean') {
    throw new Error(
      `boolean_with_annotation: field "${fieldKey}" expects "${requiredBoolKey}: boolean" — got ${JSON.stringify(parsed[requiredBoolKey])}`
    );
  }
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_BOOLEAN_ANNOTATION_KEYS.has(key)) {
      throw new Error(
        `boolean_with_annotation: field "${fieldKey}" has unexpected property "${key}" (allowed: ${[...ALLOWED_BOOLEAN_ANNOTATION_KEYS].join(', ')})`
      );
    }
  }
}

// Phase 3.6 / Fix D / ADR-016 — value-normalization helper for derived rows.
// Derived A.1.2 / D.2.2 outputs are pre-computed numbers; persist as JSON
// numbers so scoring reads them via the standard min_max numeric path.
//
// Phase 3.6.3 / FIX 5 — derived-knowledge fields (B.2.4, D.1.3, D.1.4,
// D.2.3) carry structured / categorical data in valueRaw rather than a
// raw number. The previous helper returned null for these, leaving
// valueNormalized=null and breaking the scoring path. The helper is now
// normalisationFn-aware: boolean_with_annotation rows JSON-parse valueRaw
// into the structured object; boolean rows map the "permitted" /
// "not_permitted" rubric strings to true / false. min_max / z_score
// fields keep the numeric path (used by deriveA12 / deriveD22).
function normalizeDerivedValueRaw(
  valueRaw: string,
  normalizationFn: string
): number | string | boolean | Record<string, unknown> | null {
  // Phase 3.6.6 / FIX 1 — derived `not_applicable` row (A.1.2 on
  // points-based programmes). Returns the structured marker regardless
  // of the field's normalisation fn so the engine can short-circuit
  // scoring (engine.ts skips rows with notApplicable=true).
  if (valueRaw === 'not_applicable') {
    return {
      notApplicable: true,
      reason: 'Points-based programme — no minimum salary requirement',
    };
  }
  if (normalizationFn === 'min_max' || normalizationFn === 'z_score') {
    const n = Number.parseFloat(valueRaw);
    return Number.isFinite(n) ? n : null;
  }
  if (normalizationFn === 'boolean_with_annotation') {
    try {
      const parsed = JSON.parse(valueRaw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (normalizationFn === 'boolean') {
    const trimmed = valueRaw.trim().toLowerCase();
    if (trimmed === 'permitted' || trimmed === 'true' || trimmed === 'yes') return true;
    if (trimmed === 'not_permitted' || trimmed === 'false' || trimmed === 'no') return false;
    return null;
  }
  if (normalizationFn === 'categorical' || normalizationFn === 'country_substitute_regional') {
    return valueRaw.trim();
  }
  return null;
}

export class PublishStageImpl implements PublishStage {
  /**
   * Phase 3.5 / ADR-014 — write a synthetic country-substitute row when the
   * LLM extraction returned empty for a `country_substitute_regional` field.
   * No provenance argument: this method builds its own sentinel provenance
   * and resolves the country from the program record. Auto-approves.
   *
   * Returns true if a row was written, false if no regional default exists
   * for the country (caller should let the missing-data penalty apply).
   */
  async executeCountrySubstitute(
    programId: string,
    fieldDefinitionKey: string,
    methodologyVersion: string
  ): Promise<boolean> {
    const fieldDefRows = await db
      .select({
        id: fieldDefinitions.id,
        normalizationFn: fieldDefinitions.normalizationFn,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.key, fieldDefinitionKey))
      .limit(1);

    if (fieldDefRows.length === 0) {
      throw new Error(
        `Country-substitute publish failed: no field_definition found with key "${fieldDefinitionKey}"`
      );
    }
    const fieldDef = fieldDefRows[0]!;
    if (fieldDef.normalizationFn !== 'country_substitute_regional') {
      throw new Error(
        `Country-substitute publish refused: field "${fieldDefinitionKey}" has normalizationFn "${fieldDef.normalizationFn}", not "country_substitute_regional"`
      );
    }

    const programRows = await db
      .select({ countryIso: programs.countryIso })
      .from(programs)
      .where(eq(programs.id, programId))
      .limit(1);

    if (programRows.length === 0) {
      throw new Error(`Country-substitute publish failed: no program found with id "${programId}"`);
    }
    const countryIso = programRows[0]!.countryIso;

    const sub = getRegionalSubstitute(countryIso, fieldDefinitionKey);
    if (sub.score === null || sub.value === null) {
      console.log(
        `  [${fieldDefinitionKey}] country_substitute_regional: no regional default for ${countryIso} (region=${sub.region}) — leaving empty so missing-data penalty applies`
      );
      return false;
    }

    const methodologyRows = await db
      .select({ id: methodologyVersions.id })
      .from(methodologyVersions)
      .where(eq(methodologyVersions.versionTag, methodologyVersion))
      .limit(1);
    if (methodologyRows.length === 0) {
      throw new Error(
        `Country-substitute publish failed: no methodology_version found with version_tag "${methodologyVersion}"`
      );
    }
    const methodologyVersionId = methodologyRows[0]!.id;

    const provenance = buildCountrySubstituteProvenance({
      fieldKey: fieldDefinitionKey,
      countryIso,
      region: sub.region,
      substitutedValue: sub.value,
      methodologyVersion,
    });

    const valueNormalized = {
      substituted: true,
      value: sub.value,
      region: sub.region,
    };

    const inserted = await db
      .insert(fieldValues)
      .values({
        programId,
        fieldDefinitionId: fieldDef.id,
        valueRaw: null,
        valueNormalized,
        valueIndicatorScore: String(sub.score),
        provenance,
        status: 'approved',
        extractedAt: new Date(),
        reviewedAt: provenance.reviewedAt,
        methodologyVersionId,
      })
      .onConflictDoUpdate({
        target: [fieldValues.programId, fieldValues.fieldDefinitionId],
        set: {
          valueRaw: null,
          valueNormalized,
          valueIndicatorScore: String(sub.score),
          provenance,
          status: 'approved',
          extractedAt: new Date(),
          reviewedAt: provenance.reviewedAt,
          methodologyVersionId,
        },
      })
      .returning({ id: fieldValues.id });

    const insertedId = inserted[0]?.id;
    if (!insertedId) {
      throw new Error(
        `Country-substitute publish failed: insert returned no id for ${fieldDefinitionKey} / ${programId}`
      );
    }

    console.log(
      `Published [${insertedId}] (country-substitute) — program: ${programId}, field: ${fieldDefinitionKey}, region: ${sub.region}, value: ${sub.value}, score: ${sub.score}`
    );
    return true;
  }

  /**
   * Phase 3.6 / Fix D / ADR-016 — write a derived row (A.1.2 / D.2.2)
   * to field_values with status='pending_review'. The pre-built
   * ProvenanceRecord from derive.ts (including the `derivedInputs`
   * extension) is persisted verbatim — humanReview.enqueue's standard
   * provenance shape is BYPASSED so the derive-specific keys
   * (extractionModel='derived-computation', sourceTier=null,
   * derivedInputs) survive end-to-end into the /review UI.
   *
   * Preconditions enforced:
   * - provenance.extractionModel === 'derived-computation'
   * - provenance.extractionConfidence === 0.6
   * No auto-approve path; status is always 'pending_review'.
   */
  async executeDerived(
    extraction: ExtractionOutput,
    provenance: ProvenanceRecord & { derivedInputs?: Record<string, unknown> }
  ): Promise<string> {
    // Phase 3.6.1 / FIX 6 — accept both 'derived-computation' (A.1.2,
    // D.2.2 — confidence 0.6) AND 'derived-knowledge' (D.2.3 — confidence
    // 0.7). Both must be below the 0.85 auto-approve threshold.
    const ALLOWED_DERIVE_MODELS = new Set(['derived-computation', 'derived-knowledge']);
    if (!ALLOWED_DERIVE_MODELS.has(provenance.extractionModel)) {
      throw new Error(
        `executeDerived refused: extractionModel must be 'derived-computation' or 'derived-knowledge', got '${provenance.extractionModel}'`
      );
    }
    // Phase 3.6.6 / FIX 1 — `not_applicable` rows (e.g. A.1.2 on
    // points-based programmes) carry deliberately high confidence
    // (rule-based, not LLM-extracted) but are still forced into
    // pending_review by the unconditional status='pending_review' write
    // below. Skip the cap for this exact valueRaw.
    if (extraction.valueRaw !== 'not_applicable' && provenance.extractionConfidence >= 0.85) {
      throw new Error(
        `executeDerived refused: extractionConfidence must be below 0.85 (forces /review), got ${provenance.extractionConfidence}`
      );
    }

    const fieldDefRows = await db
      .select({
        id: fieldDefinitions.id,
        normalizationFn: fieldDefinitions.normalizationFn,
      })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.key, extraction.fieldDefinitionKey))
      .limit(1);
    if (fieldDefRows.length === 0) {
      throw new Error(
        `executeDerived failed: no field_definition found with key "${extraction.fieldDefinitionKey}"`
      );
    }
    const fieldDefinitionId = fieldDefRows[0]!.id;
    const normalizationFn = fieldDefRows[0]!.normalizationFn;

    const methodologyRows = await db
      .select({ id: methodologyVersions.id })
      .from(methodologyVersions)
      .where(eq(methodologyVersions.versionTag, provenance.methodologyVersion))
      .limit(1);
    if (methodologyRows.length === 0) {
      throw new Error(
        `executeDerived failed: no methodology_version found with version_tag "${provenance.methodologyVersion}"`
      );
    }
    const methodologyVersionId = methodologyRows[0]!.id;

    const valueNormalized = normalizeDerivedValueRaw(extraction.valueRaw, normalizationFn);

    // If an approved row already exists, do not overwrite. Mirrors humanReview.enqueue.
    const existingRows = await db
      .select({ id: fieldValues.id, status: fieldValues.status })
      .from(fieldValues)
      .where(eq(fieldValues.programId, extraction.programId))
      .limit(50);
    const existingForField = existingRows.find((r) => r.id && r.status === 'approved');
    if (existingForField) {
      // Defensive: if an approved derived row somehow already exists, skip.
      // (Approved derived rows are written by /review, not here.)
    }

    const inserted = await db
      .insert(fieldValues)
      .values({
        programId: extraction.programId,
        fieldDefinitionId,
        valueRaw: extraction.valueRaw,
        valueNormalized,
        provenance,
        status: 'pending_review',
        extractedAt: extraction.extractedAt,
        methodologyVersionId,
      })
      .onConflictDoUpdate({
        target: [fieldValues.programId, fieldValues.fieldDefinitionId],
        set: {
          valueRaw: extraction.valueRaw,
          valueNormalized,
          provenance,
          status: 'pending_review',
          extractedAt: extraction.extractedAt,
          methodologyVersionId,
        },
      })
      .returning({ id: fieldValues.id });

    const insertedId = inserted[0]?.id;
    if (!insertedId) {
      throw new Error(
        `executeDerived failed: insert returned no id for ${extraction.fieldDefinitionKey} / ${extraction.programId}`
      );
    }
    console.log(
      `Published-derived [${insertedId}] (pending_review) — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}`
    );
    return insertedId;
  }

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
        key: fieldDefinitions.key,
        pillar: fieldDefinitions.pillar,
        subFactor: fieldDefinitions.subFactor,
        weightWithinSubFactor: fieldDefinitions.weightWithinSubFactor,
        normalizationFn: fieldDefinitions.normalizationFn,
        direction: fieldDefinitions.direction,
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

    // Coverage-gap sentinels — LLM returned a "not found" marker instead of real data.
    // Skip persistence entirely: treat the field as ABSENT so scoring coverage math
    // is honest (absence of evidence must not be scored as evidence).
    if (
      fieldDef.normalizationFn === 'categorical' &&
      (rawAsString === 'not_addressed' || rawAsString === 'not_found')
    ) {
      console.log(
        `  [${extraction.fieldDefinitionKey}] Skipped publish — value "${rawAsString}" is a coverage-gap sentinel, not data.`
      );
      return;
    }

    // Phase 3.7 / ADR-019 — categorical rubric gate. If the LLM-extracted
    // raw value is NOT in scoringRubricJsonb.categories[].value, persist
    // the row with status='pending_review' + valueNormalized=null +
    // valueIndicatorScore=null so the analyst can map it to a real
    // rubric value (or reject) at /review. Without this gate, the
    // existing normalizeRawValue throws and the canary's catch path
    // also routes to /review — but the row never gets persisted with
    // its bad raw, so the analyst doesn't see the failure context.
    // Country-agnostic. Skipped for the `not_stated` and
    // `not_addressed` / `not_found` sentinels, which already have
    // dedicated branches above.
    if (
      fieldDef.normalizationFn === 'categorical' &&
      isCategoricalRubric(fieldDef.scoringRubricJsonb) &&
      !rubricIncludesValue(fieldDef.scoringRubricJsonb, rawAsString)
    ) {
      const allowed = rubricValues(fieldDef.scoringRubricJsonb).join(', ');
      console.log(
        `  [${extraction.fieldDefinitionKey}] valueRaw="${rawAsString}" not in rubric [${allowed}] — forcing pending_review`
      );
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
      const insertedRubric = await db
        .insert(fieldValues)
        .values({
          programId: extraction.programId,
          fieldDefinitionId,
          valueRaw: extraction.valueRaw,
          valueNormalized: null,
          valueIndicatorScore: null,
          provenance,
          status: 'pending_review',
          extractedAt: extraction.extractedAt,
          reviewedAt: null,
          methodologyVersionId,
        })
        .onConflictDoUpdate({
          target: [fieldValues.programId, fieldValues.fieldDefinitionId],
          set: {
            valueRaw: extraction.valueRaw,
            valueNormalized: null,
            valueIndicatorScore: null,
            provenance,
            status: 'pending_review',
            extractedAt: extraction.extractedAt,
            reviewedAt: null,
            methodologyVersionId,
          },
        })
        .returning({ id: fieldValues.id });
      console.log(
        `Published [${insertedRubric[0]?.id}] (rubric-mismatch, score=null) — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}`
      );
      return;
    }

    // Phase 3.6.1 / Fix 2 — `not_stated` is a different kind of sentinel:
    // the document mentions the program but is silent on this indicator.
    // Distinct from `not_addressed` / `not_found` (which mean the LLM
    // failed to find anything at all). Per Q5, `not_stated` rows are
    // PUBLISHED with a non-null value_raw (counts as POPULATED in the
    // rollup) but with `value_indicator_score = null` so the scoring
    // engine applies the missing-data penalty. The reviewer can replace
    // it with a real categorical value at /review time.
    if (fieldDef.normalizationFn === 'categorical' && rawAsString === 'not_stated') {
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
      const inserted = await db
        .insert(fieldValues)
        .values({
          programId: extraction.programId,
          fieldDefinitionId,
          valueRaw: 'not_stated',
          valueNormalized: null,
          valueIndicatorScore: null,
          provenance,
          status: 'pending_review',
          extractedAt: extraction.extractedAt,
          reviewedAt: provenance.reviewedAt,
          methodologyVersionId,
        })
        .onConflictDoUpdate({
          target: [fieldValues.programId, fieldValues.fieldDefinitionId],
          set: {
            valueRaw: 'not_stated',
            valueNormalized: null,
            valueIndicatorScore: null,
            provenance,
            status: 'pending_review',
            extractedAt: extraction.extractedAt,
            reviewedAt: provenance.reviewedAt,
            methodologyVersionId,
          },
        })
        .returning({ id: fieldValues.id });
      const insertedId = inserted[0]?.id;
      console.log(
        `Published [${insertedId}] (not_stated, score=null) — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}`
      );
      return;
    }

    // For numeric fields, detect and preserve currency code before normalization strips it.
    // Phase 3.6.4 / FIX 1 — pass program country_iso so bare-`$` extractions
    // resolve to the program's national currency (AUS→AUD, SGP→SGD, …).
    let rawForNormalization = rawAsString;
    let valueCurrency: string | undefined;
    if (fieldDef.normalizationFn === 'min_max' || fieldDef.normalizationFn === 'z_score') {
      const programCountryRows = await db
        .select({ countryIso: programs.countryIso })
        .from(programs)
        .where(eq(programs.id, extraction.programId))
        .limit(1);
      const detectedCountryIso = programCountryRows[0]?.countryIso;
      const detected = detectCurrency(rawAsString, detectedCountryIso);
      if (detected) {
        valueCurrency = detected.code;
        rawForNormalization = detected.stripped;
        console.log(
          `  [${extraction.fieldDefinitionKey}] Currency detected: ${valueCurrency} (stripped from "${rawAsString}")`
        );
      }
    }

    // Phase 3.5: NormalizedValue is now a wider type (number | string |
    // boolean | Record<string, unknown>) to support boolean_with_annotation.
    let valueNormalized: number | string | boolean | Record<string, unknown>;
    try {
      valueNormalized = normalizeRawValue(rawForNormalization, fieldDef);
    } catch (error) {
      const msg = error instanceof ScoringError ? error.message : String(error);
      throw new Error(
        `Normalization failed for field "${extraction.fieldDefinitionKey}" / program "${extraction.programId}": ${msg}`
      );
    }

    // Phase 3.5 / ADR-014: validate the structured shape for
    // boolean_with_annotation BEFORE writing. The scoring engine performs
    // its own check at score time, but failing here gives a specific
    // publish-time error (and prevents persisting a malformed object).
    if (fieldDef.normalizationFn === 'boolean_with_annotation') {
      validateBooleanWithAnnotationShape(
        extraction.fieldDefinitionKey,
        valueNormalized as Record<string, unknown>
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

    // Phase 3.7 / ADR-019 — compute and persist value_indicator_score
    // alongside the auto-approve write. Failures are non-fatal — log and
    // store NULL so the row still publishes; the backfill script can
    // recover later.
    let valueIndicatorScore: string | null = null;
    try {
      const score = scoreSingleIndicator({
        fieldDefinition: fieldDef as unknown as FieldDefinitionRecord,
        valueNormalized,
        normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
      });
      if (score !== null) valueIndicatorScore = String(score);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [${extraction.fieldDefinitionKey}] scoreSingleIndicator failed: ${msg} — persisting with NULL score`
      );
    }

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
        valueIndicatorScore,
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
          valueIndicatorScore,
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
