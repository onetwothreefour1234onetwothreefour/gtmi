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

interface QueueEntry {
  extraction: ExtractionOutput;
  validation: ValidationResult;
  crossCheck: CrossCheckResult;
  reasons: string[];
  enqueuedAt: Date;
}

export class HumanReviewStageImpl implements HumanReviewStage {
  private readonly confidenceThreshold: number;
  private readonly paqDeltaThreshold: number;
  private readonly getCurrentPaqScore: (programId: string) => number | null;
  private readonly getPreviousPaqScore: (programId: string) => number | null;
  private readonly queue = new Map<string, QueueEntry>();

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
    const id = randomUUID();
    const reasons = this.reviewReasons(extraction, validation, crossCheck);
    this.queue.set(id, { extraction, validation, crossCheck, reasons, enqueuedAt: new Date() });
    console.log(
      `Review queued [${id}] — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}, reasons: ${reasons.join('; ')}`
    );
    return id;
  }

  async awaitDecision(queueItemId: string): Promise<ReviewDecision> {
    throw new Error(
      `awaitDecision is not yet implemented: human review dashboard is Phase 4 scope (queueItemId: ${queueItemId})`
    );
  }
}
