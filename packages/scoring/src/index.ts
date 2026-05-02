export { runScoringEngine, scoreSingleIndicator } from './engine';
export { PHASE2_PLACEHOLDER_PARAMS } from './placeholder-params';
export {
  ACTIVE_FIELD_CODES,
  WAVE_1_ENABLED,
  WAVE_1_FIELD_CODES,
  WAVE_2_ENABLED,
  WAVE_2_FIELD_CODES,
} from './wave-config';
export {
  BOOLEAN_WITH_ANNOTATION_KEYS,
  COUNTRY_REGIONS,
  REGIONAL_SUBSTITUTES,
  getRegionalSubstitute,
  normalizeBooleanWithAnnotation,
} from './normalize';
export type { Region, RegionalSubstitute } from './normalize';
export { normalizeRawValue } from './normalize-raw';
export type { NormalizedValue } from './normalize-raw';
export {
  NUMERIC_NO_LIMIT_SENTINELS,
  NO_LIMIT_MARKER,
  isNumericNoLimitSentinel,
  isNoLimitMarker,
  isNotApplicableMarker,
} from './sentinels';
export type { NoLimitMarker, NotApplicableMarker } from './sentinels';
export type {
  ScoringInput,
  ScoringOutput,
  FieldValueRecord,
  FieldDefinitionRecord,
  NormalizationParams,
  NormalizationParamSet,
  NormalizationFn,
  Direction,
  CategoricalRubric,
} from './types';
export { ScoringError } from './types';
// Phase 3.10c.2 — Phase 6 severity classifier.
export {
  classifyPolicyChangeSeverity,
  SEVERITY_BREAKING_THRESHOLD,
  SEVERITY_MATERIAL_THRESHOLD,
} from './policy-change-severity';
export type {
  PolicyChangeSeverity,
  PolicyChangeSeverityInput,
  PolicyChangeSeverityResult,
} from './policy-change-severity';
