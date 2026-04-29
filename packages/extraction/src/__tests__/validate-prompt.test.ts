// Phase 3.6.3 / FIX 1 — assertion-only test for the validator prompt.
//
// We don't mock the Anthropic client here (no live LLM call in CI). Instead
// we verify the SYSTEM_PROMPT and user-message rules carry the consistency-
// based language that allows rubric-label paraphrases and absence-of-topic
// values to validate as isValid=true. This test fails loudly if a future
// edit accidentally reverts the prompt to the strict-literal-match version
// that produced the AUS C.1.1 / C.1.3 / C.3.1 / D.3.3 / E.2.1 false
// negatives.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const validateSrc = readFileSync(join(__dirname, '..', 'stages', 'validate.ts'), 'utf8');

describe('validate.ts SYSTEM_PROMPT — FIX 1 assertions', () => {
  it('frames isValid as a consistency check, not a literal-support check', () => {
    expect(validateSrc).toMatch(/consistent with evidence/);
  });
  it('explicitly accepts paraphrased rubric labels', () => {
    expect(validateSrc).toMatch(/rubric label/);
  });
  it('explicitly handles absence-of-topic values', () => {
    expect(validateSrc).toMatch(/Absence-of-topic|absence-style/i);
  });
  it('reserves isValid=false for genuine contradiction or unsupportable values', () => {
    expect(validateSrc).toMatch(/directly contradicts|unsupportable/);
  });
  it('user-message rules describe rubric-label paraphrasing as valid', () => {
    expect(validateSrc).toMatch(/rubric labels are paraphrases/);
  });
});
