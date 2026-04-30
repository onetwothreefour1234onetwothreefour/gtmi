import { describe, expect, it } from 'vitest';
import { assertSingleResponse } from '../stages/extract';

// Phase 3.8 / P2.5 — provenance binding contract:
//   non-empty valueRaw + non-zero confidence
//     => MUST have non-empty sourceSentence + non-zero offsets.
// Empty valueRaw + zero confidence is the legitimate "not found" answer
// and stays unconstrained.

const VALID = {
  valueRaw: 'AUD 1485',
  sourceSentence: 'The principal applicant fee is AUD 1,485.',
  characterOffsets: { start: 100, end: 142 },
  extractionConfidence: 0.92,
};

describe('assertSingleResponse — provenance binding', () => {
  it('accepts a valid response', () => {
    expect(() => assertSingleResponse(VALID, 'B.2.1')).not.toThrow();
  });

  it('accepts the legitimate "not found" response (empty + 0 confidence)', () => {
    const notFound = {
      valueRaw: '',
      sourceSentence: '',
      characterOffsets: { start: 0, end: 0 },
      extractionConfidence: 0,
    };
    expect(() => assertSingleResponse(notFound, 'B.2.1')).not.toThrow();
  });

  it('rejects a non-empty valueRaw with empty sourceSentence', () => {
    const bad = { ...VALID, sourceSentence: '' };
    expect(() => assertSingleResponse(bad, 'B.2.1')).toThrowError(
      /provenance binding|sourceSentence/i
    );
  });

  it('rejects a non-empty valueRaw with whitespace-only sourceSentence', () => {
    const bad = { ...VALID, sourceSentence: '   ' };
    expect(() => assertSingleResponse(bad, 'B.2.1')).toThrowError(
      /provenance binding|sourceSentence/i
    );
  });

  it('rejects non-empty valueRaw with zero offsets', () => {
    const bad = { ...VALID, characterOffsets: { start: 0, end: 0 } };
    expect(() => assertSingleResponse(bad, 'B.2.1')).toThrowError(/provenance binding|offsets/i);
  });

  it('rejects offsets where end < start', () => {
    const bad = { ...VALID, characterOffsets: { start: 200, end: 100 } };
    expect(() => assertSingleResponse(bad, 'B.2.1')).toThrowError(/end must be >=/i);
  });

  it('does NOT reject zero offsets when valueRaw is empty', () => {
    // The "not found" case must not trip the new binding rule.
    const empty = {
      valueRaw: '',
      sourceSentence: '',
      characterOffsets: { start: 0, end: 0 },
      extractionConfidence: 0,
    };
    expect(() => assertSingleResponse(empty, 'B.2.1')).not.toThrow();
  });
});
