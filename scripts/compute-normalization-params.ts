/**
 * scripts/compute-normalization-params.ts
 *
 * Phase 3.10d / B.1 — calibration runner.
 *
 * Reads approved field_values for every min_max + z_score field,
 * computes per-field calibrated normalization params, prints them in
 * the legacy paste-into-engine.ts shape, and (with --persist) writes
 * them onto the methodology_versions row so scoreProgramFromDb picks
 * them up on the next rescore.
 *
 * Usage:
 *   pnpm tsx scripts/compute-normalization-params.ts                                (dry print)
 *   pnpm tsx scripts/compute-normalization-params.ts --programs SGP,AUS,GBR        (filter)
 *   pnpm tsx scripts/compute-normalization-params.ts --persist                      (write to DB)
 *   pnpm tsx scripts/compute-normalization-params.ts --persist --force-below-threshold
 *
 * Threshold: ≥5 distinct programmes scored before --persist will
 * proceed. Pass --force-below-threshold to override (used in dev /
 * testing). Below the threshold the params are printed but
 * phase2Placeholder=true continues to apply.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { db, methodologyVersions } from '@gtmi/db';
import {
  computeCalibratedParams,
  persistCalibratedParams,
  CALIBRATION_MIN_PROGRAMMES,
} from '@gtmi/extraction';

dotenv.config({ path: join(__dirname, '../.env') });

interface CliArgs {
  programmeFilter?: string[];
  persist: boolean;
  forceBelowThreshold: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { persist: false, forceBelowThreshold: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--programs' && next) {
      out.programmeFilter = next
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      i++;
    } else if (a === '--persist') out.persist = true;
    else if (a === '--force-below-threshold') out.forceBelowThreshold = true;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await computeCalibratedParams(args.programmeFilter);

  console.log(
    `\nCalibration: ${result.nObservations} observations across ${result.nPrograms} programmes` +
      `${result.meetsThreshold ? '' : ` (BELOW threshold of ${CALIBRATION_MIN_PROGRAMMES})`}`
  );
  if (!result.meetsThreshold) {
    console.warn(
      `WARNING: Need ≥${CALIBRATION_MIN_PROGRAMMES} programmes for meaningful calibration.` +
        ` --persist will refuse unless --force-below-threshold is also passed.`
    );
  }

  console.log('\n// Calibrated NORMALIZATION_PARAMS:\n');
  for (const [key, p] of Object.entries(result.params)) {
    const audit = result.perField[key];
    if ('min' in p && 'max' in p) {
      console.log(
        `  '${key}': { min: ${p.min}, max: ${p.max} },  // n=${audit?.n ?? '?'}, raw range [${audit?.rawMin ?? '?'}, ${audit?.rawMax ?? '?'}]`
      );
    } else if ('mean' in p && 'stddev' in p) {
      console.log(
        `  '${key}': { mean: ${p.mean}, stddev: ${p.stddev} },  // n=${audit?.n ?? '?'}, raw range [${audit?.rawMin ?? '?'}, ${audit?.rawMax ?? '?'}]`
      );
    }
  }

  if (Object.keys(result.params).length === 0) {
    console.log('  (no approved min_max / z_score field_values found)');
  }

  if (!args.persist) {
    console.log(
      '\nDry-print only. Pass --persist to write into methodology_versions.calibrated_params.'
    );
    process.exit(0);
  }

  if (!result.meetsThreshold && !args.forceBelowThreshold) {
    console.error(
      `\nRefusing --persist: ${result.nPrograms} programmes < ${CALIBRATION_MIN_PROGRAMMES}. ` +
        `Pass --force-below-threshold to override.`
    );
    process.exit(2);
  }

  // Resolve methodology version (first row).
  const mvRows = await db.select({ id: methodologyVersions.id }).from(methodologyVersions).limit(1);
  const mvId = mvRows[0]?.id;
  if (!mvId) {
    console.error('No methodology_versions row found.');
    process.exit(1);
  }

  await persistCalibratedParams(mvId, result);
  console.log(
    `\n[PERSISTED] methodology_versions.calibrated_params updated (id=${mvId}, n=${result.nPrograms}).`
  );
  console.log(
    `Next rescore via scoreProgramFromDb will use the calibrated params; phase2Placeholder=false on those rows.`
  );
  process.exit(0);
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
