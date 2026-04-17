import * as schema from './schema';

export type Country = typeof schema.countries.$inferSelect;
export type NewCountry = typeof schema.countries.$inferInsert;

export type Program = typeof schema.programs.$inferSelect;
export type NewProgram = typeof schema.programs.$inferInsert;

export type Source = typeof schema.sources.$inferSelect;
export type NewSource = typeof schema.sources.$inferInsert;

export type FieldDefinition = typeof schema.fieldDefinitions.$inferSelect;
export type NewFieldDefinition = typeof schema.fieldDefinitions.$inferInsert;

export type MethodologyVersion = typeof schema.methodologyVersions.$inferSelect;
export type NewMethodologyVersion = typeof schema.methodologyVersions.$inferInsert;

export type FieldValue = typeof schema.fieldValues.$inferSelect;
export type NewFieldValue = typeof schema.fieldValues.$inferInsert;

export type Score = typeof schema.scores.$inferSelect;
export type NewScore = typeof schema.scores.$inferInsert;

export type ScrapeHistory = typeof schema.scrapeHistory.$inferSelect;
export type NewScrapeHistory = typeof schema.scrapeHistory.$inferInsert;

export type PolicyChange = typeof schema.policyChanges.$inferSelect;
export type NewPolicyChange = typeof schema.policyChanges.$inferInsert;

export type ReviewQueue = typeof schema.reviewQueue.$inferSelect;
export type NewReviewQueue = typeof schema.reviewQueue.$inferInsert;

export type NewsSignal = typeof schema.newsSignals.$inferSelect;
export type NewNewsSignal = typeof schema.newsSignals.$inferInsert;

export type SensitivityRun = typeof schema.sensitivityRuns.$inferSelect;
export type NewSensitivityRun = typeof schema.sensitivityRuns.$inferInsert;
