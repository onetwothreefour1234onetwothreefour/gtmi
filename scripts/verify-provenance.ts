/**
 * Provenance verifier — read-only check that every field_values row for a
 * given country / program has a complete ProvenanceRecord JSONB matching the
 * shape defined in `packages/extraction/src/types/provenance.ts`.
 *
 * Exit codes:
 *   0 — all rows complete
 *   1 — at least one row is missing required keys (details printed)
 *   2 — invalid arguments / no rows found
 *
 * Usage:
 *   npx tsx scripts/verify-provenance.ts --country AUS
 *   npx tsx scripts/verify-provenance.ts --programId <uuid>
 *   npx tsx scripts/verify-provenance.ts --country AUS --status approved,pending_review
 */

import { db, fieldValues, fieldDefinitions, programs } from '@gtmi/db';
import { eq, inArray, and } from 'drizzle-orm';

// Keys present in every ProvenanceRecord regardless of status.
const REQUIRED_KEYS_ALWAYS = [
  'sourceUrl',
  'geographicLevel',
  'sourceTier',
  'scrapeTimestamp',
  'contentHash',
  'sourceSentence',
  'characterOffsets',
  'extractionModel',
  'extractionConfidence',
  'validationModel',
  'validationConfidence',
  'crossCheckResult',
  'methodologyVersion',
] as const;

// Keys required only when status='approved' — reviewer attribution.
const REQUIRED_KEYS_APPROVED = ['reviewedBy', 'reviewedAt', 'reviewDecision'] as const;

interface CliArgs {
  country?: string;
  programId?: string;
  statusFilter: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { statusFilter: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--country' && next) {
      out.country = next.toUpperCase();
      i++;
    } else if (a === '--programId' && next) {
      out.programId = next;
      i++;
    } else if (a === '--status' && next) {
      out.statusFilter = next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
    }
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkRow(fvId: string, fieldKey: string, status: string, provenance: unknown): string[] {
  const issues: string[] = [];

  if (!isObject(provenance)) {
    return [`provenance is not an object (got ${typeof provenance})`];
  }

  for (const key of REQUIRED_KEYS_ALWAYS) {
    if (!(key in provenance) || provenance[key] === undefined || provenance[key] === null) {
      issues.push(`missing required key: ${key}`);
    }
  }

  // Shape checks for fields that are easy to corrupt.
  const offsets = provenance['characterOffsets'];
  if (offsets !== undefined && offsets !== null) {
    if (
      !isObject(offsets) ||
      typeof offsets['start'] !== 'number' ||
      typeof offsets['end'] !== 'number'
    ) {
      issues.push('characterOffsets must be { start: number, end: number }');
    }
  }

  const tier = provenance['sourceTier'];
  if (tier !== undefined && tier !== null && typeof tier !== 'number') {
    issues.push(`sourceTier must be a number (got ${typeof tier})`);
  }

  if (status === 'approved') {
    for (const key of REQUIRED_KEYS_APPROVED) {
      if (!(key in provenance)) {
        issues.push(`approved row missing reviewer key: ${key}`);
      }
    }
  }

  // Suppress noise: if provenance is wholesale missing, the per-key warnings
  // are redundant. Caller still sees the headline message.
  return issues.map((i) => `[${fvId}] ${fieldKey} (${status}): ${i}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.country && !args.programId) {
    console.error(
      'Usage: verify-provenance.ts --country <ISO3> | --programId <uuid> [--status approved,pending_review]'
    );
    process.exit(2);
  }

  // Resolve programs in scope.
  const programRows = args.programId
    ? await db.select().from(programs).where(eq(programs.id, args.programId))
    : await db.select().from(programs).where(eq(programs.countryIso, args.country!));

  if (programRows.length === 0) {
    console.error(
      `No programs found for ${args.programId ? `programId=${args.programId}` : `country=${args.country}`}`
    );
    process.exit(2);
  }

  const programIds = programRows.map((p) => p.id);
  const programNameById = new Map(programRows.map((p) => [p.id, p.name]));

  // Pull field_values for those programs.
  const conditions = [inArray(fieldValues.programId, programIds)];
  if (args.statusFilter.length > 0) {
    conditions.push(inArray(fieldValues.status, args.statusFilter));
  }
  const rows = await db
    .select({
      id: fieldValues.id,
      programId: fieldValues.programId,
      fieldKey: fieldDefinitions.key,
      status: fieldValues.status,
      provenance: fieldValues.provenance,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));

  if (rows.length === 0) {
    const filter =
      args.statusFilter.length > 0 ? ` (status in ${args.statusFilter.join(',')})` : '';
    console.error(
      `No field_values rows found for ${programRows.length} program(s)${filter}. Did the canary run?`
    );
    process.exit(2);
  }

  // Aggregate counts per program.
  const issuesByProgram = new Map<string, string[]>();
  let totalIssues = 0;
  let totalChecked = 0;
  const statusCounts = new Map<string, number>();

  for (const row of rows) {
    totalChecked++;
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const rowIssues = checkRow(row.id, row.fieldKey, row.status, row.provenance);
    if (rowIssues.length > 0) {
      const list = issuesByProgram.get(row.programId) ?? [];
      list.push(...rowIssues);
      issuesByProgram.set(row.programId, list);
      totalIssues += rowIssues.length;
    }
  }

  // Report.
  console.log('='.repeat(70));
  console.log('Provenance verification');
  console.log('='.repeat(70));
  console.log(`Programs checked: ${programRows.length}`);
  console.log(`Field values checked: ${totalChecked}`);
  console.log('Status breakdown:');
  for (const [s, n] of statusCounts) console.log(`  ${s}: ${n}`);
  console.log();

  if (totalIssues === 0) {
    console.log(`✓ All ${totalChecked} rows have complete provenance.`);
    process.exit(0);
  }

  console.log(
    `✗ Found ${totalIssues} provenance issue(s) across ${issuesByProgram.size} program(s):\n`
  );
  for (const [programId, list] of issuesByProgram) {
    const name = programNameById.get(programId) ?? programId;
    console.log(`--- ${name} (${programId}) — ${list.length} issue(s)`);
    for (const issue of list.slice(0, 50)) console.log(`  ${issue}`);
    if (list.length > 50) console.log(`  ... and ${list.length - 50} more`);
    console.log();
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
