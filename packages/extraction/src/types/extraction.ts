export type SourceTier = 1 | 2 | 3;

export type ReviewDecision = 'approve' | 'reject' | 'request_reextraction';

export interface ScrapeResult {
  url: string;
  contentMarkdown: string;
  contentHash: string;
  scrapedAt: Date;
  httpStatus: number;
}

export interface ExtractionInput {
  programId: string;
  fieldDefinitionKey: string;
  sourceUrl: string;
  sourceTier: SourceTier;
}

export interface ExtractionOutput {
  programId: string;
  fieldDefinitionKey: string;
  valueRaw: string;
  sourceSentence: string;
  characterOffsets: { start: number; end: number };
  extractionConfidence: number;
  extractionModel: string;
  extractedAt: Date;
}

export interface ValidationResult {
  isValid: boolean;
  validationConfidence: number;
  validationModel: string;
  notes: string | null;
}

export interface CrossCheckResult {
  agrees: boolean;
  tier2Url: string;
  notes: string | null;
}

export type GeographicLevel = 'global' | 'continental' | 'national' | 'regional';

export interface FieldSpec {
  key: string;
  promptMd: string;
}

export interface DiscoveredUrl {
  url: string;
  tier: SourceTier;
  geographicLevel: GeographicLevel;
  reason: string;
  isOfficial: boolean;
}

export interface DiscoveryResult {
  programId: string;
  programName: string;
  country: string;
  discoveredUrls: DiscoveredUrl[];
  discoveredAt: Date;
}
