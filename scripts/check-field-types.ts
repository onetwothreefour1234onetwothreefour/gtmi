import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const WAVE_1 = [
  'A.1.1',
  'A.2.1',
  'A.2.2',
  'A.2.3',
  'A.3.1',
  'A.3.2',
  'B.1.1',
  'B.1.2',
  'B.1.3',
  'B.2.1',
  'B.2.2',
  'C.1.1',
  'C.1.2',
  'C.1.4',
  'C.2.1',
  'C.2.2',
  'C.2.3',
  'C.3.1',
  'C.3.2',
  'D.1.1',
  'D.1.2',
  'D.2.1',
  'D.2.2',
  'E.1.1',
  'E.1.3',
  'E.2.2',
  'E.3.2',
];

async function main() {
  const rows = await sql<
    { key: string; normalization_fn: string; data_type: string; label: string }[]
  >`
    SELECT key, normalization_fn, data_type, label
    FROM field_definitions
    WHERE key = ANY(${WAVE_1})
    ORDER BY key
  `;
  console.log('Wave 1 field types:\n');
  const bucket = {
    numeric: [] as string[],
    categorical: [] as string[],
    boolean: [] as string[],
    other: [] as string[],
  };
  for (const r of rows) {
    console.log(
      `  ${r.key.padEnd(7)} norm=${r.normalization_fn.padEnd(12)} dtype=${r.data_type.padEnd(10)} ${r.label}`
    );
    if (r.normalization_fn === 'min_max' || r.normalization_fn === 'z_score')
      bucket.numeric.push(r.key);
    else if (r.normalization_fn === 'categorical') bucket.categorical.push(r.key);
    else if (r.normalization_fn === 'boolean') bucket.boolean.push(r.key);
    else bucket.other.push(r.key);
  }
  console.log(
    `\nSummary: ${bucket.numeric.length} numeric, ${bucket.categorical.length} categorical, ${bucket.boolean.length} boolean, ${bucket.other.length} other`
  );
  console.log(
    `Categorical fields (WILL BE SKIPPED by publish.ts numeric gate): ${bucket.categorical.join(', ')}`
  );
  console.log(
    `Boolean fields (WILL BE SKIPPED by publish.ts numeric gate): ${bucket.boolean.join(', ')}`
  );
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
