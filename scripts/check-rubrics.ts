import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const SAMPLE = ['A.2.1', 'A.3.1', 'C.1.1', 'C.2.1', 'C.3.1', 'B.1.2'];

async function main() {
  const rows = await sql<
    { key: string; scoring_rubric_jsonb: unknown; extraction_prompt_md: string }[]
  >`
    SELECT key, scoring_rubric_jsonb, extraction_prompt_md
    FROM field_definitions
    WHERE key = ANY(${SAMPLE})
    ORDER BY key
  `;
  for (const r of rows) {
    console.log(`\n=== ${r.key} ===`);
    console.log(`Rubric keys:`, Object.keys(r.scoring_rubric_jsonb as Record<string, number>));
    console.log(`Prompt excerpt (last 400 chars):\n${r.extraction_prompt_md.slice(-400)}`);
  }
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
