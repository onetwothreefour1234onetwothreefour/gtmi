/**
 * Calibration script: read live field_values distribution and print new NORMALIZATION_PARAMS.
 *
 * Queries all approved field_values for min_max fields, computes p10/p90 per field,
 * and outputs a TypeScript snippet ready to paste into packages/scoring/src/engine.ts.
 *
 * Usage:
 *   npx tsx scripts/compute-normalization-params.ts
 *   npx tsx scripts/compute-normalization-params.ts --programs SGP,AUS,GBR
 *
 * Requires ≥ 5 programs with reviewed+approved field_values for calibration to be
 * meaningful. Run once that threshold is met; until then this is informational only.
 */
import postgres from 'postgres';

const DB_URL =
  'postgresql://postgres.xvcrfgovlcencngjxgiw:TTRgroup1234!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

async function main() {
  const programsArgIdx = process.argv.indexOf('--programs');
  const programsFilter =
    programsArgIdx !== -1 ? process.argv[programsArgIdx + 1]?.split(',') : undefined;

  const sql = postgres(DB_URL, { ssl: 'require' });

  const rows = await sql<
    Array<{ field_key: string; value_normalized: number; country_iso: string }>
  >`
    SELECT fd.key AS field_key,
           (fv.value_normalized)::float AS value_normalized,
           p.country_iso
    FROM field_values fv
    JOIN field_definitions fd ON fd.id = fv.field_definition_id
    JOIN programs p ON p.id = fv.program_id
    WHERE fv.status = 'approved'
      AND fv.value_normalized IS NOT NULL
      AND fd.normalization_fn = 'min_max'
      ${programsFilter ? sql`AND p.country_iso = ANY(${programsFilter})` : sql``}
    ORDER BY fd.key
  `;

  // Group by field key.
  const byField = new Map<string, number[]>();
  for (const r of rows) {
    if (!byField.has(r.field_key)) byField.set(r.field_key, []);
    byField.get(r.field_key)!.push(r.value_normalized);
  }

  console.log(
    `\nNormalization parameter candidates (n=${[...byField.values()].reduce((a, b) => a + b.length, 0)} observations across ${rows.length > 0 ? new Set(rows.map((r) => r.country_iso)).size : 0} countries):`
  );
  console.log(
    `⚠  Use these only when ≥5 programs are approved. Current count: ${new Set(rows.map((r) => r.country_iso)).size}`
  );
  console.log('\n// Paste into NORMALIZATION_PARAMS in packages/scoring/src/engine.ts:\n');

  const params: Record<string, { min: number; max: number; p10: number; p90: number; n: number }> =
    {};
  for (const [key, values] of byField.entries()) {
    const sorted = [...values].sort((a, b) => a - b);
    params[key] = {
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      p10: Math.round(percentile(sorted, 10) * 100) / 100,
      p90: Math.round(percentile(sorted, 90) * 100) / 100,
      n: sorted.length,
    };
    console.log(
      `  '${key}': { min: ${params[key]!.p10}, max: ${params[key]!.p90} },  // n=${params[key]!.n}, raw range [${params[key]!.min}, ${params[key]!.max}]`
    );
  }

  if (byField.size === 0) {
    console.log('  (no approved min_max field_values found — run canaries and review first)');
  }

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
