// Phase 3.10d / B.2 — Phase 5 prereq: calibrate-and-rescore cron.
//
// After Phase 5 cohort lands and ≥5 programmes have approved
// field_values, this cron runs weekly:
//   1. computeCalibratedParams() over the live cohort
//   2. persistCalibratedParams() onto the current methodology_versions row
//   3. scoreProgramFromDb() for every scored programme — rescores
//      under the new calibrated params, clearing phase2Placeholder
//      on every fresh row.
//
// Cron: Mondays at 06:00 UTC (one hour after diff-and-classify;
// two hours after the maintenance scrape; three hours after
// blocker-recheck — the Monday morning ops chain).
//
// Below the n>=5 threshold the job logs a skip and exits without
// persisting; the placeholder params keep applying.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, methodologyVersions, scores, programs } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import {
  computeCalibratedParams,
  persistCalibratedParams,
  scoreProgramFromDb,
  CALIBRATION_MIN_PROGRAMMES,
} from '@gtmi/extraction';

export const calibrateAndRescore = schedules.task({
  id: 'calibrate-and-rescore',
  // Mondays at 06:00 UTC.
  cron: '0 6 * * 1',
  maxDuration: 1800,
  run: async (): Promise<{
    status: 'ok' | 'skipped';
    nPrograms: number;
    nObservations: number;
    persisted: boolean;
    rescored: number;
    rescoreFailures: number;
    reason?: string;
  }> => {
    console.log('[calibrate-and-rescore] starting');
    const result = await computeCalibratedParams();
    console.log(
      `[calibrate-and-rescore] cohort: nPrograms=${result.nPrograms} nObservations=${result.nObservations} fields=${Object.keys(result.params).length}`
    );

    if (!result.meetsThreshold) {
      console.log(
        `[calibrate-and-rescore] SKIP: nPrograms=${result.nPrograms} < ${CALIBRATION_MIN_PROGRAMMES}; placeholder params remain.`
      );
      return {
        status: 'skipped',
        nPrograms: result.nPrograms,
        nObservations: result.nObservations,
        persisted: false,
        rescored: 0,
        rescoreFailures: 0,
        reason: `below_threshold_${CALIBRATION_MIN_PROGRAMMES}`,
      };
    }

    // Resolve the methodology version (first row).
    const mvRows = await db
      .select({ id: methodologyVersions.id })
      .from(methodologyVersions)
      .limit(1);
    const mvId = mvRows[0]?.id;
    if (!mvId) {
      console.error('[calibrate-and-rescore] no methodology_versions row found.');
      return {
        status: 'skipped',
        nPrograms: result.nPrograms,
        nObservations: result.nObservations,
        persisted: false,
        rescored: 0,
        rescoreFailures: 0,
        reason: 'no_methodology_version',
      };
    }

    await persistCalibratedParams(mvId, result);
    console.log(
      `[calibrate-and-rescore] PERSISTED methodology_versions.calibrated_params (id=${mvId})`
    );

    // Rescore every programme that already has a scores row. New
    // metadata.phase2Placeholder=false on every fresh row.
    const scoredRows = await db
      .select({ programId: scores.programId, programName: programs.name })
      .from(scores)
      .innerJoin(programs, eq(programs.id, scores.programId));

    let rescored = 0;
    let rescoreFailures = 0;
    for (const r of scoredRows) {
      try {
        await scoreProgramFromDb(r.programId, { methodologyVersionId: mvId });
        rescored++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[calibrate-and-rescore] rescore failed for ${r.programName}: ${msg}`);
        rescoreFailures++;
      }
    }

    console.log(
      `[calibrate-and-rescore] done; persisted=true rescored=${rescored} failures=${rescoreFailures}`
    );
    return {
      status: 'ok',
      nPrograms: result.nPrograms,
      nObservations: result.nObservations,
      persisted: true,
      rescored,
      rescoreFailures,
    };
  },
});
