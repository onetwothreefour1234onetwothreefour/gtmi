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
    url: text('url').notNull().unique(),
    tier: integer('tier').notNull(),
    sourceCategory: varchar('source_category', { length: 50 }).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    scrapeScheduleCron: text('scrape_schedule_cron'),
    lastScrapedAt: timestamp('last_scraped_at'),
    lastContentHash: text('last_content_hash'),
  },
  (table) => [
    index('idx_sources_program_id').on(table.programId),
    index('idx_sources_tier').on(table.tier),
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
