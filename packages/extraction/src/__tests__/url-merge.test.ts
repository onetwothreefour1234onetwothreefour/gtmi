import { describe, expect, it } from 'vitest';
import { mergeDiscoveredUrls, normaliseUrl, DEFAULT_URL_CAP } from '../utils/url-merge';
import type { DiscoveredUrl } from '../types/extraction';

// Phase 3.6 / ADR-015 — URL merge utility tests.

function du(
  url: string,
  tier: 1 | 2 | 3,
  geographicLevel: 'global' | 'continental' | 'national' | 'regional' = 'national',
  reason = 'test'
): DiscoveredUrl {
  return { url, tier, geographicLevel, reason, isOfficial: tier === 1 };
}

describe('normaliseUrl', () => {
  it('strips trailing slash from non-root paths', () => {
    expect(normaliseUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('preserves root slash on bare hostname', () => {
    expect(normaliseUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases scheme and host', () => {
    expect(normaliseUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('strips utm_* tracking parameters', () => {
    expect(normaliseUrl('https://example.com/p?utm_source=x&utm_campaign=y&keep=z')).toBe(
      'https://example.com/p?keep=z'
    );
  });

  it('strips gclid / fbclid / mc_cid', () => {
    expect(normaliseUrl('https://example.com/p?gclid=abc&keep=1')).toBe(
      'https://example.com/p?keep=1'
    );
    expect(normaliseUrl('https://example.com/p?fbclid=abc')).toBe('https://example.com/p');
  });

  it('returns raw input on parse failure', () => {
    expect(normaliseUrl('not a url')).toBe('not a url');
  });
});

describe('mergeDiscoveredUrls', () => {
  it('returns [] for empty inputs', () => {
    expect(mergeDiscoveredUrls({ freshFromStage0: [], fromSourcesTable: [] })).toEqual([]);
  });

  it('returns registry up to cap when fresh is empty', () => {
    const registry = [du('https://gov.example/a', 1), du('https://gov.example/b', 1)];
    const result = mergeDiscoveredUrls({
      freshFromStage0: [],
      fromSourcesTable: registry,
    });
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.url)).toEqual(['https://gov.example/a', 'https://gov.example/b']);
  });

  it('returns fresh up to cap when registry is empty', () => {
    const fresh = [du('https://gov.example/a', 1), du('https://gov.example/b', 1)];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
    });
    expect(result).toHaveLength(2);
  });

  it('deduplicates the same URL appearing in both sets', () => {
    const fresh = [du('https://gov.example/a', 1, 'national', 'fresh')];
    const registry = [du('https://gov.example/a', 1, 'national', 'registry')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
    });
    expect(result).toHaveLength(1);
    // Fresh wins on conflict — newer reason text.
    expect(result[0]!.reason).toBe('fresh');
  });

  it('deduplicates by normalised URL (trailing slash and scheme case)', () => {
    const fresh = [du('https://gov.example/a/', 1)];
    const registry = [du('HTTPS://gov.example/a', 1)];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
    });
    expect(result).toHaveLength(1);
  });

  it('orders Tier 1 before Tier 2 before Tier 3', () => {
    const fresh = [du('https://news.example/c', 3), du('https://lawfirm.example/b', 2)];
    const registry = [du('https://gov.example/a', 1)];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
    });
    expect(result.map((u) => u.tier)).toEqual([1, 2, 3]);
  });

  it('within same tier, registry entries appear before fresh entries', () => {
    const fresh = [du('https://gov.example/fresh', 1, 'national', 'fresh')];
    const registry = [du('https://gov.example/registry', 1, 'national', 'registry')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
    });
    expect(result.map((u) => u.url)).toEqual([
      'https://gov.example/registry',
      'https://gov.example/fresh',
    ]);
  });

  it('respects the per-tier quotas (9 / 5 / 1) within the default cap', () => {
    // Phase 3.6.1 — quotas raised from 7/4/1 → 9/5/1, default cap 12 → 15
    // to accommodate the two new department types in discover.ts (PR
    // pathway authority + citizenship authority).
    // Construct 12 Tier 1, 7 Tier 2, 3 Tier 3 entries → 22 total.
    const fresh: DiscoveredUrl[] = [];
    for (let i = 0; i < 12; i++) fresh.push(du(`https://gov.example/${i}`, 1));
    for (let i = 0; i < 7; i++) fresh.push(du(`https://lawfirm.example/${i}`, 2));
    for (let i = 0; i < 3; i++) fresh.push(du(`https://news.example/${i}`, 3));
    const result = mergeDiscoveredUrls({ freshFromStage0: fresh, fromSourcesTable: [] });
    const tierCounts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    for (const u of result) tierCounts[u.tier as 1 | 2 | 3]++;
    expect(result.length).toBeLessThanOrEqual(DEFAULT_URL_CAP);
    expect(tierCounts[1]).toBeLessThanOrEqual(9);
    expect(tierCounts[2]).toBeLessThanOrEqual(5);
    expect(tierCounts[3]).toBeLessThanOrEqual(1);
  });

  it('result never exceeds the cap (custom cap = 5)', () => {
    const fresh: DiscoveredUrl[] = [];
    for (let i = 0; i < 20; i++) fresh.push(du(`https://gov.example/${i}`, 1));
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 5,
    });
    expect(result).toHaveLength(5);
  });

  it('falls through tier quotas when one tier is short (Tier 1 underfill backfilled by Tier 2)', () => {
    // 3 Tier 1, 11 Tier 2, 1 Tier 3 → 15 total. Quotas 9/5/1 give 3/5/1=9;
    // fall-through fills remaining 6 from leftover Tier 2 (cap 15).
    const fresh: DiscoveredUrl[] = [
      du('https://gov.example/a', 1),
      du('https://gov.example/b', 1),
      du('https://gov.example/c', 1),
      ...Array.from({ length: 11 }, (_, i) => du(`https://lawfirm.example/${i}`, 2)),
      du('https://news.example/0', 3),
    ];
    const result = mergeDiscoveredUrls({ freshFromStage0: fresh, fromSourcesTable: [] });
    // Cap 15 — should fill with all 3 Tier 1, all 11 Tier 2 (5 from quota + 6 fallthrough), 1 Tier 3.
    expect(result).toHaveLength(15);
    const tierCounts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    for (const u of result) tierCounts[u.tier as 1 | 2 | 3]++;
    expect(tierCounts[1]).toBe(3);
    expect(tierCounts[2]).toBe(11);
    expect(tierCounts[3]).toBe(1);
  });
});
