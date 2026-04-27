/**
 * scripts/apply-migration.ts
 *
 * One-off migration applier. Reads a single SQL file from
 * supabase/migrations/, connects via DIRECT_URL (port 5432) to bypass the
 * Supabase transaction pooler that silently blocks DDL, executes the file
 * inside a single transaction, and prints success/failure.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx apply-migration.ts <filename>
 *
 *   filename may include or omit the .sql extension, e.g.
 *     apply-migration.ts 00006_add_programs_fts
 *     apply-migration.ts 00006_add_programs_fts.sql
 *
 * Why this exists: see docs/decisions/012-drizzle-kit-migration-mismatch.md.
 * drizzle-kit migrate's journal does not match the SQL files on disk, and the
 * project has no drizzle.__drizzle_migrations tracking table. Migrations have
 * historically been applied through ad-hoc means (Supabase SQL editor, the
 * older scripts/run-migration.ts which uses DATABASE_URL on port 6543 and
 * therefore hangs on DDL). This script formalises the apply step:
 *
 *   - DIRECT_URL preferred, DATABASE_URL fallback
 *   - SSL required (Supabase enforces it)
 *   - Single transaction wrap so a partial failure rolls back cleanly
 *   - Statement parsing identical to run-migration.ts (split on `;`,
 *     drop comment lines and `statement-breakpoint` markers) so existing
 *     migration files are byte-compatible
 *   - Single-file only — no journal, no "apply all" mode. Pick the file
 *     you want to apply, apply it, verify, commit.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import postgres from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

function parseStatements(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--') && !line.includes('statement-breakpoint'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: apply-migration.ts <filename>');
    console.error('  example: apply-migration.ts 00006_add_programs_fts');
    process.exit(1);
  }

  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  const port = url.match(/:(\d+)\/[^/]*$/)?.[1] ?? '?';
  if (port === '6543') {
    console.warn(
      'WARN: Connecting via the transaction pooler (port 6543). DDL ' +
        'statements may be silently blocked. Set DIRECT_URL to a 5432 ' +
        'connection to avoid this.'
    );
  }
  console.log(`Using port ${port} (${port === '5432' ? 'DIRECT_URL' : 'pooler'})`);

  const fileName = arg.endsWith('.sql') ? arg : `${arg}.sql`;
  const filePath = join(__dirname, '../supabase/migrations', fileName);
  const source = readFileSync(filePath, 'utf-8');
  const statements = parseStatements(source);

  console.log(`\nApplying: ${basename(filePath)} (${statements.length} statement(s))`);

  const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 15 });
  try {
    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
        await tx.unsafe(stmt);
        console.log(`  OK   ${preview}${stmt.length > 80 ? '…' : ''}`);
      }
    });
    console.log('\nMigration applied successfully (transaction committed).');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nMigration FAILED — transaction rolled back. ${msg}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
