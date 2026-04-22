/**
 * Backfill value_normalized for pending_review field_values whose normalization
 * was null because the currency prefix wasn't stripped before calling normalizeRawValue.
 *
 * Safe: only updates rows where value_normalized IS NULL and the field uses
 * min_max or z_score normalization. Dry-run by default; pass --execute to apply.
 */
import postgres from 'postgres';

const DB_URL =
  'postgresql://postgres.xvcrfgovlcencngjxgiw:TTRgroup1234!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const CURRENCY_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'AUD', re: /^(?:AUD|A\$)\s*/i },
  { code: 'SGD', re: /^(?:SGD|S\$)\s*/i },
  { code: 'HKD', re: /^(?:HKD|HK\$)\s*/i },
  { code: 'NZD', re: /^(?:NZD|NZ\$)\s*/i },
  { code: 'CAD', re: /^(?:CAD|C\$)\s*/i },
  { code: 'USD', re: /^(?:USD|US\$)\s*/i },
  { code: 'EUR', re: /^(?:EUR|€)\s*/i },
  { code: 'GBP', re: /^(?:GBP|£)\s*/i },
  { code: 'JPY', re: /^(?:JPY|¥)\s*/i },
  { code: 'INR', re: /^(?:INR|₹)\s*/i },
  { code: 'AED', re: /^AED\s*/i },
  { code: 'SAR', re: /^SAR\s*/i },
  { code: 'QAR', re: /^QAR\s*/i },
  { code: 'MYR', re: /^(?:MYR|RM)\s*/i },
  { code: 'THB', re: /^(?:THB|฿)\s*/i },
  { code: 'CHF', re: /^CHF\s*/i },
  { code: 'SEK', re: /^SEK\s*/i },
  { code: 'DKK', re: /^DKK\s*/i },
  { code: 'NOK', re: /^NOK\s*/i },
];

function stripCurrencyAndParse(raw: string): { value: number; currency: string } | null {
  for (const { code, re } of CURRENCY_PATTERNS) {
    if (re.test(raw)) {
      const stripped = raw.replace(re, '').replace(/[,\s%]/g, '');
      const n = parseFloat(stripped);
      if (isFinite(n)) return { value: n, currency: code };
    }
  }
  // Also try bare number with commas (no currency prefix).
  const stripped = raw.replace(/[,\s%]/g, '');
  const n = parseFloat(stripped);
  return isFinite(n) ? { value: n, currency: '' } : null;
}

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const sql = postgres(DB_URL, { ssl: 'require' });

  const rows = await sql<
    Array<{
      id: string;
      value_raw: string;
      normalization_fn: string;
      field_key: string;
    }>
  >`
    SELECT fv.id, fv.value_raw, fd.normalization_fn, fd.key AS field_key
    FROM field_values fv
    JOIN field_definitions fd ON fd.id = fv.field_definition_id
    WHERE fv.value_normalized IS NULL
      AND fv.value_raw IS NOT NULL
      AND fd.normalization_fn IN ('min_max', 'z_score')
  `;

  if (rows.length === 0) {
    console.log('No rows need backfill.');
    await sql.end();
    process.exit(0);
  }

  const updates: Array<{ id: string; value: number; currency: string; raw: string; key: string }> =
    [];
  const skipped: Array<{ id: string; raw: string; key: string }> = [];

  for (const r of rows) {
    const parsed = stripCurrencyAndParse(r.value_raw);
    if (parsed) {
      updates.push({
        id: r.id,
        value: parsed.value,
        currency: parsed.currency,
        raw: r.value_raw,
        key: r.field_key,
      });
    } else {
      skipped.push({ id: r.id, raw: r.value_raw, key: r.field_key });
    }
  }

  console.log(`Found ${rows.length} rows with null value_normalized:`);
  console.log(`  Can fix: ${updates.length}`);
  console.log(`  Cannot parse: ${skipped.length}`);

  if (updates.length > 0) {
    console.log('\nRows to fix:');
    for (const u of updates) {
      console.log(
        `  [${u.key}] raw="${u.raw}" → ${u.value}${u.currency ? ` (${u.currency})` : ''}`
      );
    }
  }
  if (skipped.length > 0) {
    console.log('\nRows that cannot be parsed (need manual review):');
    for (const s of skipped) {
      console.log(`  [${s.key}] raw="${s.raw}"`);
    }
  }

  if (dryRun) {
    console.log('\nDry run — pass --execute to apply fixes.');
    await sql.end();
    process.exit(0);
  }

  for (const u of updates) {
    await sql`
      UPDATE field_values
      SET value_normalized = ${u.value}
      WHERE id = ${u.id}
    `;
  }
  console.log(`\nUpdated ${updates.length} rows.`);
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
