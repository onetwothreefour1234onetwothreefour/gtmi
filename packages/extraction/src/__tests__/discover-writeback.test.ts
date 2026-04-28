import { describe, expect, it, vi, beforeEach } from 'vitest';

// Phase 3.6 / commit 7 — discover.ts write-back unit tests (db-mocked).
//
// Targets:
// 1. New URLs are inserted with discovered_by = 'stage-0-perplexity'.
// 2. Existing Tier 1 row is NOT downgraded to Tier 2 on conflict.
// 3. last_seen_at is bumped on conflict.
// 4. Idempotent: calling write-back twice for the same input does not
//    create duplicate inserts (relies on onConflictDoUpdate; the mock
//    asserts the insert path is invoked with onConflictDoUpdate every
//    time).
// 5. Cache-hit path also fires write-back.

interface MockSourceRow {
  programId: string;
  url: string;
  tier: number;
  sourceCategory: string;
  isPrimary: boolean;
  geographicLevel: string | null;
  discoveredBy: string;
  lastSeenAt: Date;
}

function makeDbMock(args: { programs: { id: string }[]; initialSources: MockSourceRow[] }) {
  const programs = [...args.programs];
  const sourcesRows = [...args.initialSources];

  const inserts: Array<{
    values: Partial<MockSourceRow>;
    onConflictSet: Partial<MockSourceRow>;
    target: string;
  }> = [];

  let lastSelectedFromTable: 'programs' | 'sources' = 'programs';
  // Track the URL the loop is currently processing. Set inside values().
  let urlOrderIdx = 0;
  // Tracks URLs in insertion order so that on the existing-row read for
  // URL N (which precedes its insert), the mock returns the matching row
  // from the in-memory store keyed by index.
  const orderedUrlsForRead: string[] = [];

  const chain = {
    select: (_cols?: unknown) => chain,
    from: (table: { _name?: string } | unknown) => {
      const name = (table as { _name?: string })._name;
      if (name === 'sources') lastSelectedFromTable = 'sources';
      else lastSelectedFromTable = 'programs';
      return chain;
    },
    where: () => chain,
    limit: async () => {
      if (lastSelectedFromTable === 'programs') {
        return programs.length > 0 ? [{ id: programs[0]!.id }] : [];
      }
      // sources existing-row check — peek the next URL the caller will
      // process (writeToSourcesTable iterates urls[] in order, doing
      // select-then-insert per URL, so urlOrderIdx tracks position).
      const targetUrl = orderedUrlsForRead[urlOrderIdx];
      const found = targetUrl ? sourcesRows.find((r) => r.url === targetUrl) : undefined;
      return found ? [{ tier: found.tier, sourceCategory: found.sourceCategory }] : [];
    },
    insert: (_table: unknown) => chain,
    values: (vals: Partial<MockSourceRow>) => {
      (chain as unknown as { _pending?: Partial<MockSourceRow> })._pending = vals;
      return chain;
    },
    onConflictDoUpdate: async (opts: { target: unknown[]; set: Partial<MockSourceRow> }) => {
      const pending = (chain as unknown as { _pending: Partial<MockSourceRow> })._pending;
      // Advance to the next URL position for the next existing-row read.
      urlOrderIdx++;
      const targetStr = JSON.stringify(opts.target);
      inserts.push({ values: pending, onConflictSet: opts.set, target: targetStr });
      // Apply to the in-memory store so subsequent reads see it.
      const idx = sourcesRows.findIndex(
        (r) => r.programId === pending.programId && r.url === pending.url
      );
      if (idx === -1) {
        sourcesRows.push({
          programId: pending.programId!,
          url: pending.url!,
          tier: pending.tier!,
          sourceCategory: pending.sourceCategory ?? 'unknown',
          isPrimary: pending.isPrimary ?? false,
          geographicLevel: pending.geographicLevel ?? null,
          discoveredBy: pending.discoveredBy ?? 'seed',
          lastSeenAt: pending.lastSeenAt ?? new Date(),
        });
      } else {
        Object.assign(sourcesRows[idx]!, opts.set);
      }
      return Promise.resolve();
    },
  };

  return {
    db: chain,
    inserts,
    sourcesRows,
    schema: {
      sources: { _name: 'sources', programId: 'programId', url: 'url' },
      programs: { _name: 'programs', id: 'id' },
      discoveryCache: { _name: 'discoveryCache', cacheKey: 'cacheKey' },
    },
    /** Test must call this before each writeToSourcesTable invocation,
     * passing the URLs in the order they'll be processed. */
    primeUrlOrder(urls: string[]) {
      orderedUrlsForRead.length = 0;
      orderedUrlsForRead.push(...urls);
      urlOrderIdx = 0;
    },
  };
}

describe('writeToSourcesTable — Phase 3.6 / ADR-015', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('inserts new URLs with discovered_by = "stage-0-perplexity"', async () => {
    const mock = makeDbMock({
      programs: [{ id: 'prog-1' }],
      initialSources: [],
    });

    vi.doMock('@gtmi/db', () => ({
      db: mock.db,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    const { writeToSourcesTable } = await import('../stages/discover.js');
    mock.primeUrlOrder(['https://gov.example/a']);
    await writeToSourcesTable('prog-1', [
      {
        url: 'https://gov.example/a',
        tier: 1,
        geographicLevel: 'national',
        reason: 'r',
        isOfficial: true,
      },
    ]);

    expect(mock.inserts.length).toBeGreaterThan(0);
    const inserted = mock.inserts[mock.inserts.length - 1]!;
    expect(inserted.values.discoveredBy).toBe('stage-0-perplexity');
    expect(inserted.values.programId).toBe('prog-1');
    expect(inserted.values.url).toBe('https://gov.example/a');
    expect(inserted.values.tier).toBe(1);
  });

  it('does NOT downgrade an existing Tier 1 row when fresh classifies it Tier 2', async () => {
    const existing: MockSourceRow = {
      programId: 'prog-1',
      url: 'https://gov.example/a',
      tier: 1, // existing tier
      sourceCategory: 'imm_authority',
      isPrimary: false,
      geographicLevel: 'national',
      discoveredBy: 'seed',
      lastSeenAt: new Date('2026-01-01'),
    };
    const mock = makeDbMock({
      programs: [{ id: 'prog-1' }],
      initialSources: [existing],
    });
    vi.doMock('@gtmi/db', () => ({
      db: mock.db,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    const { writeToSourcesTable } = await import('../stages/discover.js');
    mock.primeUrlOrder(['https://gov.example/a']);
    await writeToSourcesTable('prog-1', [
      {
        url: 'https://gov.example/a',
        tier: 2, // fresh re-classifies as Tier 2
        geographicLevel: 'national',
        reason: 'r',
        isOfficial: false,
      },
    ]);

    const inserted = mock.inserts[mock.inserts.length - 1]!;
    // Tier should be MIN(existing=1, fresh=2) = 1 (no downgrade).
    expect(inserted.values.tier).toBe(1);
    expect(inserted.onConflictSet.tier).toBe(1);
  });

  it('bumps last_seen_at on conflict (always sets the field)', async () => {
    const existing: MockSourceRow = {
      programId: 'prog-1',
      url: 'https://gov.example/a',
      tier: 1,
      sourceCategory: 'imm_authority',
      isPrimary: false,
      geographicLevel: 'national',
      discoveredBy: 'seed',
      lastSeenAt: new Date('2026-01-01'),
    };
    const mock = makeDbMock({
      programs: [{ id: 'prog-1' }],
      initialSources: [existing],
    });
    vi.doMock('@gtmi/db', () => ({
      db: mock.db,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    const before = Date.now();
    const { writeToSourcesTable } = await import('../stages/discover.js');
    mock.primeUrlOrder(['https://gov.example/a']);
    await writeToSourcesTable('prog-1', [
      {
        url: 'https://gov.example/a',
        tier: 1,
        geographicLevel: 'national',
        reason: 'r',
        isOfficial: true,
      },
    ]);

    const inserted = mock.inserts[mock.inserts.length - 1]!;
    const stamp = inserted.onConflictSet.lastSeenAt as Date | undefined;
    expect(stamp).toBeInstanceOf(Date);
    expect((stamp as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('is idempotent: two consecutive write-backs produce the same row count', async () => {
    const mock = makeDbMock({
      programs: [{ id: 'prog-1' }],
      initialSources: [],
    });
    vi.doMock('@gtmi/db', () => ({
      db: mock.db,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    const { writeToSourcesTable } = await import('../stages/discover.js');
    const urls = [
      {
        url: 'https://gov.example/a',
        tier: 1 as const,
        geographicLevel: 'national' as const,
        reason: 'r',
        isOfficial: true,
      },
      {
        url: 'https://gov.example/b',
        tier: 1 as const,
        geographicLevel: 'national' as const,
        reason: 'r',
        isOfficial: true,
      },
    ];
    mock.primeUrlOrder(urls.map((u) => u.url));
    await writeToSourcesTable('prog-1', urls);
    const afterFirstRun = mock.sourcesRows.length;
    mock.primeUrlOrder(urls.map((u) => u.url));
    await writeToSourcesTable('prog-1', urls);
    const afterSecondRun = mock.sourcesRows.length;

    // Two URLs after run 1; same two URLs after run 2 (no duplicates).
    expect(afterFirstRun).toBe(2);
    expect(afterSecondRun).toBe(2);
  });

  it('skips silently when programId does not exist (FK guard)', async () => {
    const mock = makeDbMock({
      programs: [], // no programs
      initialSources: [],
    });
    vi.doMock('@gtmi/db', () => ({
      db: mock.db,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    const { writeToSourcesTable } = await import('../stages/discover.js');
    await writeToSourcesTable('nonexistent-prog', [
      {
        url: 'https://gov.example/a',
        tier: 1,
        geographicLevel: 'national',
        reason: 'r',
        isOfficial: true,
      },
    ]);

    expect(mock.inserts).toHaveLength(0);
  });
});

describe('Discover stage cache-hit path also writes back to sources (ADR-015)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('on cache hit, writeToSourcesTable is invoked (registry stays warm)', async () => {
    // Smoking-gun test: spy on writeToSourcesTable via re-export and assert
    // it gets called when readDiscoveryCache returns a cached entry. Since
    // the function is exported, we can mock the discover module's deps to
    // force a cache hit and observe the side effect through the same mock
    // db chain.
    const mock = makeDbMock({
      programs: [{ id: 'prog-cache' }],
      initialSources: [],
    });

    // Override: discoveryCache select returns a cached entry on the first
    // limit() call where the table is discoveryCache.
    let cacheReadCount = 0;
    const fakeChain = {
      select: () => fakeChain,
      from: (table: { _name?: string }) => {
        if (table._name === 'discoveryCache') {
          (fakeChain as unknown as { _mode: string })._mode = 'discoveryCache';
        } else if (table._name === 'programs') {
          (fakeChain as unknown as { _mode: string })._mode = 'programs';
        } else if (table._name === 'sources') {
          (fakeChain as unknown as { _mode: string })._mode = 'sources';
        }
        return fakeChain;
      },
      where: () => fakeChain,
      limit: async () => {
        const m = (fakeChain as unknown as { _mode?: string })._mode;
        if (m === 'discoveryCache') {
          cacheReadCount++;
          return [
            {
              discoveredUrls: [
                {
                  url: 'https://gov.example/cached',
                  tier: 1,
                  geographicLevel: 'national',
                  reason: 'r',
                  isOfficial: true,
                },
              ],
            },
          ];
        }
        if (m === 'programs') return [{ id: 'prog-cache' }];
        if (m === 'sources') return [];
        return [];
      },
      insert: () => fakeChain,
      values: (vals: Partial<MockSourceRow>) => {
        (fakeChain as unknown as { _pending?: Partial<MockSourceRow> })._pending = vals;
        return fakeChain;
      },
      onConflictDoUpdate: async () => {
        const v = (fakeChain as unknown as { _pending: Partial<MockSourceRow> })._pending;
        mock.inserts.push({
          values: v,
          onConflictSet: {},
          target: 'sources_program_id_url',
        });
        return Promise.resolve();
      },
    };

    vi.doMock('@gtmi/db', () => ({
      db: fakeChain,
      sources: mock.schema.sources,
      programs: mock.schema.programs,
      discoveryCache: mock.schema.discoveryCache,
    }));

    // Stub Perplexity env so the discover module loads.
    process.env['PERPLEXITY_API_KEY'] = 'test-key';
    // verifyUrls makes a HEAD request — stub global fetch to succeed.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;

    try {
      const { DiscoverStageImpl } = await import('../stages/discover.js');
      const stage = new DiscoverStageImpl();
      await stage.execute('prog-cache', 'Cached Program', 'AUS');

      // Cache was read.
      expect(cacheReadCount).toBeGreaterThan(0);
      // Write-back fired exactly once for the cached URL.
      expect(mock.inserts.length).toBe(1);
      expect(mock.inserts[0]!.values.url).toBe('https://gov.example/cached');
      expect(mock.inserts[0]!.values.discoveredBy).toBe('stage-0-perplexity');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
