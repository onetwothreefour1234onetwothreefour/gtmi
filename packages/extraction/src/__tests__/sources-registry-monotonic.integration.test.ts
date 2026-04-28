import { describe, expect, it, afterAll } from 'vitest';
import 'dotenv/config';
import { db, sources, programs } from '@gtmi/db';
import { and, eq, like } from 'drizzle-orm';
import { writeToSourcesTable } from '../stages/discover';
import type { DiscoveredUrl } from '../types/extraction';

// CI environments (GitHub Actions) do not have DATABASE_URL configured.
// The live-DB integration test must skip when no DB connection string
// is available so the suite still passes in CI. Local dev with a populated
// .env runs the test against staging as designed. The `db` client is
// lazily-initialised via a getter, so the bare `import` above is safe in
// CI — only actual DB access (inside the test bodies) throws when
// DATABASE_URL is unset.
const HAS_DB = !!process.env['DATABASE_URL'];
const describeIfDb = HAS_DB ? describe : describe.skip;

// Phase 3.6 / commit 7 — live-DB integration test for ADR-015
// self-improving sources table.
//
// Per analyst spec: must use a real database transaction against
// the staging DB (not a mock). Asserts that two consecutive Stage 0
// write-backs grow the registry monotonically — after run 2, sources
// rows for the test program are a superset of those after run 1.
//
// Cleanup: DELETE all test-marker URLs at the end so the test leaves
// no state behind in staging. afterAll guarantees cleanup even on
// assertion failure mid-test.

const TEST_URL_MARKER = 'phase-3-6-integration-test';

const TEST_URLS_RUN_1: DiscoveredUrl[] = [
  {
    url: `https://${TEST_URL_MARKER}.example/url-a`,
    tier: 1,
    geographicLevel: 'national',
    reason: 'integration test URL A',
    isOfficial: true,
  },
  {
    url: `https://${TEST_URL_MARKER}.example/url-b`,
    tier: 1,
    geographicLevel: 'national',
    reason: 'integration test URL B',
    isOfficial: true,
  },
];

// Run 2 keeps both URLs from run 1 plus adds a new one.
const TEST_URLS_RUN_2: DiscoveredUrl[] = [
  ...TEST_URLS_RUN_1,
  {
    url: `https://${TEST_URL_MARKER}.example/url-c`,
    tier: 2,
    geographicLevel: 'national',
    reason: 'integration test URL C (added in run 2)',
    isOfficial: false,
  },
];

let testProgramId: string;

async function findActiveAusProgram(): Promise<string | null> {
  const rows = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.countryIso, 'AUS'), eq(programs.status, 'active')))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function readTestSourcesForProgram(programId: string): Promise<string[]> {
  const rows = await db
    .select({ url: sources.url })
    .from(sources)
    .where(and(eq(sources.programId, programId), like(sources.url, `%${TEST_URL_MARKER}%`)));
  return rows.map((r) => r.url).sort();
}

describeIfDb(
  'ADR-015 — sources registry grows monotonically across consecutive runs (live DB)',
  () => {
    afterAll(async () => {
      // Cleanup: delete every test-marker row regardless of program.
      if (testProgramId) {
        await db
          .delete(sources)
          .where(
            and(eq(sources.programId, testProgramId), like(sources.url, `%${TEST_URL_MARKER}%`))
          );
      }
    });

    it('after two consecutive Stage 0 write-backs, run 2 sources are a superset of run 1', async () => {
      const programId = await findActiveAusProgram();
      expect(programId, 'staging DB must have at least one active AUS program').not.toBeNull();
      testProgramId = programId!;

      // Pre-clean any leftover test rows from a prior failed run.
      await db
        .delete(sources)
        .where(
          and(eq(sources.programId, testProgramId), like(sources.url, `%${TEST_URL_MARKER}%`))
        );

      // RUN 1 — write the first set of URLs.
      await writeToSourcesTable(testProgramId, TEST_URLS_RUN_1);
      const afterRun1 = await readTestSourcesForProgram(testProgramId);
      expect(afterRun1).toEqual(
        [
          `https://${TEST_URL_MARKER}.example/url-a`,
          `https://${TEST_URL_MARKER}.example/url-b`,
        ].sort()
      );

      // RUN 2 — write a superset of URLs.
      await writeToSourcesTable(testProgramId, TEST_URLS_RUN_2);
      const afterRun2 = await readTestSourcesForProgram(testProgramId);

      // Monotonic: every URL in run 1's snapshot must still be present.
      for (const url of afterRun1) {
        expect(afterRun2).toContain(url);
      }
      // The new URL added in run 2 must now be present.
      expect(afterRun2).toContain(`https://${TEST_URL_MARKER}.example/url-c`);
      // No duplicate rows: cardinality is exactly the union.
      expect(afterRun2.length).toBe(3);
    }, 30_000);

    it('write-back is idempotent: running the same input twice produces the same row count', async () => {
      const programId = await findActiveAusProgram();
      if (!programId) return;
      testProgramId = programId;

      // Use a sub-set of URLs distinct from the previous test (shared
      // testProgramId / shared marker, but fresh URLs).
      const idemUrls: DiscoveredUrl[] = [
        {
          url: `https://${TEST_URL_MARKER}.example/idempotent-x`,
          tier: 1,
          geographicLevel: 'national',
          reason: 'idempotent test',
          isOfficial: true,
        },
      ];

      await writeToSourcesTable(testProgramId, idemUrls);
      const afterFirst = await readTestSourcesForProgram(testProgramId);
      const beforeSecondCount = afterFirst.filter((u) => u.includes('idempotent-x')).length;
      expect(beforeSecondCount).toBe(1);

      await writeToSourcesTable(testProgramId, idemUrls);
      const afterSecond = await readTestSourcesForProgram(testProgramId);
      const afterSecondCount = afterSecond.filter((u) => u.includes('idempotent-x')).length;
      expect(afterSecondCount).toBe(1); // No duplicates.
    }, 30_000);
  }
);
