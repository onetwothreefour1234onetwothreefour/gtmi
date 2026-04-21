import postgres from 'postgres';
import { RUBRIC_SCORES } from '../packages/db/src/seed/rubric-scores';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

interface RubricRow {
  key: string;
  scoring_rubric_jsonb: {
    categories: Array<{ value: string; description?: string; score?: number }>;
  } | null;
}

async function main() {
  const rows = await sql<RubricRow[]>`
    SELECT key, scoring_rubric_jsonb
    FROM field_definitions
    WHERE normalization_fn = 'categorical'
    ORDER BY key
  `;

  console.log(`Found ${rows.length} categorical field_definitions\n`);

  let updated = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const row of rows) {
    if (!row.scoring_rubric_jsonb || !Array.isArray(row.scoring_rubric_jsonb.categories)) {
      console.warn(`  [${row.key}] SKIP: no categories array`);
      skipped++;
      continue;
    }
    const scores = RUBRIC_SCORES[row.key];
    if (!scores) {
      missing.push(row.key);
      console.warn(`  [${row.key}] SKIP: no entry in RUBRIC_SCORES`);
      skipped++;
      continue;
    }

    const enriched = {
      categories: row.scoring_rubric_jsonb.categories.map((c) => {
        if (!(c.value in scores)) {
          throw new Error(`[${row.key}] category "${c.value}" has no score in RUBRIC_SCORES`);
        }
        return { value: c.value, description: c.description, score: scores[c.value] };
      }),
    };

    await sql`
      UPDATE field_definitions
      SET scoring_rubric_jsonb = ${sql.json(enriched)}
      WHERE key = ${row.key}
    `;

    const preview = enriched.categories.map((c) => `${c.value}=${c.score}`).join(', ');
    console.log(`  [${row.key}] updated — ${preview}`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
  if (missing.length > 0) {
    console.error(`\nFields with no score mapping: ${missing.join(', ')}`);
    process.exit(1);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
