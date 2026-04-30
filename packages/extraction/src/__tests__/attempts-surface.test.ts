import { describe, expect, it } from 'vitest';
import { recordAttempts, recordAttempt, markAttemptPublished } from '../utils/attempts';

// Pure surface-level tests: confirm the export shape + that empty-input
// paths short-circuit cleanly without needing a DB. End-to-end behavior
// (DB writes, supersedes-chain) is validated by canary re-runs and the
// (forthcoming) backfill script in commit 9.

describe('attempts API surface', () => {
  it('recordAttempts([]) returns 0 without touching the DB', async () => {
    const n = await recordAttempts([]);
    expect(n).toBe(0);
  });

  it('recordAttempts is callable from the extraction package index', async () => {
    // Import the same function via the package barrel to confirm the
    // re-export from src/index.ts is wired up.
    const mod = await import('../index');
    expect(typeof mod.recordAttempts).toBe('function');
    expect(typeof mod.recordAttempt).toBe('function');
    expect(typeof mod.markAttemptPublished).toBe('function');
    expect(typeof mod.clearFieldDefIdCache).toBe('function');
  });

  it('exposes the expected function shapes', () => {
    expect(typeof recordAttempt).toBe('function');
    expect(typeof markAttemptPublished).toBe('function');
  });
});
