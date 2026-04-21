import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const EXPECTED_TABLES = [
  'scrape_cache',
  'discovery_cache',
  'extraction_cache',
  'validation_cache',
  'crosscheck_cache',
];

async function main() {
  console.log('CHECK 1: Verifying cache tables exist in DB\n');
  const rows = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = ANY(${EXPECTED_TABLES})
    ORDER BY tablename
  `;
  const found = new Set(rows.map((r) => r.tablename));
  let allPass = true;
  for (const t of EXPECTED_TABLES) {
    const ok = found.has(t);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} Table: ${t}`);
    if (!ok) allPass = false;
  }
  console.log(
    `\nResult: ${allPass ? 'ALL TABLES PRESENT' : 'MISSING TABLES — migration incomplete'}`
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
