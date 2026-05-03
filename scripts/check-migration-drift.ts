/**
 * scripts/check-migration-drift.ts
 *
 * Phase 3.10d / K.4 — drift detector for the migrations_applied
 * journal (introduced in migration 00022 / Phase 3.10d.A.1).
 *
 * For every row in migrations_applied:
 *   1. Read the corresponding SQL file from supabase/migrations/.
 *   2. Compute its SHA-256 today.
 *   3. Compare against the row's checksum_sha256.
 *
 * Reports four classes of finding:
 *   - DRIFT     — file exists but checksum changed (someone edited a
 *                 committed migration in place — usually a mistake).
 *   - MISSING   — journal row references a file that's gone from disk.
 *   - UNAPPLIED — file exists on disk but the journal has no row for it
 *                 (typical for migrations that haven't run on this DB
 *                 yet — informational, not a hard failure).
 *   - NULL      — journal row has no checksum (backfilled rows from
 *                 00022 / migrations applied before 00022 landed).
 *                 Not a drift signal because we never had a baseline.
 *
 * Exit codes:
 *   0  — all good (no DRIFT, no MISSING)
 *   1  — DRIFT or MISSING detected
 *   2  — invocation error
 *
 * Usage:
 *   pnpm exec tsx scripts/check-migration-drift.ts [--verbose]
 *
 * The intent is to run this on a nightly cron once auth/IAP lands
 * (per ADR-027) — for now it's a manual on-demand check.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations');

interface JournalRow {
  filename: string;
  applied_at: Date;
  applied_by: string | null;
  checksum_sha256: string | null;
}

interface DriftFinding {
  filename: string;
  kind: 'DRIFT' | 'MISSING' | 'UNAPPLIED' | 'NULL' | 'OK';
  recordedChecksum: string | null;
  actualChecksum: string | null;
  appliedAt?: Date;
  appliedBy?: string | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function listOnDiskMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function tryReadFile(filename: string): string | null {
  try {
    return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
  } catch {
    return null;
  }
}

async function loadJournal(connectionUrl: string): Promise<JournalRow[]> {
  const sql = postgres(connectionUrl, {
    ssl: 'require',
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  });
  try {
    const rows = await sql<JournalRow[]>`
      SELECT filename, applied_at, applied_by, checksum_sha256
      FROM migrations_applied
      ORDER BY filename
    `;
    return rows;
  } finally {
    await sql.end();
  }
}

function classify(
  journalRow: JournalRow | null,
  onDiskSource: string | null
): Omit<DriftFinding, 'filename'> {
  if (journalRow && onDiskSource === null) {
    return {
      kind: 'MISSING',
      recordedChecksum: journalRow.checksum_sha256,
      actualChecksum: null,
      appliedAt: journalRow.applied_at,
      appliedBy: journalRow.applied_by,
    };
  }
  if (!journalRow && onDiskSource !== null) {
    return {
      kind: 'UNAPPLIED',
      recordedChecksum: null,
      actualChecksum: sha256(onDiskSource),
    };
  }
  if (journalRow && onDiskSource !== null) {
    if (journalRow.checksum_sha256 === null) {
      return {
        kind: 'NULL',
        recordedChecksum: null,
        actualChecksum: sha256(onDiskSource),
        appliedAt: journalRow.applied_at,
        appliedBy: journalRow.applied_by,
      };
    }
    const actual = sha256(onDiskSource);
    if (actual !== journalRow.checksum_sha256) {
      return {
        kind: 'DRIFT',
        recordedChecksum: journalRow.checksum_sha256,
        actualChecksum: actual,
        appliedAt: journalRow.applied_at,
        appliedBy: journalRow.applied_by,
      };
    }
    return {
      kind: 'OK',
      recordedChecksum: journalRow.checksum_sha256,
      actualChecksum: actual,
      appliedAt: journalRow.applied_at,
      appliedBy: journalRow.applied_by,
    };
  }
  // Both null — shouldn't happen because we only reach here for filenames
  // present in at least one source. Defensive fallback.
  return { kind: 'OK', recordedChecksum: null, actualChecksum: null };
}

async function main(): Promise<void> {
  const verbose = process.argv.includes('--verbose');

  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(2);
  }

  const journalRows = await loadJournal(url);
  const journalByName = new Map(journalRows.map((r) => [r.filename, r]));
  const onDisk = new Set(listOnDiskMigrations());

  const allFilenames = new Set<string>([...journalByName.keys(), ...onDisk]);

  const findings: DriftFinding[] = [];
  for (const filename of [...allFilenames].sort()) {
    const journalRow = journalByName.get(filename) ?? null;
    const onDiskSource = onDisk.has(filename) ? tryReadFile(filename) : null;
    const partial = classify(journalRow, onDiskSource);
    findings.push({ filename, ...partial });
  }

  const buckets: Record<DriftFinding['kind'], DriftFinding[]> = {
    DRIFT: [],
    MISSING: [],
    UNAPPLIED: [],
    NULL: [],
    OK: [],
  };
  for (const f of findings) buckets[f.kind].push(f);

  console.log('Migration drift report');
  console.log('────────────────────────────────────────');
  console.log(`Journal rows : ${journalRows.length}`);
  console.log(`On-disk files: ${onDisk.size}`);
  console.log('');
  console.log(`OK         : ${buckets.OK.length}`);
  console.log(`NULL       : ${buckets.NULL.length}  (backfilled rows, no baseline)`);
  console.log(`UNAPPLIED  : ${buckets.UNAPPLIED.length}  (informational)`);
  console.log(`MISSING    : ${buckets.MISSING.length}  (journal row, file gone)`);
  console.log(`DRIFT      : ${buckets.DRIFT.length}  (file edited after apply)`);
  console.log('');

  for (const kind of ['DRIFT', 'MISSING', 'UNAPPLIED', 'NULL'] as const) {
    if (buckets[kind].length === 0) continue;
    console.log(`── ${kind} ──`);
    for (const f of buckets[kind]) {
      const summary =
        kind === 'DRIFT'
          ? `recorded=${f.recordedChecksum?.slice(0, 12)}… actual=${f.actualChecksum?.slice(0, 12)}…`
          : kind === 'MISSING'
            ? `applied_at=${f.appliedAt?.toISOString().slice(0, 19)} by=${f.appliedBy ?? '(unknown)'}`
            : kind === 'NULL'
              ? `applied_at=${f.appliedAt?.toISOString().slice(0, 19)} by=${f.appliedBy ?? '(unknown)'}`
              : `actual=${f.actualChecksum?.slice(0, 12)}…`;
      console.log(`  ${f.filename}  ${summary}`);
    }
    console.log('');
  }

  if (verbose && buckets.OK.length > 0) {
    console.log('── OK ──');
    for (const f of buckets.OK) {
      console.log(`  ${f.filename}  ${f.recordedChecksum?.slice(0, 12)}…`);
    }
    console.log('');
  }

  const hardFailures = buckets.DRIFT.length + buckets.MISSING.length;
  if (hardFailures > 0) {
    console.error(`Drift check FAILED: ${hardFailures} finding(s) require attention.`);
    process.exit(1);
  }
  console.log('Drift check passed.');
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(2);
});
