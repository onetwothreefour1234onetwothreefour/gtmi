/**
 * scripts/purge.ts
 *
 * Cohort cleanup runner. Replaces the per-target purge-*.ts scripts
 * (Phase 3.10 cleanup).
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx purge.ts <subcommand> [flags]
 *
 * Subcommands:
 *   orphan-pending    — delete pending_review field_values rows with
 *                       incomplete provenance (and their review_queue
 *                       siblings). Country- or program-scoped.
 *   bad-scrapes       — delete scrape_cache rows with HTTP 4xx, soft-404
 *                       text patterns, or visible-text length below the
 *                       threshold.
 *   empty-values      — Phase 3.6.1 / FIX 8 — delete empty / broken-
 *                       provenance field_values rows. Two modes:
 *                       --mode empty-value (default), --mode broken-provenance.
 *
 * Flags:
 *   --execute         — actually delete (default is dry-run).
 *   --country <ISO3>  — orphan-pending only.
 *   --programId <id>  — orphan-pending only.
 *   --mode <m>        — empty-values only: 'empty-value' | 'broken-provenance'.
 *
 * All subcommands default to dry-run. Pass --execute to apply.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';
import { db, fieldValues, reviewQueue, programs } from '@gtmi/db';
import { eq, inArray, and } from 'drizzle-orm';
import { checkProvenanceRow } from '@gtmi/shared';

dotenv.config({ path: join(__dirname, '../.env') });

type Subcommand = 'orphan-pending' | 'bad-scrapes' | 'empty-values';

const VALID_SUBCOMMANDS: ReadonlySet<Subcommand> = new Set([
  'orphan-pending',
  'bad-scrapes',
  'empty-values',
]);

interface CliArgs {
  sub: Subcommand;
  execute: boolean;
  country?: string;
  programId?: string;
  mode?: 'empty-value' | 'broken-provenance';
}

function parseArgs(argv: string[]): CliArgs {
  const sub = argv[0] as Subcommand | undefined;
  if (!sub || !VALID_SUBCOMMANDS.has(sub)) {
    console.error(
      `usage: purge.ts <subcommand> [flags]\n  subcommands: ${[...VALID_SUBCOMMANDS].join(', ')}`
    );
    process.exit(1);
  }
  const out: CliArgs = { sub, execute: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--execute') out.execute = true;
    else if (a === '--country' && next) {
      out.country = next.toUpperCase();
      i++;
    } else if (a === '--programId' && next) {
      out.programId = next;
      i++;
    } else if (a === '--mode' && next) {
      if (next !== 'empty-value' && next !== 'broken-provenance') {
        console.error(`unknown --mode "${next}"`);
        process.exit(1);
      }
      out.mode = next;
      i++;
    }
  }
  return out;
}

function getDirectUrl(): string {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  return url;
}

const REQUIRED_PROVENANCE_KEYS = [
  'sourceUrl',
  'geographicLevel',
  'sourceTier',
  'scrapeTimestamp',
  'contentHash',
  'crossCheckResult',
  'methodologyVersion',
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function purgeOrphanPending(args: CliArgs): Promise<void> {
  if (!args.country && !args.programId) {
    console.error('orphan-pending requires --country <ISO3> or --programId <uuid>');
    process.exit(2);
  }

  const programRows = args.programId
    ? await db.select().from(programs).where(eq(programs.id, args.programId))
    : await db.select().from(programs).where(eq(programs.countryIso, args.country!));

  if (programRows.length === 0) {
    console.error('No matching programs.');
    process.exit(2);
  }
  const programIds = programRows.map((p) => p.id);

  const pending = await db
    .select({
      id: fieldValues.id,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      provenance: fieldValues.provenance,
    })
    .from(fieldValues)
    .where(
      and(inArray(fieldValues.programId, programIds), eq(fieldValues.status, 'pending_review'))
    );

  const orphans = pending.filter((row) => {
    const prov = isObject(row.provenance) ? row.provenance : {};
    return REQUIRED_PROVENANCE_KEYS.some(
      (k) => !(k in prov) || prov[k] === undefined || prov[k] === null
    );
  });

  console.log(`Pending rows in scope: ${pending.length}`);
  console.log(`Orphans (incomplete provenance): ${orphans.length}`);
  for (const o of orphans) console.log(`  ${o.id}`);

  if (orphans.length === 0) {
    console.log('Nothing to purge.');
    return;
  }
  if (!args.execute) {
    console.log('\nDry run — no rows deleted. Pass --execute to apply.');
    return;
  }

  const orphanIds = orphans.map((o) => o.id);
  const deletedQueue = await db
    .delete(reviewQueue)
    .where(inArray(reviewQueue.fieldValueId, orphanIds))
    .returning({ id: reviewQueue.id });
  console.log(`Deleted review_queue rows: ${deletedQueue.length}`);

  const deletedFv = await db
    .delete(fieldValues)
    .where(inArray(fieldValues.id, orphanIds))
    .returning({ id: fieldValues.id });
  console.log(`Deleted field_values rows: ${deletedFv.length}`);
}

const SOFT_404_PATTERNS: RegExp[] = [
  /\b404\b.*\bnot found\b/i,
  /\bpage (not|cannot be) found\b/i,
  /\bcan't find (the )?page\b/i,
  /\bthis page (doesn't|does not) exist\b/i,
];
const MIN_VISIBLE_TEXT = 300;

function visibleTextLength(md: string): number {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*`_>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function checkContent(content: string, httpStatus: number): { reason: string } | null {
  if (httpStatus >= 400) return { reason: `http_${httpStatus}` };
  const snippet = content.slice(0, 2048);
  for (const p of SOFT_404_PATTERNS) {
    if (p.test(snippet)) return { reason: `soft_404` };
  }
  const vLen = visibleTextLength(content);
  if (vLen < MIN_VISIBLE_TEXT) return { reason: `short_content(visible=${vLen})` };
  return null;
}

async function purgeBadScrapes(args: CliArgs): Promise<void> {
  const sql = postgres(getDirectUrl(), { ssl: 'require', max: 1 });
  try {
    const rows = await sql<
      Array<{ url: string; content_markdown: string; http_status: number }>
    >`SELECT url, content_markdown, http_status FROM scrape_cache`;
    const toDelete: Array<{ url: string; reason: string }> = [];
    for (const r of rows) {
      const rejection = checkContent(r.content_markdown ?? '', r.http_status);
      if (rejection) toDelete.push({ url: r.url, reason: rejection.reason });
    }
    if (toDelete.length === 0) {
      console.log(`Checked ${rows.length} rows — all clean.`);
      return;
    }
    console.log(`Checked ${rows.length} rows — ${toDelete.length} flagged:\n`);
    for (const d of toDelete) console.log(`  ${d.url}\n    reason: ${d.reason}`);
    if (!args.execute) {
      console.log('\nDry run — pass --execute to delete these rows.');
      return;
    }
    const urls = toDelete.map((d) => d.url);
    await sql`DELETE FROM scrape_cache WHERE url = ANY(${urls})`;
    console.log(`\nDeleted ${toDelete.length} rows.`);
  } finally {
    await sql.end();
  }
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

async function purgeEmptyValues(args: CliArgs): Promise<void> {
  const mode = args.mode ?? 'empty-value';
  const sql = postgres(getDirectUrl(), {
    ssl: 'require',
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  });
  try {
    let candidates: CandidateRow[];
    if (mode === 'empty-value') {
      candidates = (await sql`
        SELECT fv.id, fv.program_id, p.name AS program_name, fd.key AS field_key,
               fv.status, fv.value_raw, fv.extracted_at, fv.provenance
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
        SELECT fv.id, fv.program_id, p.name AS program_name, fd.key AS field_key,
               fv.status, fv.value_raw, fv.extracted_at, fv.provenance
        FROM field_values fv
        JOIN programs p ON p.id = fv.program_id
        JOIN field_definitions fd ON fd.id = fv.field_definition_id
      `) as unknown as CandidateRow[];
      candidates = allRows.filter(
        (row) => checkProvenanceRow(row.provenance, row.status).length > 0
      );
    }
    console.log(`[purge:empty-values] mode=${mode}; found ${candidates.length} candidate row(s).`);
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
    if (!args.execute) {
      console.log('\n[DRY RUN] No rows deleted. Re-run with --execute to delete.');
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.sub) {
    case 'orphan-pending':
      await purgeOrphanPending(args);
      break;
    case 'bad-scrapes':
      await purgeBadScrapes(args);
      break;
    case 'empty-values':
      await purgeEmptyValues(args);
      break;
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
