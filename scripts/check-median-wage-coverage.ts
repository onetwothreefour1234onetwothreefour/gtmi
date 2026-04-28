// Phase 3.6 / Fix D — live-DB cohort-coverage check for the median-wage
// table. Run pre-canary to assert that for every country with at least
// one is_primary=true Tier 1 source row in `sources`, there is a
// corresponding entry in COUNTRY_MEDIAN_WAGE.
//
// Exits 1 on any miss so this can gate CI / a release script.
//
// Usage:
//   pnpm exec tsx scripts/check-median-wage-coverage.ts

import 'dotenv/config';
import { db, sources, programs } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { COUNTRY_MEDIAN_WAGE, COUNTRY_CITIZENSHIP_RESIDENCE_YEARS } from '@gtmi/extraction';

async function main(): Promise<void> {
  const rows = await db
    .select({ countryIso: programs.countryIso })
    .from(sources)
    .innerJoin(programs, eq(sources.programId, programs.id))
    .where(eq(sources.isPrimary, true));

  const cohort = [...new Set(rows.map((r) => r.countryIso))].sort();

  const missingWage = cohort.filter((iso) => !COUNTRY_MEDIAN_WAGE[iso]);
  const missingCitizenship = cohort.filter((iso) => !COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[iso]);

  console.log(
    `[check-median-wage-coverage] Cohort countries with is_primary=true Tier 1 sources: ${cohort.length}`
  );
  console.log(`  ${cohort.join(', ')}`);
  console.log('');

  if (missingWage.length === 0) {
    console.log('[OK] COUNTRY_MEDIAN_WAGE covers every cohort country.');
  } else {
    console.error(`[FAIL] COUNTRY_MEDIAN_WAGE is missing entries for: ${missingWage.join(', ')}`);
  }
  if (missingCitizenship.length === 0) {
    console.log('[OK] COUNTRY_CITIZENSHIP_RESIDENCE_YEARS covers every cohort country.');
  } else {
    console.error(
      `[FAIL] COUNTRY_CITIZENSHIP_RESIDENCE_YEARS is missing entries for: ${missingCitizenship.join(', ')}`
    );
  }

  if (missingWage.length > 0 || missingCitizenship.length > 0) {
    process.exit(1);
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
