/**
 * scripts/check.ts
 *
 * Read-only diagnostic runner. Replaces the old per-target
 * scripts/check-*.ts files (Phase 3.10 cleanup).
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx check.ts <subcommand>
 *
 * Subcommands:
 *   fts                — verify migration 00006 (programs full-text search)
 *   programs-cols      — list every column on programs
 *   programs-by-state  — sample one programme per scored / placeholder / unscored state
 *   drizzle-state      — inspect drizzle migration tracking state (per ADR-012)
 *   scored             — print PAQ / CME / composite + coverage table for every scored programme
 *   rubrics            — print scoring_rubric_jsonb keys + last 400 chars of prompt for a sample of categorical fields
 *   field-types        — list normalization_fn / data_type for the Wave 1 + Wave 2 field set, bucketed
 *   tables             — verify the five cache tables exist (scrape_cache, discovery_cache, extraction_cache, validation_cache, crosscheck_cache)
 *   prompts-stale      — list field × programme rows where the active prompt was edited after the last extraction (Phase 3.10b.6)
 *
 * Connects via DIRECT_URL when present, falls back to DATABASE_URL.
 * Read-only — no script writes to the database.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres, { type Sql } from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

type Subcommand =
  | 'fts'
  | 'programs-cols'
  | 'programs-by-state'
  | 'drizzle-state'
  | 'scored'
  | 'rubrics'
  | 'field-types'
  | 'tables'
  | 'prompts-stale';

const VALID_SUBCOMMANDS: ReadonlySet<Subcommand> = new Set([
  'fts',
  'programs-cols',
  'programs-by-state',
  'drizzle-state',
  'scored',
  'rubrics',
  'field-types',
  'tables',
  'prompts-stale',
]);

function getConnection(): { url: string; ssl: boolean } {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  const port = url.match(/:(\d+)\/[^/]*$/)?.[1] ?? '?';
  console.log(`Using port ${port} (${port === '5432' ? 'DIRECT_URL' : 'pooler'})`);
  return { url, ssl: port !== '5432' || url.includes('supabase.com') };
}

async function checkFts(sql: Sql): Promise<void> {
  const cols = await sql<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'search_tsv'
  `;
  console.log('search_tsv column:', JSON.stringify(cols));
  const idx = await sql<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'programs' AND indexname = 'idx_programs_search_tsv'
  `;
  console.log('idx_programs_search_tsv:', JSON.stringify(idx));
  const counts = await sql<{ total: number; populated: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE search_tsv IS NOT NULL)::int AS populated
    FROM programs
  `;
  console.log('programs row count / search_tsv populated:', JSON.stringify(counts));
}

async function checkProgramsCols(sql: Sql): Promise<void> {
  const cols = await sql<{ column_name: string; data_type: string; is_nullable: string }[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'programs'
    ORDER BY ordinal_position
  `;
  console.log('programs columns:');
  for (const c of cols) {
    console.log(
      `  ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
    );
  }
}

async function checkProgramsByState(sql: Sql): Promise<void> {
  const scored = await sql<{ id: string; name: string; country_iso: string; phase2: boolean }[]>`
    SELECT
      p.id,
      p.name,
      p.country_iso,
      (s.metadata ->> 'phase2Placeholder')::boolean AS phase2
    FROM programs p
    INNER JOIN scores s ON s.program_id = p.id
    ORDER BY s.scored_at DESC
    LIMIT 5
  `;
  console.log('Scored programs (latest 5):');
  for (const r of scored) {
    console.log(
      `  ${r.id}  ${r.country_iso}  ${r.phase2 ? '[PLACEHOLDER]' : '[CALIBRATED]'}  ${r.name}`
    );
  }

  const unscored = await sql<{ id: string; name: string; country_iso: string }[]>`
    SELECT p.id, p.name, p.country_iso
    FROM programs p
    LEFT JOIN scores s ON s.program_id = p.id
    WHERE s.id IS NULL
    ORDER BY p.country_iso, p.name
    LIMIT 5
  `;
  console.log('\nUnscored programs (first 5):');
  for (const r of unscored) {
    console.log(`  ${r.id}  ${r.country_iso}  ${r.name}`);
  }
}

async function checkDrizzleState(sql: Sql): Promise<void> {
  const tables = await sql<{ table_schema: string; table_name: string }[]>`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name LIKE '%migration%'
    ORDER BY table_schema, table_name
  `;
  console.log('migration tables:', JSON.stringify(tables, null, 2));

  try {
    const entries = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
    console.log('drizzle.__drizzle_migrations:');
    console.log(JSON.stringify(entries, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('drizzle.__drizzle_migrations: ERR —', msg);
  }
}

async function checkScored(sql: Sql): Promise<void> {
  const rows = await sql<
    {
      country_iso: string;
      name: string;
      composite: string | null;
      paq: string | null;
      cme: string | null;
      phase2: boolean | null;
      approved: number;
      pending: number;
      populated: number;
    }[]
  >`
    SELECT
      p.country_iso,
      p.name,
      s.composite_score AS composite,
      s.paq_score       AS paq,
      s.cme_score       AS cme,
      (s.metadata ->> 'phase2Placeholder')::boolean AS phase2,
      COUNT(*) FILTER (WHERE fv.status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE fv.status = 'pending_review')::int AS pending,
      COUNT(*) FILTER (WHERE fv.value_raw IS NOT NULL AND fv.value_raw <> '')::int AS populated
    FROM programs p
    INNER JOIN scores s ON s.program_id = p.id
    LEFT JOIN field_values fv ON fv.program_id = p.id
    GROUP BY p.id, p.country_iso, p.name, s.composite_score, s.paq_score, s.cme_score, s.metadata
    ORDER BY s.composite_score DESC NULLS LAST
  `;
  console.log(
    '| Program | Coverage | Auto-approved | Queued | PAQ | CME | Composite | Placeholder |'
  );
  console.log(
    '| ------- | -------- | ------------- | ------ | --- | --- | --------- | ----------- |'
  );
  for (const r of rows) {
    const cov = `${r.populated}/48 (${((r.populated / 48) * 100).toFixed(1)}%)`;
    console.log(
      `| ${r.country_iso} ${r.name} | ${cov} | ${r.approved} | ${r.pending} | ${r.paq ? Number(r.paq).toFixed(2) : '—'} | ${r.cme ? Number(r.cme).toFixed(2) : '—'} | ${r.composite ? Number(r.composite).toFixed(2) : '—'} | ${r.phase2 ? '✓' : '·'} |`
    );
  }
}

async function checkRubrics(sql: Sql): Promise<void> {
  const SAMPLE = ['A.2.1', 'A.3.1', 'C.1.1', 'C.2.1', 'C.3.1', 'B.4.1'];
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
    const rubric = r.scoring_rubric_jsonb as Record<string, unknown> | null;
    console.log(`Rubric keys:`, rubric ? Object.keys(rubric) : '(null)');
    console.log(`Prompt excerpt (last 400 chars):\n${r.extraction_prompt_md.slice(-400)}`);
  }
}

async function checkFieldTypes(sql: Sql): Promise<void> {
  const rows = await sql<
    { key: string; normalization_fn: string; data_type: string; label: string }[]
  >`
    SELECT key, normalization_fn, data_type, label
    FROM field_definitions
    ORDER BY key
  `;
  console.log('Field types:\n');
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
}

/**
 * Phase 3.10b.6 — list field × programme rows where the active prompt
 * (extraction_prompts.created_at via field_definitions.current_prompt_id)
 * is newer than the row's last extracted_at. Pairs with
 * `--mode rubric-changed` for the actual re-extract.
 */
async function checkPromptsStale(sql: Sql): Promise<void> {
  type Row = {
    field_key: string;
    field_definition_id: string;
    stale_count: number;
    sample_program_id: string;
    sample_program_name: string;
  };
  const rows = await sql<Row[]>`
    SELECT
      fd.key AS field_key,
      fd.id AS field_definition_id,
      COUNT(*)::int AS stale_count,
      MIN(p.id::text) AS sample_program_id,
      MIN(p.name) AS sample_program_name
    FROM field_definitions fd
    JOIN extraction_prompts ep ON ep.id = fd.current_prompt_id
    JOIN field_values fv ON fv.field_definition_id = fd.id
    JOIN programs p ON p.id = fv.program_id
    WHERE fv.extracted_at IS NOT NULL
      AND ep.created_at > fv.extracted_at
    GROUP BY fd.key, fd.id
    ORDER BY stale_count DESC
  `;
  if (rows.length === 0) {
    console.log(
      'No prompts-stale rows. Every published value was extracted under the current prompt.'
    );
    return;
  }
  let totalStale = 0;
  console.log(`Field key       | Stale rows | Sample programme`);
  console.log(`----------------|------------|-----------------------`);
  for (const r of rows) {
    totalStale += r.stale_count;
    console.log(
      `  ${r.field_key.padEnd(13)} | ${String(r.stale_count).padStart(10)} | ${r.sample_program_name.slice(0, 40)}`
    );
  }
  console.log(`\nTotal stale rows: ${totalStale} across ${rows.length} field(s).`);
  console.log(
    `Re-extract via: pnpm tsx scripts/canary-run.ts --country <ISO3> --programId <uuid> --mode rubric-changed`
  );
}

async function checkTables(sql: Sql): Promise<void> {
  const EXPECTED_TABLES = [
    'scrape_cache',
    'discovery_cache',
    'extraction_cache',
    'validation_cache',
    'crosscheck_cache',
  ];
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
}

async function main(): Promise<void> {
  const sub = process.argv[2];
  if (!sub || !VALID_SUBCOMMANDS.has(sub as Subcommand)) {
    console.error(
      `usage: check.ts <subcommand>\n  subcommands: ${[...VALID_SUBCOMMANDS].join(', ')}`
    );
    process.exit(1);
  }
  const { url, ssl } = getConnection();
  const sql = postgres(url, {
    ssl: ssl ? 'require' : false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
  try {
    switch (sub as Subcommand) {
      case 'fts':
        await checkFts(sql);
        break;
      case 'programs-cols':
        await checkProgramsCols(sql);
        break;
      case 'programs-by-state':
        await checkProgramsByState(sql);
        break;
      case 'drizzle-state':
        await checkDrizzleState(sql);
        break;
      case 'scored':
        await checkScored(sql);
        break;
      case 'rubrics':
        await checkRubrics(sql);
        break;
      case 'field-types':
        await checkFieldTypes(sql);
        break;
      case 'tables':
        await checkTables(sql);
        break;
      case 'prompts-stale':
        await checkPromptsStale(sql);
        break;
    }
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('ERROR:', msg);
  process.exit(1);
});
