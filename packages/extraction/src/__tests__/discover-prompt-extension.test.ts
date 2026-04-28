import { describe, expect, it } from 'vitest';
import { buildUserMessage } from '../stages/discover';

// Phase 3.6.1 — discovery prompt extension tests covering FIX 4
// (departments 7 + 8) and FIX 5 (deduplication exclusion list).

describe('buildUserMessage — extended departments (FIX 4)', () => {
  const msg = buildUserMessage('Skills in Demand 482', 'AUS');

  it('mentions the permanent residence pathway authority (department f)', () => {
    expect(msg).toMatch(/permanent[- ]residence pathway authority/i);
  });

  it('mentions the citizenship authority (department g)', () => {
    expect(msg).toMatch(/citizenship authority/i);
  });

  it('contains the rule requiring at least two URLs from departments (f) and (g)', () => {
    // Rule (3) per the user dispatch — at least two of 15 URLs from PR + citizenship authorities.
    expect(msg).toMatch(/AT LEAST TWO of your 15 URLs/);
    expect(msg).toMatch(/departments \(f\) and \(g\)/);
  });

  it('cap text raised from 10 to 15', () => {
    expect(msg).toMatch(/up to 15 of the most relevant/);
    // The old value (10) should not appear as the cap any more.
    expect(msg).not.toMatch(/Find up to 10/);
  });
});

describe('buildUserMessage — deduplication exclusion list (FIX 5)', () => {
  it('omits the exclusion block when existingUrls is empty', () => {
    const msg = buildUserMessage('Skills in Demand 482', 'AUS', []);
    expect(msg).not.toMatch(/ALREADY KNOWN/);
  });

  it('emits the exclusion block when existingUrls is non-empty', () => {
    const msg = buildUserMessage('Skills in Demand 482', 'AUS', [
      'https://immi.homeaffairs.gov.au/visas/test-1',
      'https://immi.homeaffairs.gov.au/visas/test-2',
    ]);
    expect(msg).toMatch(/ALREADY KNOWN — do NOT return these URLs/);
    expect(msg).toMatch(/https:\/\/immi\.homeaffairs\.gov\.au\/visas\/test-1/);
    expect(msg).toMatch(/https:\/\/immi\.homeaffairs\.gov\.au\/visas\/test-2/);
  });

  it('caps the exclusion list at 20 URLs regardless of input size', () => {
    const huge: string[] = [];
    for (let i = 0; i < 50; i++) huge.push(`https://example.gov/page-${i}`);
    const msg = buildUserMessage('Test Program', 'AUS', huge);
    // The first 20 should appear; URLs 20+ should not.
    expect(msg).toMatch(/https:\/\/example\.gov\/page-0\b/);
    expect(msg).toMatch(/https:\/\/example\.gov\/page-19\b/);
    expect(msg).not.toMatch(/https:\/\/example\.gov\/page-20\b/);
    expect(msg).not.toMatch(/https:\/\/example\.gov\/page-49\b/);
  });
});
