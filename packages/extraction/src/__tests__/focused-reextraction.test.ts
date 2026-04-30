import { describe, expect, it } from 'vitest';
import { buildFocusedReextractionPrompt } from '../stages/extract';

// Phase 3.8 / P3.5 — focused re-extraction prompt assembly. The helper
// templates a "REVIEW CONTEXT" block onto the original prompt so the
// LLM sees the previous (rejected) value, the analyst's note, and the
// rubric vocabulary it must conform to.

const BASE = `Extraction Task: C.3.2 — Public education access
Question: What is the access?
Allowed values: ...
`;

describe('buildFocusedReextractionPrompt', () => {
  it('includes the previous valueRaw verbatim', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: 'fee_based',
      rejectReason: null,
      rubricVocabBlock: null,
    });
    expect(out).toContain('Previous valueRaw was: "fee_based"');
  });

  it('includes the analyst reject reason when supplied', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: 'fee_based',
      rejectReason: 'value not in current rubric — vocabulary changed in Phase 3.5',
      rubricVocabBlock: null,
    });
    expect(out).toContain('Reviewer notes: value not in current rubric');
  });

  it('appends the rubric vocab block when provided', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: null,
      rejectReason: null,
      rubricVocabBlock: 'Allowed values:\n\n"automatic": ...',
    });
    expect(out).toContain('Allowed values:');
    expect(out).toContain('"automatic"');
    expect(out).toContain('valueRaw MUST be one of the rubric values');
  });

  it('preserves the base prompt unchanged at the head', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: 'x',
      rejectReason: null,
      rubricVocabBlock: null,
    });
    expect(out.startsWith(BASE)).toBe(true);
  });

  it('handles all-null inputs gracefully (no-context re-run)', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: null,
      rejectReason: null,
      rubricVocabBlock: null,
    });
    expect(out).toContain('REVIEW CONTEXT');
    expect(out).toContain('do not return the same incorrect value');
    expect(out).not.toContain('Previous valueRaw');
    expect(out).not.toContain('Reviewer notes');
  });

  it('always reminds the LLM about the no-inference directive', () => {
    const out = buildFocusedReextractionPrompt({
      basePromptMd: BASE,
      previousValueRaw: 'x',
      rejectReason: 'wrong page',
      rubricVocabBlock: null,
    });
    expect(out).toContain('no-inference directive');
  });
});
