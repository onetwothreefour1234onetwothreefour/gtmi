export type SourceTier = 1 | 2 | 3;

export type ReviewDecision = 'approve' | 'reject' | 'request_reextraction';

export interface ScrapeResult {
  url: string;
  contentMarkdown: string;
  contentHash: string;
  scrapedAt: Date;
  httpStatus: number;
  /**
   * Which scraper layer produced this result: "playwright" | "curl_cffi"
   * | "jina" | "wayback". Absent for cache hits from before Session 9.
   * Not persisted — ephemeral observability only.
   */
  layer?: string;
  /**
   * Phase 3.9 / W0 — populated when the orchestrator passes a
   * ScrapeContext with programId/countryIso. The archive write is
   * non-fatal: if it fails (no GCS creds, source row missing, write
   * collision), these stay undefined and downstream stages still run.
   * Read by extract.ts to populate extraction_attempts.scrape_history_id
   * and by publish.ts to populate field_values.archive_path.
   */
  scrapeHistoryId?: string;
  archivePath?: string;
  /**
   * Phase 3.9 / W1 — MIME from the scraper service. "application/pdf"
   * for PDF-extracted scrapes, "text/markdown" otherwise. Drives the
   * archive write's file extension (.pdf vs .md).
   */
  contentType?: string;
  /**
   * Phase 3.9 / W11 — true when the archive write detected that this
   * content_hash matches the most recent archived scrape for the same
   * (program, URL). The page hasn't changed since the last successful
   * scrape; extract.ts skips the LLM batch entirely and the existing
   * field_values rows stay authoritative. A scrape_history row is
   * still inserted with status='unchanged' so we have an audit trail
   * of the re-check.
   */
  unchanged?: boolean;
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
  /**
   * Human-readable field label (e.g. "Salary threshold for principal applicant").
   * Used by content-window selection to derive keywords for chunk scoring.
   * Optional for backwards compatibility — when omitted, windowing falls back
   * to a head-slice (current pre-windowing behaviour, no regression).
   */
  label?: string;
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
