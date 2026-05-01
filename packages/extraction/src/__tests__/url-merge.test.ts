import { describe, expect, it } from 'vitest';
import {
  dynamicTierQuotas,
  dynamicUrlCap,
  mergeDiscoveredUrls,
  normaliseUrl,
  DEFAULT_URL_CAP,
} from '../utils/url-merge';
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

  // Phase 3.7 / ADR-018 — fieldProven origin (same-program prior URL)
  // is the highest-priority origin in the merge.
  it('fieldProven URL beats registry on conflict (ADR-018 priority)', () => {
    const fieldProven = [
      du('https://gov.example/x', 1, 'national', 'Field-proven — A.1.1 in this programme'),
    ];
    const registry = [du('https://gov.example/x', 1, 'national', 'registry')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: [],
      fromSourcesTable: registry,
      fromFieldProven: fieldProven,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toContain('Field-proven');
  });

  it('fieldProven beats fresh on conflict (ADR-018 priority)', () => {
    const fresh = [du('https://gov.example/x', 1, 'national', 'fresh')];
    const fieldProven = [du('https://gov.example/x', 1, 'national', 'Field-proven')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      fromFieldProven: fieldProven,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toBe('Field-proven');
  });

  it('within the same tier, fieldProven appears before registry, proven, and fresh', () => {
    const fresh = [du('https://gov.example/fresh', 1, 'national', 'fresh')];
    const registry = [du('https://gov.example/registry', 1, 'national', 'registry')];
    const proven = [du('https://gov.example/proven', 1, 'national', 'proven')];
    const fieldProven = [du('https://gov.example/fieldProven', 1, 'national', 'fieldProven')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
      fromProvenance: proven,
      fromFieldProven: fieldProven,
    });
    expect(result.map((u) => u.url)).toEqual([
      'https://gov.example/fieldProven',
      'https://gov.example/registry',
      'https://gov.example/proven',
      'https://gov.example/fresh',
    ]);
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

// Phase 3.6.2 / ITEM 4 — dynamic cap + tier quotas.
describe('dynamicUrlCap', () => {
  it('returns 20 for under-covered programs (<30 populated)', () => {
    expect(dynamicUrlCap(0)).toBe(20);
    expect(dynamicUrlCap(15)).toBe(20);
    expect(dynamicUrlCap(29)).toBe(20);
  });

  it('returns 15 in the default band (30..41 populated)', () => {
    expect(dynamicUrlCap(30)).toBe(15);
    expect(dynamicUrlCap(35)).toBe(15);
    expect(dynamicUrlCap(41)).toBe(15);
  });

  it('returns 12 for well-covered programs (>=42 populated)', () => {
    expect(dynamicUrlCap(42)).toBe(12);
    expect(dynamicUrlCap(45)).toBe(12);
    expect(dynamicUrlCap(48)).toBe(12);
  });
});

describe('dynamicTierQuotas', () => {
  it('preserves the 60/30/10 ratio across all three caps', () => {
    expect(dynamicTierQuotas(12)).toEqual({ 1: 7, 2: 4, 3: 1 });
    expect(dynamicTierQuotas(15)).toEqual({ 1: 9, 2: 5, 3: 1 });
    expect(dynamicTierQuotas(20)).toEqual({ 1: 12, 2: 7, 3: 1 });
  });

  it('quotas always sum to the cap', () => {
    for (const cap of [12, 15, 20]) {
      const q = dynamicTierQuotas(cap);
      expect(q[1] + q[2] + q[3]).toBe(cap);
    }
  });
});

// Phase 3.6.2 / ITEM 5 — proven URLs are a third merge origin
// (registry → proven → fresh; fresh wins on URL conflict).
describe('mergeDiscoveredUrls — proven URL origin', () => {
  it('includes proven URLs after registry but before fresh in same tier', () => {
    const registry = [du('https://reg.example/a', 1)];
    const proven = [du('https://proven.example/b', 1)];
    const fresh = [du('https://fresh.example/c', 1)];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
      fromProvenance: proven,
    });
    expect(result.map((u) => u.url)).toEqual([
      'https://reg.example/a',
      'https://proven.example/b',
      'https://fresh.example/c',
    ]);
  });

  it('fresh wins on URL conflict with a proven entry', () => {
    const proven = [du('https://x.example/p', 1, 'national', 'proven reason')];
    const fresh = [du('https://x.example/p', 1, 'national', 'fresh reason')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      fromProvenance: proven,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toBe('fresh reason');
  });

  it('registry wins on URL conflict with a proven entry', () => {
    const registry = [du('https://x.example/p', 1, 'national', 'registry reason')];
    const proven = [du('https://x.example/p', 1, 'national', 'proven reason')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: [],
      fromSourcesTable: registry,
      fromProvenance: proven,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toBe('registry reason');
  });

  it('respects an explicit quotas override', () => {
    const fresh = [
      du('https://t1.example/a', 1),
      du('https://t1.example/b', 1),
      du('https://t1.example/c', 1),
      du('https://t2.example/a', 2),
      du('https://t2.example/b', 2),
    ];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 4,
      quotas: { 1: 2, 2: 2, 3: 0 },
    });
    expect(result).toHaveLength(4);
    expect(result.filter((u) => u.tier === 1)).toHaveLength(2);
    expect(result.filter((u) => u.tier === 2)).toHaveLength(2);
  });
});

describe('mergeDiscoveredUrls — Phase 3.9 / W10 yield-ranked merge', () => {
  it('promotes URLs with higher yield within the same origin band', () => {
    // Three Tier-1 fresh URLs; B has high yield, A has medium, C has none.
    const fresh = [
      du('https://gov.example/a', 1, 'national', 'a'),
      du('https://gov.example/b', 1, 'national', 'b'),
      du('https://gov.example/c', 1, 'national', 'c'),
    ];
    const yieldByUrl = new Map<string, number>([
      ['https://gov.example/a', 5],
      ['https://gov.example/b', 12],
      // c absent → 0
    ]);
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 3,
      yieldByUrl,
    });
    expect(result.map((u) => u.url)).toEqual([
      'https://gov.example/b',
      'https://gov.example/a',
      'https://gov.example/c',
    ]);
  });

  it('respects origin rank above yield (fieldProven beats higher-yield fresh)', () => {
    // fieldProven A has yield=0; fresh B has yield=20. fieldProven should
    // still rank first because origin is the primary sort key.
    const fieldProven = [du('https://gov.example/a', 1, 'national', 'proven')];
    const fresh = [du('https://gov.example/b', 1, 'national', 'fresh')];
    const yieldByUrl = new Map<string, number>([['https://gov.example/b', 20]]);
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromFieldProven: fieldProven,
      fromSourcesTable: [],
      cap: 2,
      yieldByUrl,
    });
    expect(result.map((u) => u.url)).toEqual(['https://gov.example/a', 'https://gov.example/b']);
  });

  it('falls back to current Phase-3.7 ordering when yieldByUrl is absent', () => {
    // Same inputs as the first W10 test but with no yield map. Order
    // becomes the input-order stable sort (a, b, c).
    const fresh = [
      du('https://gov.example/a', 1, 'national', 'a'),
      du('https://gov.example/b', 1, 'national', 'b'),
      du('https://gov.example/c', 1, 'national', 'c'),
    ];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 3,
    });
    expect(result.map((u) => u.url)).toEqual([
      'https://gov.example/a',
      'https://gov.example/b',
      'https://gov.example/c',
    ]);
  });
});

describe('mergeDiscoveredUrls — Phase 3.9 / W22 blocker-domain filter', () => {
  it('drops URLs whose hostname is in the blocker set (registry origin)', () => {
    const registry = [
      du('https://www.isa.go.jp/en/path1', 1, 'national', 'r1'),
      du('https://www.isa.go.jp/en/path2', 1, 'national', 'r2'),
      du('https://www.moj.go.jp/EN/MINJI/minji78.html', 1, 'national', 'r3'),
    ];
    const fresh = [du('https://www.jetro.go.jp/en/invest/x', 1, 'national', 'f1')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: registry,
      cap: 10,
      blockerDomains: new Set(['www.isa.go.jp']),
    });
    const hosts = result.map((u) => new URL(u.url).hostname);
    expect(hosts).not.toContain('www.isa.go.jp');
    expect(result).toHaveLength(2);
  });

  it('drops blocker URLs from fresh origin too (Stage 0 may include them)', () => {
    const fresh = [
      du('https://www.isa.go.jp/jp/files/points_table_2023.pdf', 1, 'national', 'f1'),
      du('https://www.mofa.go.jp/j_info/visit/visa/long/visa16.html', 1, 'national', 'f2'),
    ];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 10,
      blockerDomains: new Set(['www.isa.go.jp']),
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://www.mofa.go.jp/j_info/visit/visa/long/visa16.html');
  });

  it('passes through unchanged when blockerDomains is absent', () => {
    const fresh = [du('https://www.isa.go.jp/en/path1', 1, 'national', 'f1')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 10,
    });
    expect(result).toHaveLength(1);
  });

  it('passes through unchanged when blockerDomains is empty', () => {
    const fresh = [du('https://www.isa.go.jp/en/path1', 1, 'national', 'f1')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 10,
      blockerDomains: new Set(),
    });
    expect(result).toHaveLength(1);
  });

  it('matches hostname case-insensitively', () => {
    const fresh = [du('https://WWW.ISA.go.jp/en/path1', 1, 'national', 'f1')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 10,
      blockerDomains: new Set(['www.isa.go.jp']),
    });
    expect(result).toHaveLength(0);
  });

  it('does not match by substring (subdomain isolation)', () => {
    // www.isa.go.jp blocked; isa.go.jp.example.com should still pass.
    const fresh = [du('https://isa.go.jp.example.com/page', 1, 'national', 'f1')];
    const result = mergeDiscoveredUrls({
      freshFromStage0: fresh,
      fromSourcesTable: [],
      cap: 10,
      blockerDomains: new Set(['www.isa.go.jp']),
    });
    expect(result).toHaveLength(1);
  });
});
