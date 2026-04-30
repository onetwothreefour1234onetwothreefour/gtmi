import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. countries
export const countries = pgTable(
  'countries',
  {
    isoCode: varchar('iso_code', { length: 3 }).primaryKey(),
    name: text('name').notNull(),
    region: text('region').notNull(),
    imdRank: integer('imd_rank'),
    imdAppealScore: decimal('imd_appeal_score', { precision: 5, scale: 2 }),
    imdAppealScoreCmeNormalized: decimal('imd_appeal_score_cme_normalized', {
      precision: 5,
      scale: 2,
    }),
    govPortalUrl: text('gov_portal_url'),
    taxAuthorityUrl: text('tax_authority_url'),
    lastImdRefresh: timestamp('last_imd_refresh'),
  },
  () => [
    pgPolicy('Team members can write countries', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read countries', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 2. programs
export const programs = pgTable(
  'programs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryIso: varchar('country_iso', { length: 3 })
      .notNull()
      .references(() => countries.isoCode),
    name: text('name').notNull(),
    category: text('category').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    launchYear: integer('launch_year'),
    closureYear: integer('closure_year'),
    descriptionMd: text('description_md'),
    longSummaryMd: text('long_summary_md'),
    longSummaryUpdatedAt: timestamp('long_summary_updated_at'),
    longSummaryReviewer: uuid('long_summary_reviewer'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_programs_country_iso').on(table.countryIso),
    index('idx_programs_status').on(table.status),
    pgPolicy('Team members can write programs', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read programs', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 3. sources
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    url: text('url').notNull(),
    tier: integer('tier').notNull(),
    sourceCategory: varchar('source_category', { length: 50 }).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    scrapeScheduleCron: text('scrape_schedule_cron'),
    lastScrapedAt: timestamp('last_scraped_at'),
    lastContentHash: text('last_content_hash'),
    // Phase 3.6 / ADR-015 — self-improving sources table.
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
    discoveredBy: varchar('discovered_by', { length: 50 }).default('seed'),
    geographicLevel: varchar('geographic_level', { length: 20 }),
  },
  (table) => [
    index('idx_sources_program_id').on(table.programId),
    index('idx_sources_tier').on(table.tier),
    uniqueIndex('sources_program_id_url_unique').on(table.programId, table.url),
    pgPolicy('Team members can write sources', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);

// 4. field_definitions
export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    label: text('label').notNull(),
    dataType: varchar('data_type', { length: 50 }).notNull(),
    pillar: varchar('pillar', { length: 1 }).notNull(),
    subFactor: varchar('sub_factor', { length: 10 }).notNull(),
    weightWithinSubFactor: decimal('weight_within_sub_factor', {
      precision: 5,
      scale: 4,
    }).notNull(),
    extractionPromptMd: text('extraction_prompt_md').notNull(),
    scoringRubricJsonb: jsonb('scoring_rubric_jsonb'),
    normalizationFn: varchar('normalization_fn', { length: 50 }).notNull(),
    direction: varchar('direction', { length: 50 }).notNull(),
    sourceTierRequired: integer('source_tier_required').notNull(),
    versionIntroduced: varchar('version_introduced', { length: 50 }).notNull(),
    // Phase 3.4 / ADR-013: gate Tier 2 backfill at the indicator level.
    // Default false; flipped true for the ADR-013 allowlist (B.3.3, C.2.4, D.2.3).
    tier2Allowed: boolean('tier2_allowed').notNull().default(false),
    // Phase 3.9 — current active prompt version (from extraction_prompts).
    // Backfilled to prompt-v1 by migration 00014.
    currentPromptId: uuid('current_prompt_id'),
  },
  () => [
    pgPolicy('Team members can write field_definitions', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read field_definitions', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 9. methodology_versions
export const methodologyVersions = pgTable(
  'methodology_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publishedAt: timestamp('published_at'),
    versionTag: varchar('version_tag', { length: 50 }).notNull(),
    frameworkStructure: jsonb('framework_structure').notNull(),
    pillarWeights: jsonb('pillar_weights').notNull(),
    subFactorWeights: jsonb('sub_factor_weights').notNull(),
    indicatorWeights: jsonb('indicator_weights').notNull(),
    normalizationChoices: jsonb('normalization_choices').notNull(),
    rubricVersions: jsonb('rubric_versions').notNull(),
    cmePaqSplit: jsonb('cme_paq_split').notNull(),
    changeNotes: text('change_notes'),
    createdBy: uuid('created_by'),
  },
  () => [
    pgPolicy('Team members can write methodology_versions', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read methodology_versions', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 5. field_values
export const fieldValues = pgTable(
  'field_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    valueRaw: text('value_raw'),
    valueNormalized: jsonb('value_normalized'),
    valueIndicatorScore: decimal('value_indicator_score', { precision: 5, scale: 2 }),
    sourceId: uuid('source_id').references(() => sources.id),
    provenance: jsonb('provenance'),
    status: varchar('status', { length: 50 }).notNull(),
    extractedAt: timestamp('extracted_at').defaultNow(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    methodologyVersionId: uuid('methodology_version_id').references(() => methodologyVersions.id),
    // Phase 3.9 / W7 — GCS storage path for the source-page snapshot
    // that produced the winning extraction. Provenance drawer falls back
    // to a signed URL of this path when the live sourceUrl returns 404.
    archivePath: text('archive_path'),
  },
  (table) => [
    uniqueIndex('idx_field_values_prog_def').on(table.programId, table.fieldDefinitionId),
    index('idx_field_values_status').on(table.status),
    index('idx_field_values_methodology').on(table.methodologyVersionId),
    index('idx_field_values_source_id').on(table.sourceId),
    pgPolicy('Team members can write field_values', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read approved field_values', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`status = 'approved'`,
    }),
  ]
);

// 6. scores
export const scores = pgTable(
  'scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    methodologyVersionId: uuid('methodology_version_id')
      .notNull()
      .references(() => methodologyVersions.id),
    scoredAt: timestamp('scored_at').defaultNow().notNull(),
    cmeScore: decimal('cme_score', { precision: 5, scale: 2 }),
    paqScore: decimal('paq_score', { precision: 5, scale: 2 }),
    compositeScore: decimal('composite_score', { precision: 5, scale: 2 }),
    pillarScores: jsonb('pillar_scores'),
    subFactorScores: jsonb('sub_factor_scores'),
    dataCoveragePct: decimal('data_coverage_pct', { precision: 5, scale: 2 }),
    flaggedInsufficientDisclosure: boolean('flagged_insufficient_disclosure').default(false),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_scores_prog_methodology').on(table.programId, table.methodologyVersionId),
    pgPolicy('Team members can write scores', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read scores', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 7. scrape_history
// Phase 3.9 — extended with archive metadata. The scraper writes one row
// per successful scrape; the storage_path points at the GCS bucket
// (canonical), raw_markdown_storage_path is retained for backward compat.
export const scrapeHistory = pgTable(
  'scrape_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id),
    scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
    httpStatus: integer('http_status'),
    contentHash: text('content_hash'),
    rawMarkdownStoragePath: text('raw_markdown_storage_path'),
    extractionJobId: text('extraction_job_id'),
    status: varchar('status', { length: 50 }),
    // Phase 3.9 additions
    storagePath: text('storage_path'),
    byteSize: integer('byte_size'),
    contentType: varchar('content_type', { length: 100 }),
    languageDetected: varchar('language_detected', { length: 8 }),
    translationPath: text('translation_path'),
    translationVersion: varchar('translation_version', { length: 32 }),
    extractorVersion: varchar('extractor_version', { length: 32 }),
    fieldsExtracted: jsonb('fields_extracted'),
    needsReextraction: boolean('needs_reextraction').default(false).notNull(),
    supersededBy: uuid('superseded_by'),
    requestHeaders: jsonb('request_headers'),
  },
  (table) => [
    index('idx_scrape_history_source_scraped').on(table.sourceId, table.scrapedAt.desc()),
    pgPolicy('Team members can write scrape_history', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);

// 8. policy_changes
export const policyChanges = pgTable(
  'policy_changes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    previousValueId: uuid('previous_value_id').references(() => fieldValues.id),
    newValueId: uuid('new_value_id').references(() => fieldValues.id),
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    paqDelta: decimal('paq_delta', { precision: 5, scale: 2 }),
    summaryText: text('summary_text'),
    summaryHumanApproved: boolean('summary_human_approved').default(false),
    waybackUrl: text('wayback_url'),
  },
  (table) => [
    index('idx_policy_changes_prog_detected').on(table.programId, table.detectedAt.desc()),
    index('idx_policy_changes_severity').on(table.severity),
    index('idx_policy_changes_field_def').on(table.fieldDefinitionId),
    index('idx_policy_changes_prev_val').on(table.previousValueId),
    index('idx_policy_changes_new_val').on(table.newValueId),
    pgPolicy('Team members can write policy_changes', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
    pgPolicy('Public read approved policy_changes', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`summary_human_approved = true`,
    }),
  ]
);

// 10. review_queue
export const reviewQueue = pgTable(
  'review_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fieldValueId: uuid('field_value_id')
      .notNull()
      .references(() => fieldValues.id),
    flaggedReason: text('flagged_reason').notNull(),
    priority: integer('priority').notNull(),
    assignedTo: uuid('assigned_to'),
    status: varchar('status', { length: 50 }).notNull(),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    extractionSnapshot: jsonb('extraction_snapshot'),
    validationSnapshot: jsonb('validation_snapshot'),
  },
  (table) => [
    index('idx_review_queue_field_val').on(table.fieldValueId),
    index('idx_review_queue_status_priority').on(table.status, table.priority),
    pgPolicy('Team members can write review_queue', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);

// 11. news_signals
export const newsSignals = pgTable(
  'news_signals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceUrl: text('source_url').notNull(),
    publication: text('publication').notNull(),
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
    matchedPrograms: jsonb('matched_programs'),
    summary: text('summary'),
    triggeredReviewQueueId: uuid('triggered_review_queue_id').references(() => reviewQueue.id),
  },
  (table) => [
    index('idx_news_signals_review_queue').on(table.triggeredReviewQueueId),
    pgPolicy('Team members can write news_signals', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);

// 12. sensitivity_runs
export const sensitivityRuns = pgTable(
  'sensitivity_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    methodologyVersionId: uuid('methodology_version_id')
      .notNull()
      .references(() => methodologyVersions.id),
    runType: varchar('run_type', { length: 50 }).notNull(),
    runAt: timestamp('run_at').defaultNow().notNull(),
    results: jsonb('results').notNull(),
  },
  (table) => [
    index('idx_sensitivity_runs_methodology').on(table.methodologyVersionId),
    pgPolicy('Team members can write sensitivity_runs', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);

// 14. scrape_cache
export const scrapeCache = pgTable(
  'scrape_cache',
  {
    url: text('url').primaryKey(),
    contentMarkdown: text('content_markdown').notNull(),
    contentHash: text('content_hash').notNull(),
    httpStatus: integer('http_status').notNull(),
    scrapedAt: timestamp('scraped_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    status: text('status').default('ok'),
    failureReason: text('failure_reason'),
    retryAfter: timestamp('retry_after', { withTimezone: true }),
  },
  () => [
    pgPolicy('Team members can write scrape_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// 15. discovery_cache
export const discoveryCache = pgTable(
  'discovery_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    programId: uuid('program_id').notNull(),
    discoveredUrls: jsonb('discovered_urls').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  () => [
    pgPolicy('Team members can write discovery_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// 16. extraction_cache
export const extractionCache = pgTable(
  'extraction_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    model: text('model').notNull(),
    resultJsonb: jsonb('result_jsonb').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  () => [
    pgPolicy('Team members can write extraction_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// 17. validation_cache
export const validationCache = pgTable(
  'validation_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    model: text('model').notNull(),
    resultJsonb: jsonb('result_jsonb').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  () => [
    pgPolicy('Team members can write validation_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// Phase 3.9 / W8 — Stage 0 discovery telemetry.
// One row per discovery invocation. Powers the "when can we stop paying
// Perplexity" decision: when marginal_yield_pct trends toward 0%, the
// cohort archive has saturated and Stage 0 can shift to archive-only
// re-runs (W6) for mature countries. Migration 00016.
export const discoveryTelemetry = pgTable(
  'discovery_telemetry',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    countryIso: varchar('country_iso', { length: 3 }).notNull(),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
    urlsDiscovered: integer('urls_discovered').notNull(),
    urlsAlreadyInRegistry: integer('urls_already_in_registry').notNull(),
    urlsAlreadyInArchiveForCountry: integer('urls_already_in_archive_for_country').notNull(),
    urlsNewToArchive: integer('urls_new_to_archive').notNull(),
    marginalYieldPct: decimal('marginal_yield_pct', { precision: 5, scale: 2 }).notNull(),
    cacheHit: boolean('cache_hit').default(false).notNull(),
    notes: jsonb('notes'),
  },
  (table) => [
    index('idx_discovery_telemetry_program_at').on(table.programId, table.discoveredAt.desc()),
    index('idx_discovery_telemetry_country_at').on(table.countryIso, table.discoveredAt.desc()),
    pgPolicy('Team members can write discovery_telemetry', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
    pgPolicy('Public read discovery_telemetry', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// Phase 3.9 / W2 — translation cache.
// Memoises non-English-to-English translations of scrape markdown so
// re-running the same scrape (or re-extracting from archive) does not
// pay the translation LLM cost twice. Migration 00015.
export const translationCache = pgTable(
  'translation_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    sourceLanguage: varchar('source_language', { length: 8 }).notNull(),
    translationVersion: varchar('translation_version', { length: 32 }).notNull(),
    sourceContentHash: text('source_content_hash').notNull(),
    translatedText: text('translated_text').notNull(),
    translatedAt: timestamp('translated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  () => [
    pgPolicy('Team members can write translation_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// 18. crosscheck_cache
export const crosscheckCache = pgTable(
  'crosscheck_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    model: text('model').notNull(),
    resultJsonb: jsonb('result_jsonb').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  () => [
    pgPolicy('Team members can write crosscheck_cache', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// ──────────────────────────────────────────────────────────────────────
// Phase 3.9 — extraction history + prompt versioning + model registry.
// Migration 00014 creates these tables and backfills prompt-v1 per
// field_definition. The pipeline writes to extraction_attempts on every
// extraction (including runner-up URLs); publish.ts flips was_published.
// ──────────────────────────────────────────────────────────────────────

// 19. extraction_models — registry of (model_id, version_tag) pairs that
// produced extraction_attempts rows. Seeded with claude-sonnet-4-6 plus
// the synthetic markers used by direct-API and derive paths.
export const extractionModels = pgTable(
  'extraction_models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: text('model_id').notNull(),
    versionTag: varchar('version_tag', { length: 50 }).notNull(),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_extraction_models_model_version').on(table.modelId, table.versionTag),
    pgPolicy('Team members can write extraction_models', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
    pgPolicy('Public read extraction_models', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 20. extraction_prompts — versioned prompt content per field_definition.
// Prompt rotations create new rows; field_definitions.current_prompt_id
// points at the active row. extraction_attempts.extraction_prompt_id
// records which version produced each attempt.
export const extractionPrompts = pgTable(
  'extraction_prompts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    versionTag: varchar('version_tag', { length: 50 }).notNull(),
    promptMd: text('prompt_md').notNull(),
    promptHash: varchar('prompt_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_extraction_prompts_field_hash').on(table.fieldDefinitionId, table.promptHash),
    index('idx_extraction_prompts_field_created').on(
      table.fieldDefinitionId,
      table.createdAt.desc()
    ),
    pgPolicy('Team members can write extraction_prompts', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
    pgPolicy('Public read extraction_prompts', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
);

// 21. extraction_attempts — append-only history of every extraction
// attempt across (program × field × URL × prompt × run). Never
// overwritten by re-runs. Powers field_url_yield (W10) and surgical
// re-runs (W12).
export const extractionAttempts = pgTable(
  'extraction_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    sourceUrl: text('source_url').notNull(),
    scrapeHistoryId: uuid('scrape_history_id').references(() => scrapeHistory.id),
    contentHash: text('content_hash'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
    valueRaw: text('value_raw'),
    sourceSentence: text('source_sentence'),
    characterOffsets: jsonb('character_offsets'),
    extractionModel: text('extraction_model').notNull(),
    extractionPromptId: uuid('extraction_prompt_id').references(() => extractionPrompts.id),
    extractionConfidence: decimal('extraction_confidence', { precision: 3, scale: 2 }),
    validationConfidence: decimal('validation_confidence', { precision: 3, scale: 2 }),
    wasPublished: boolean('was_published').default(false).notNull(),
    supersededBy: uuid('superseded_by'),
    gateVerdict: varchar('gate_verdict', { length: 64 }),
    reextractRejectReason: text('reextract_reject_reason'),
    notes: jsonb('notes'),
  },
  (table) => [
    index('idx_extraction_attempts_prog_field_attempted').on(
      table.programId,
      table.fieldDefinitionId,
      table.attemptedAt.desc()
    ),
    index('idx_extraction_attempts_url_field').on(table.sourceUrl, table.fieldDefinitionId),
    pgPolicy('Team members can write extraction_attempts', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated',
      using: sql`true`,
    }),
  ]
);

// 13. news_sources
export const newsSources = pgTable(
  'news_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    url: text('url').notNull().unique(),
    publication: text('publication').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  () => [
    pgPolicy('Team members can write news_sources', {
      as: 'permissive',
      for: 'all',
      to: 'authenticated', // V1 PLACEHOLDER: tighten to specific team role before public launch.
      using: sql`true`,
    }),
  ]
);
