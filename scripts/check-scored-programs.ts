/**
 * scripts/check-scored-programs.ts
 *
 * Diagnostic: print PAQ / CME / Composite + coverage + auto-approve count
 * for every scored program. Used to populate the Phase 2 retrospective
 * table and to confirm the cohort each scoring run produced.
 */
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
  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
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
  } finally {
    await sql.end();
  }
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('ERROR:', msg);
  process.exit(1);
});
