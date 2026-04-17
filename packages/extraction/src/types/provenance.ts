export type CrossCheckOutcome = 'agree' | 'disagree' | 'not_checked';

export interface ProvenanceRecord {
  sourceUrl: string;
  scrapeTimestamp: Date;
  contentHash: string;
  sourceSentence: string;
  characterOffsets: { start: number; end: number };
  extractionModel: string;
  extractionConfidence: number;
  validationModel: string;
  validationConfidence: number;
  crossCheckResult: CrossCheckOutcome;
  crossCheckUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  methodologyVersion: string;
}
