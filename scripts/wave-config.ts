/**
 * Phase 3.7 / ADR-021 — wave config moved to `@gtmi/scoring/src/wave-config.ts`
 * so apps/web can import without depending on the scripts workspace.
 * This file is now a thin re-export shim; existing imports in scripts/
 * and jobs/ keep working.
 */

export {
  ACTIVE_FIELD_CODES,
  WAVE_1_ENABLED,
  WAVE_1_FIELD_CODES,
  WAVE_2_ENABLED,
  WAVE_2_FIELD_CODES,
} from '@gtmi/scoring';
