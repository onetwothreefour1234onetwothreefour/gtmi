import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';

dotenv.config({ path: join(__dirname, '../.env') });

async function main(): Promise<void> {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  const port = url.match(/:(\d+)\/[^/]*$/)?.[1] ?? '?';
  console.log(`Using port ${port} (${port === '5432' ? 'DIRECT_URL' : 'pooler'})`);

  const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 15 });
  try {
    const result = await sql`
      DELETE FROM discovery_cache
      WHERE program_id IN (
        SELECT id FROM programs WHERE country_iso = 'AUS'
      )
    `;
    console.log(`Deleted ${result.count} rows from discovery_cache for AUS`);
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
