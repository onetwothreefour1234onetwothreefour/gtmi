// Phase 3.6.1 / FIX 8 — purge empty / structurally-broken field_values
// rows. Country-agnostic; works across the entire cohort.
//
// Two modes:
//
//   --mode empty-value (default):
//     Finds field_values rows where (value_raw IS NULL OR value_raw = '')
//     AND status != 'approved' AND extracted_at < NOW() - INTERVAL '7 days'.
//     Reports per-program / per-field row count and oldest extracted_at.
//
//   --mode broken-provenance:
//     Uses checkProvenanceRow from @gtmi/shared to find rows whose
//     provenance JSONB fails ADR-007 validation, regardless of value_raw.
//     Catches pre-Phase-2-close-out orphan rows (e.g. C.2.3
//     id 27d64f65-...) where the row has a coverage-gap sentinel value
//     but the provenance shape is missing required keys.
//
// Both modes: dry-run by default. Pass --execute to delete.
//
// Usage:
//   pnpm exec tsx scripts/purge-empty-field-values.ts                                  (dry, empty-value)
//   pnpm exec tsx scripts/purge-empty-field-values.ts --mode broken-provenance         (dry)
//   pnpm exec tsx scripts/purge-empty-field-values.ts --mode broken-provenance --execute

import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';
import { checkProvenanceRow } from '@gtmi/shared';

dotenv.config({ path: join(__dirname, '../.env') });

type Mode = 'empty-value' | 'broken-provenance';

interface CliArgs {
  execute: boolean;
  mode: Mode;
}

function parseArgs(argv: string[]): CliArgs {
  const execute = argv.includes('--execute');
  const modeIdx = argv.indexOf('--mode');
  const modeArg = modeIdx !== -1 ? argv[modeIdx + 1] : 'empty-value';
  if (modeArg !== 'empty-value' && modeArg !== 'broken-provenance') {
    throw new Error(`Unknown --mode "${modeArg}". Allowed: empty-value | broken-provenance.`);
  }
  return { execute, mode: modeArg };
}

interface CandidateRow {
  id: string;
  program_id: string;
  program_name: string;
  field_key: string;
  status: string;
  value_raw: string | null;
  extracted_at: Date;
  provenance: unknown;
}

async function main(): Promise<void> {
  const { execute, mode } = parseArgs(process.argv.slice(2));

  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 15 });
  try {
    let candidates: CandidateRow[];
    if (mode === 'empty-value') {
      candidates = (await sql`
        SELECT
          fv.id,
          fv.program_id,
          p.name AS program_name,
          fd.key AS field_key,
          fv.status,
          fv.value_raw,
          fv.extracted_at,
          fv.provenance
        FROM field_values fv
        JOIN programs p ON p.id = fv.program_id
        JOIN field_definitions fd ON fd.id = fv.field_definition_id
        WHERE (fv.value_raw IS NULL OR fv.value_raw = '')
          AND fv.status != 'approved'
          AND fv.extracted_at < NOW() - INTERVAL '7 days'
        ORDER BY fv.extracted_at ASC
      `) as unknown as CandidateRow[];
    } else {
      const allRows = (await sql`
        SELECT
          fv.id,
          fv.program_id,
          p.name AS program_name,
          fd.key AS field_key,
          fv.status,
          fv.value_raw,
          fv.extracted_at,
          fv.provenance
        FROM field_values fv
        JOIN programs p ON p.id = fv.program_id
        JOIN field_definitions fd ON fd.id = fv.field_definition_id
      `) as unknown as CandidateRow[];
      candidates = allRows.filter((row) => {
        const issues = checkProvenanceRow(row.provenance, row.status);
        return issues.length > 0;
      });
    }

    console.log(
      `[purge-empty-field-values] mode=${mode}; found ${candidates.length} candidate row(s).`
    );

    // Group by program / field for the summary.
    const groups = new Map<
      string,
      { programName: string; fieldKey: string; count: number; oldest: Date; ids: string[] }
    >();
    for (const row of candidates) {
      const key = `${row.program_name} | ${row.field_key}`;
      const g = groups.get(key);
      if (g) {
        g.count++;
        if (row.extracted_at < g.oldest) g.oldest = row.extracted_at;
        g.ids.push(row.id);
      } else {
        groups.set(key, {
          programName: row.program_name,
          fieldKey: row.field_key,
          count: 1,
          oldest: row.extracted_at,
          ids: [row.id],
        });
      }
    }
    for (const [, g] of groups) {
      console.log(
        `  ${g.programName} | ${g.fieldKey} | rows=${g.count} | oldest=${g.oldest.toISOString().slice(0, 16)}`
      );
      if (mode === 'broken-provenance' && g.ids.length <= 5) {
        for (const id of g.ids) console.log(`    id=${id}`);
      }
    }

    if (!execute) {
      console.log('');
      console.log('[DRY RUN] No rows deleted. Re-run with --execute to delete.');
      return;
    }

    if (candidates.length === 0) {
      console.log('Nothing to delete.');
      return;
    }

    const ids = candidates.map((r) => r.id);
    const result = await sql`DELETE FROM field_values WHERE id = ANY(${ids}::uuid[])`;
    console.log(`[EXECUTED] Deleted ${result.count} row(s) from field_values.`);
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
