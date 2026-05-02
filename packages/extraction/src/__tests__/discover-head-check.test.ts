// Phase 3.10 — Stage 0 HEAD-verification unit tests.
//
// Asserts the four checks _verifyOneUrl performs in order:
//   1. Hostname-in-blocker-set → drop without fetching.
//   2. HTTP 404 / 410 → drop.
//   3. Content-Length present and below thin threshold → drop.
//   4. Connection error / abort / timeout → drop.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscoveredUrl } from '../types/extraction';

function du(url: string): DiscoveredUrl {
  return { url, tier: 1, geographicLevel: 'national', reason: 'test', isOfficial: true };
}

describe('_verifyOneUrl — Phase 3.10 HEAD-verification', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('drops blocker-domain URLs without invoking fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const blockers = new Set(['www.isa.go.jp']);
    const result = await _verifyOneUrl(du('https://www.isa.go.jp/en/page'), blockers);
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('matches hostname case-insensitively against the blocker set', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const blockers = new Set(['www.isa.go.jp']);
    const result = await _verifyOneUrl(du('https://WWW.ISA.GO.JP/en/page'), blockers);
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('drops URLs returning HTTP 404', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 404,
      headers: new Headers(),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const result = await _verifyOneUrl(du('https://example.com/missing'), new Set());
    expect(result).toBeNull();
  });

  it('drops URLs returning HTTP 410', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 410,
      headers: new Headers(),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const result = await _verifyOneUrl(du('https://example.com/gone'), new Set());
    expect(result).toBeNull();
  });

  it('drops URLs whose Content-Length is below the thin threshold', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      headers: new Headers({ 'content-length': '512' }),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const result = await _verifyOneUrl(du('https://example.com/thin'), new Set());
    expect(result).toBeNull();
  });

  it('keeps URLs whose Content-Length is at the threshold or above', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      headers: new Headers({ 'content-length': '4096' }),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const fat = du('https://example.com/fat');
    const result = await _verifyOneUrl(fat, new Set());
    expect(result).toEqual(fat);
  });

  it('keeps URLs that omit Content-Length (most dynamic government pages do)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      headers: new Headers(),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const dyn = du('https://gov.example/dyn');
    const result = await _verifyOneUrl(dyn, new Set());
    expect(result).toEqual(dyn);
  });

  it('drops URLs that throw on fetch (connection error)', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const result = await _verifyOneUrl(du('https://example.invalid/'), new Set());
    expect(result).toBeNull();
  });

  it('keeps URLs that return HTTP 200 with no Content-Length', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      headers: new Headers(),
    })) as unknown as typeof globalThis.fetch;
    const { _verifyOneUrl } = await import('../stages/discover');
    const ok = du('https://gov.example/ok');
    const result = await _verifyOneUrl(ok, new Set());
    expect(result).toEqual(ok);
  });
});
