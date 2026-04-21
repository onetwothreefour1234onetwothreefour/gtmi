/**
 * Applies one or all pending SQL migration files directly to the database.
 *
 * Usage:
 *   tsx scripts/run-migration.ts                          # runs all files in supabase/migrations/
 *   tsx scripts/run-migration.ts 00004_extraction_caches  # runs that specific file
 *
 * Why this exists: drizzle-kit push crashes on Supabase's internal system
 * CHECK constraints (drizzle-kit bug, unresolved as of 0.31.10). drizzle-kit
 * generate still works — use that to create migration files, then apply them here.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations');

function getFiles(): string[] {
  const arg = process.argv[2];
  if (arg) {
    const name = arg.endsWith('.sql') ? arg : `${arg}.sql`;
    return [join(MIGRATIONS_DIR, name)];
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));
}

function parseStatements(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--') && !line.includes('statement-breakpoint'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runFile(filePath: string): Promise<void> {
  const fileName = basename(filePath);
  const source = readFileSync(filePath, 'utf-8');
  const statements = parseStatements(source);
  console.log(`\nRunning: ${fileName} (${statements.length} statements)`);

  for (const stmt of statements) {
    const preview = stmt.slice(0, 70).replace(/\n/g, ' ');
    try {
      await sql.unsafe(stmt);
      console.log(`  OK   ${preview}...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  SKIP ${preview}...`);
      } else {
        console.error(`  ERR  ${preview}...\n       ${msg}`);
        throw err;
      }
    }
  }
}

async function main() {
  const files = getFiles();
  console.log(`Applying ${files.length} migration file(s)...`);
  for (const f of files) {
    await runFile(f);
  }
  console.log('\nAll migrations complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
