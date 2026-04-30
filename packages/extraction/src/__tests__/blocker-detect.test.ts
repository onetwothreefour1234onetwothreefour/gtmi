import { describe, expect, it, beforeEach } from 'vitest';
import { RunBlockerState, clearBlockerStateForTest } from '../utils/blocker-detect';
import type { ScrapeResult } from '../types/extraction';

function makeResult(args: {
  url: string;
  hash: string;
  body?: string;
  status?: number;
}): ScrapeResult {
  return {
    url: args.url,
    contentMarkdown: args.body ?? '',
    contentHash: args.hash,
    scrapedAt: new Date('2026-04-30T12:00:00Z'),
    httpStatus: args.status ?? 200,
  };
}

describe('RunBlockerState — country-agnostic blocker detection', () => {
  let state: RunBlockerState;

  beforeEach(() => {
    state = new RunBlockerState();
  });

  describe('Signal 1: hash_equality', () => {
    it('does NOT fire on the first observation', () => {
      const r = makeResult({ url: 'https://isa.go.jp/en/path1', hash: 'abc123' });
      const signal = state.observe({ url: r.url, result: r, wasThin: true, wasChallenge: false });
      expect(signal).toBeNull();
    });

    it('FIRES when ≥2 distinct paths from one domain return identical content_hash', () => {
      const r1 = makeResult({ url: 'https://isa.go.jp/en/path1', hash: 'abc123' });
      const r2 = makeResult({ url: 'https://isa.go.jp/en/path2', hash: 'abc123' });
      state.observe({ url: r1.url, result: r1, wasThin: true, wasChallenge: false });
      const signal = state.observe({
        url: r2.url,
        result: r2,
        wasThin: true,
        wasChallenge: false,
      });
      expect(signal).toBe('hash_equality');
    });

    it('does NOT fire when ≥2 paths return different content_hash', () => {
      const r1 = makeResult({ url: 'https://example.com/a', hash: 'aaa' });
      const r2 = makeResult({ url: 'https://example.com/b', hash: 'bbb' });
      state.observe({ url: r1.url, result: r1, wasThin: false, wasChallenge: false });
      const signal = state.observe({
        url: r2.url,
        result: r2,
        wasThin: false,
        wasChallenge: false,
      });
      expect(signal).toBeNull();
    });

    it('treats the same path twice as ONE observation (paths-set, not call-count)', () => {
      const r = makeResult({ url: 'https://isa.go.jp/path', hash: 'abc' });
      state.observe({ url: r.url, result: r, wasThin: false, wasChallenge: false });
      const signal = state.observe({
        url: r.url,
        result: r,
        wasThin: false,
        wasChallenge: false,
      });
      expect(signal).toBeNull();
    });
  });

  describe('Signal 2: thin_fanout', () => {
    it('FIRES when ≥2 distinct paths return thin content with different hashes', () => {
      const r1 = makeResult({ url: 'https://ind.nl/en/page-a', hash: 'aaa' });
      const r2 = makeResult({ url: 'https://ind.nl/en/page-b', hash: 'bbb' });
      state.observe({ url: r1.url, result: r1, wasThin: true, wasChallenge: false });
      const signal = state.observe({
        url: r2.url,
        result: r2,
        wasThin: true,
        wasChallenge: false,
      });
      expect(signal).toBe('thin_fanout');
    });

    it('does NOT fire on a single thin path', () => {
      const r = makeResult({ url: 'https://ind.nl/en/single', hash: 'aaa' });
      const signal = state.observe({
        url: r.url,
        result: r,
        wasThin: true,
        wasChallenge: false,
      });
      expect(signal).toBeNull();
    });
  });

  describe('Signal 3: challenge_fanout', () => {
    it('FIRES when ≥2 distinct paths hit the challenge marker', () => {
      const r1 = makeResult({ url: 'https://blocked.example/a', hash: '' });
      const r2 = makeResult({ url: 'https://blocked.example/b', hash: '' });
      state.observe({ url: r1.url, result: r1, wasThin: false, wasChallenge: true });
      const signal = state.observe({
        url: r2.url,
        result: r2,
        wasThin: false,
        wasChallenge: true,
      });
      expect(signal).toBe('challenge_fanout');
    });
  });

  describe('idempotency', () => {
    it('returns null on subsequent observations after a domain is already flagged', () => {
      const r1 = makeResult({ url: 'https://isa.go.jp/a', hash: 'x' });
      const r2 = makeResult({ url: 'https://isa.go.jp/b', hash: 'x' });
      const r3 = makeResult({ url: 'https://isa.go.jp/c', hash: 'x' });
      state.observe({ url: r1.url, result: r1, wasThin: true, wasChallenge: false });
      const first = state.observe({
        url: r2.url,
        result: r2,
        wasThin: true,
        wasChallenge: false,
      });
      const second = state.observe({
        url: r3.url,
        result: r3,
        wasThin: true,
        wasChallenge: false,
      });
      expect(first).toBe('hash_equality');
      expect(second).toBeNull(); // already flagged
    });
  });

  describe('country-agnostic', () => {
    it('flags any domain that meets the heuristic, regardless of TLD or country context', () => {
      // Three different country-coded TLDs; no per-country logic in
      // the detector. Any of them flags identically.
      for (const domain of ['blocked.go.jp', 'blocked.gov.uk', 'blocked.com.au']) {
        const fresh = new RunBlockerState();
        const r1 = makeResult({ url: `https://${domain}/a`, hash: 'h' });
        const r2 = makeResult({ url: `https://${domain}/b`, hash: 'h' });
        fresh.observe({ url: r1.url, result: r1, wasThin: true, wasChallenge: false });
        const signal = fresh.observe({
          url: r2.url,
          result: r2,
          wasThin: true,
          wasChallenge: false,
        });
        expect(signal).toBe('hash_equality');
      }
    });
  });

  describe('clearBlockerStateForTest', () => {
    it('resets the state so a new test case starts fresh', () => {
      const r1 = makeResult({ url: 'https://x.example/a', hash: 'h' });
      const r2 = makeResult({ url: 'https://x.example/b', hash: 'h' });
      state.observe({ url: r1.url, result: r1, wasThin: true, wasChallenge: false });
      state.observe({ url: r2.url, result: r2, wasThin: true, wasChallenge: false });
      clearBlockerStateForTest(state);
      const r3 = makeResult({ url: 'https://x.example/c', hash: 'h' });
      const signal = state.observe({
        url: r3.url,
        result: r3,
        wasThin: true,
        wasChallenge: false,
      });
      // After clear, state is empty — a single observation cannot fire.
      expect(signal).toBeNull();
    });
  });

  describe('domainOf helper', () => {
    it('extracts hostname (lowercased) from a valid URL', () => {
      expect(RunBlockerState.domainOf('https://EXAMPLE.com/path')).toBe('example.com');
    });

    it('returns empty string for unparseable URLs', () => {
      expect(RunBlockerState.domainOf('not a url')).toBe('');
    });
  });
});
