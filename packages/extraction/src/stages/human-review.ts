import { db, fieldDefinitions, fieldValues, reviewQueue } from '@gtmi/db';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  CrossCheckResult,
  ExtractionOutput,
  ReviewDecision,
  ValidationResult,
} from '../types/extraction';
import type { HumanReviewStage } from '../types/pipeline';

interface HumanReviewOptions {
  confidenceThreshold?: number;
  paqDeltaThreshold?: number;
  getCurrentPaqScore?: (programId: string) => number | null;
  getPreviousPaqScore?: (programId: string) => number | null;
}

export class HumanReviewStageImpl implements HumanReviewStage {
  private readonly confidenceThreshold: number;
  private readonly paqDeltaThreshold: number;
  private readonly getCurrentPaqScore: (programId: string) => number | null;
  private readonly getPreviousPaqScore: (programId: string) => number | null;

  constructor(options: HumanReviewOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.85;
    this.paqDeltaThreshold = options.paqDeltaThreshold ?? 5;
    this.getCurrentPaqScore = options.getCurrentPaqScore ?? (() => null);
    this.getPreviousPaqScore = options.getPreviousPaqScore ?? (() => null);
  }

  private reviewReasons(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    crossCheck: CrossCheckResult
  ): string[] {
    const reasons: string[] = [];

    if (extraction.extractionConfidence < this.confidenceThreshold) {
      reasons.push(
        `Extraction confidence ${extraction.extractionConfidence} < ${this.confidenceThreshold}`
      );
    }

    if (validation.validationConfidence < this.confidenceThreshold) {
      reasons.push(
        `Validation confidence ${validation.validationConfidence} < ${this.confidenceThreshold}`
      );
    }

    if (!crossCheck.agrees) {
      reasons.push(`Cross-check disagreement: ${crossCheck.notes}`);
    }

    const current = this.getCurrentPaqScore(extraction.programId);
    const previous = this.getPreviousPaqScore(extraction.programId);
    if (current !== null && previous !== null) {
      const delta = Math.abs(current - previous);
      if (delta > this.paqDeltaThreshold) {
        reasons.push(`PAQ delta ${delta.toFixed(1)} > ${this.paqDeltaThreshold} points`);
      }
    }

    return reasons;
  }

  needsReview(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    crossCheck: CrossCheckResult
  ): boolean {
    return this.reviewReasons(extraction, validation, crossCheck).length > 0;
  }

  async enqueue(
    extraction: ExtractionOutput,
    validation: ValidationResult,
    crossCheck: CrossCheckResult
  ): Promise<string> {
    const reasons = this.reviewReasons(extraction, validation, crossCheck);

    // Resolve field definition id from key.
    const fieldDefRows = await db
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.key, extraction.fieldDefinitionKey))
      .limit(1);
    if (fieldDefRows.length === 0) {
      throw new Error(
        `HumanReview.enqueue: no field_definition found with key "${extraction.fieldDefinitionKey}"`
      );
    }
    const fieldDefinitionId = fieldDefRows[0]!.id;

    // Upsert field_values with status=pending_review. If an approved row already
    // exists for this (program, field) pair, leave it untouched and link the
    // review_queue entry to the existing row so the reviewer sees both values.
    const existingRows = await db
      .select({ id: fieldValues.id, status: fieldValues.status })
      .from(fieldValues)
      .where(
        and(
          eq(fieldValues.programId, extraction.programId),
          eq(fieldValues.fieldDefinitionId, fieldDefinitionId)
        )
      )
      .limit(1);

    let fieldValueId: string;

    if (existingRows.length > 0 && existingRows[0]!.status === 'approved') {
      // Don't overwrite approved data — reviewer will compare new extraction against it.
      fieldValueId = existingRows[0]!.id;
    } else {
      // Insert or update pending_review row.
      const upserted = await db
        .insert(fieldValues)
        .values({
          id: randomUUID(),
          programId: extraction.programId,
          fieldDefinitionId,
          valueRaw: extraction.valueRaw,
          status: 'pending_review',
          extractedAt: extraction.extractedAt,
          provenance: {
            sourceSentence: extraction.sourceSentence,
            characterOffsets: extraction.characterOffsets,
            extractionModel: extraction.extractionModel,
            extractionConfidence: extraction.extractionConfidence,
            validationModel: validation.validationModel,
            validationConfidence: validation.validationConfidence,
            validationNotes: validation.notes,
          },
        })
        .onConflictDoUpdate({
          target: [fieldValues.programId, fieldValues.fieldDefinitionId],
          set: {
            valueRaw: extraction.valueRaw,
            status: 'pending_review',
            extractedAt: extraction.extractedAt,
            provenance: {
              sourceSentence: extraction.sourceSentence,
              characterOffsets: extraction.characterOffsets,
              extractionModel: extraction.extractionModel,
              extractionConfidence: extraction.extractionConfidence,
              validationModel: validation.validationModel,
              validationConfidence: validation.validationConfidence,
              validationNotes: validation.notes,
            },
          },
        })
        .returning({ id: fieldValues.id });

      fieldValueId = upserted[0]!.id;
    }

    // Priority: inverse of minimum confidence (lower confidence → higher urgency).
    const minConf = Math.min(extraction.extractionConfidence, validation.validationConfidence);
    const priority = minConf < 0.5 ? 1 : minConf < 0.6 ? 2 : minConf < 0.7 ? 3 : 4;

    const queueId = randomUUID();
    await db.insert(reviewQueue).values({
      id: queueId,
      fieldValueId,
      flaggedReason: reasons.length > 0 ? reasons.join('; ') : 'normalization_failed',
      priority,
      status: 'pending',
      extractionSnapshot: extraction as unknown as Record<string, unknown>,
      validationSnapshot: validation as unknown as Record<string, unknown>,
    });

    console.log(
      `Review queued [${queueId}] — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}, reasons: ${reasons.join('; ')}`
    );
    return queueId;
  }

  async awaitDecision(queueItemId: string): Promise<ReviewDecision> {
    throw new Error(
      `awaitDecision is not yet implemented: human review dashboard is Phase 4 scope (queueItemId: ${queueItemId})`
    );
  }
}
