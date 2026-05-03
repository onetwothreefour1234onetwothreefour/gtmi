// Phase 3.10d / B.1 — calibration helper.
//
// Reads approved field_values for every min_max + z_score field from the
// live DB, computes per-field calibrated normalization params, and
// optionally persists to methodology_versions.calibrated_params.
//
// Library function — exported from @gtmi/extraction so the
// scripts/compute-normalization-params.ts CLI and the future
// Trigger.dev `calibrate-and-rescore` job (Phase 3.10d / B.2) can both
// call it.
//
// Threshold: ≥5 distinct programmes scored before calibration is
// considered meaningful. Below that, the helper still returns the
// computed params but flags them so the caller can decide whether to
// persist.

import { db, fieldValues, fieldDefinitions, programs, methodologyVersions } from '@gtmi/db';
import { and, eq, sql } from 'drizzle-orm';
import type { NormalizationParams, NormalizationParamSet } from '@gtmi/scoring';

export const CALIBRATION_MIN_PROGRAMMES = 5;

export interface CalibrationParams {
  /** Computed params keyed by field key. Empty when no min_max / z_score data. */
  params: NormalizationParams;
  /** Distinct programmes that contributed at least one approved value. */
  nPrograms: number;
  /** Total approved observations across all min_max + z_score fields. */
  nObservations: number;
  /** True when nPrograms >= CALIBRATION_MIN_PROGRAMMES. */
  meetsThreshold: boolean;
  /** Per-field n + raw range for audit. */
  perField: Record<string, { n: number; rawMin: number; rawMax: number }>;
}

interface RawRow {
  field_key: string;
  normalization_fn: string;
  value_normalized: number;
  country_iso: string;
  program_id: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], mu: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((a, v) => a + (v - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute calibration params from approved field_values. min_max
 * fields use p10/p90; z_score fields use mean/stddev. Country-
 * scoped via `programmeFilter` if provided (mirror the CLI's
 * `--programs AUS,SGP` flag).
 */
export async function computeCalibratedParams(
  programmeFilter?: string[]
): Promise<CalibrationParams> {
  const rows = (await db
    .select({
      field_key: fieldDefinitions.key,
      normalization_fn: fieldDefinitions.normalizationFn,
      value_normalized: sql<number>`(${fieldValues.valueNormalized})::float`,
      country_iso: programs.countryIso,
      program_id: fieldValues.programId,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .innerJoin(programs, eq(programs.id, fieldValues.programId))
    .where(
      and(
        eq(fieldValues.status, 'approved'),
        sql`${fieldValues.valueNormalized} IS NOT NULL`,
        sql`${fieldDefinitions.normalizationFn} IN ('min_max', 'z_score')`
      )
    )) as RawRow[];

  const filtered =
    programmeFilter && programmeFilter.length > 0
      ? rows.filter((r) => programmeFilter.includes(r.country_iso))
      : rows;

  const byField = new Map<string, { fn: string; values: number[] }>();
  for (const r of filtered) {
    const entry = byField.get(r.field_key) ?? { fn: r.normalization_fn, values: [] };
    entry.values.push(Number(r.value_normalized));
    byField.set(r.field_key, entry);
  }

  const params: NormalizationParams = {};
  const perField: Record<string, { n: number; rawMin: number; rawMax: number }> = {};

  for (const [key, { fn, values }] of byField.entries()) {
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const rawMin = sorted[0]!;
    const rawMax = sorted[sorted.length - 1]!;
    perField[key] = { n: values.length, rawMin, rawMax };
    if (fn === 'min_max') {
      params[key] = {
        min: Math.round(percentile(sorted, 10) * 100) / 100,
        max: Math.round(percentile(sorted, 90) * 100) / 100,
      } as NormalizationParamSet;
    } else if (fn === 'z_score') {
      const mu = mean(values);
      const sigma = stddev(values, mu);
      params[key] = {
        mean: Math.round(mu * 100) / 100,
        stddev: Math.round(sigma * 100) / 100,
      } as NormalizationParamSet;
    }
  }

  const nPrograms = new Set(filtered.map((r) => r.program_id)).size;
  const nObservations = filtered.length;

  return {
    params,
    nPrograms,
    nObservations,
    meetsThreshold: nPrograms >= CALIBRATION_MIN_PROGRAMMES,
    perField,
  };
}

/**
 * Persist calibrated params onto a methodology_versions row. Idempotent:
 * subsequent calls overwrite. Returns the row id.
 */
export async function persistCalibratedParams(
  methodologyVersionId: string,
  result: CalibrationParams
): Promise<void> {
  await db
    .update(methodologyVersions)
    .set({
      calibratedParams: result.params,
      calibratedAt: new Date(),
      calibratedNPrograms: result.nPrograms,
    })
    .where(eq(methodologyVersions.id, methodologyVersionId));
}

/**
 * Read calibrated params for a methodology version. Returns null when
 * calibration hasn't run for this version yet — callers should fall
 * back to PHASE2_PLACEHOLDER_PARAMS in that case and tag the resulting
 * scores with phase2Placeholder=true.
 */
export async function loadCalibratedParams(
  methodologyVersionId: string
): Promise<NormalizationParams | null> {
  const rows = await db
    .select({ calibratedParams: methodologyVersions.calibratedParams })
    .from(methodologyVersions)
    .where(eq(methodologyVersions.id, methodologyVersionId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.calibratedParams) return null;
  return row.calibratedParams as NormalizationParams;
}
