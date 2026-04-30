import { describe, expect, it } from 'vitest';
import {
  recordAttempts,
  recordAttempt,
  markAttemptPublished,
  clearFieldDefIdCache,
  getCurrentPromptId,
} from '../utils/attempts';
import * as barrel from '../index';

// Pure surface-level tests: confirm the export shape + that empty-input
// paths short-circuit cleanly without needing a DB. End-to-end behavior
// (DB writes, supersedes-chain) is validated by canary re-runs and the
// (forthcoming) backfill script in commit 9.

describe('attempts API surface', () => {
  it('recordAttempts([]) returns 0 without touching the DB', async () => {
    const n = await recordAttempts([]);
    expect(n).toBe(0);
  });

  it('package barrel re-exports the attempts API', () => {
    expect(typeof barrel.recordAttempts).toBe('function');
    expect(typeof barrel.recordAttempt).toBe('function');
    expect(typeof barrel.markAttemptPublished).toBe('function');
    expect(typeof barrel.clearFieldDefIdCache).toBe('function');
    expect(typeof barrel.getCurrentPromptId).toBe('function');
  });

  it('exposes the expected function shapes', () => {
    expect(typeof recordAttempt).toBe('function');
    expect(typeof markAttemptPublished).toBe('function');
    expect(typeof clearFieldDefIdCache).toBe('function');
    expect(typeof getCurrentPromptId).toBe('function');
  });
});
