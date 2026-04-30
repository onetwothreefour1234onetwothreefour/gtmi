import { describe, expect, it } from 'vitest';
import { RUBRIC_SCORES, methodologyV1, methodologyV2, PHASE_3_5_RESTRUCTURED_KEYS } from '@gtmi/db';
import { REGIONAL_SUBSTITUTES } from '@gtmi/scoring';

// Phase 3.8 / P0 — single source of truth for categorical vocabularies.
//
// Every categorical-shaped indicator (`categorical` or
// `country_substitute_regional`) has FOUR places where its vocabulary
// can drift:
//
//   1. The prompt's "Allowed values" enumeration.
//   2. `scoringRubricJsonb.categories[].value` on the field definition.
//   3. `RUBRIC_SCORES[key]` (used by the v1 seed enrichment).
//   4. `REGIONAL_SUBSTITUTES[key][region].value` (only C.3.2 today).
//
// These tests assert that all four agree. A single mismatch (the C.3.2
// case that motivated this commit) is exactly what produced
// "Categorical value 'X' not found in rubric" at score time.

interface SeedIndicator {
  key: string;
  normalizationFn: string;
  extractionPromptMd: string;
  scoringRubricJsonb: { categories: Array<{ value: string; score?: number }> } | null;
}

const ALLOWED_VALUES_BLOCK_RE = /Allowed values:\s*([\s\S]*?)(?:\n\n|$)/;
// Each Allowed-values line begins with a quoted token. Some prompts add an
// alias parenthetical between the token and the colon (e.g.
// `"automatic" (alias of "full_access"):`), so parse line-by-line and
// take the *first* quoted token on each non-empty line rather than
// requiring the colon to follow immediately.
const FIRST_QUOTED_VALUE_RE = /^\s*"([a-z][a-z0-9_]*)"/;
// Some prompts (e.g. C.3.1) explicitly call out an alias inside the
// description: `(alias of "full_access")`. Pick those up too so the
// drift check accepts analyst-introduced aliases without forcing a
// rubric rewrite.
const ALIAS_TOKEN_RE = /alias of "([a-z][a-z0-9_]*)"/g;

function parsePromptVocab(prompt: string): string[] {
  const block = ALLOWED_VALUES_BLOCK_RE.exec(prompt);
  if (!block) return [];
  const out = new Set<string>();
  for (const line of block[1]!.split('\n')) {
    const m = FIRST_QUOTED_VALUE_RE.exec(line);
    if (m) out.add(m[1]!);
    let am: RegExpExecArray | null;
    ALIAS_TOKEN_RE.lastIndex = 0;
    while ((am = ALIAS_TOKEN_RE.exec(line)) !== null) {
      out.add(am[1]!);
    }
  }
  return [...out];
}

function rubricVocab(rubric: { categories: Array<{ value: string }> } | null): string[] {
  if (!rubric) return [];
  return rubric.categories.map((c) => c.value);
}

const CATEGORICAL_LIKE = new Set(['categorical', 'country_substitute_regional']);

const v1Categorical: SeedIndicator[] = (methodologyV1.indicators as SeedIndicator[]).filter((i) =>
  CATEGORICAL_LIKE.has(i.normalizationFn)
);
const v2Categorical: SeedIndicator[] = (methodologyV2.indicators as SeedIndicator[]).filter((i) =>
  CATEGORICAL_LIKE.has(i.normalizationFn)
);

describe('Rubric ↔ prompt vocabulary drift (v1)', () => {
  it.each(v1Categorical.map((i) => [i.key, i]))(
    '%s: every rubric value appears in the prompt',
    (_key, ind) => {
      const promptVocab = parsePromptVocab(ind.extractionPromptMd);
      const rubric = rubricVocab(ind.scoringRubricJsonb);
      for (const v of rubric) {
        expect(
          promptVocab.includes(v),
          `${ind.key}: rubric value "${v}" missing from prompt's "Allowed values" block (prompt has [${promptVocab.join(', ')}])`
        ).toBe(true);
      }
    }
  );

  it.each(v1Categorical.map((i) => [i.key, i]))(
    '%s: every prompt-enumerated value appears in the rubric',
    (_key, ind) => {
      const promptVocab = parsePromptVocab(ind.extractionPromptMd);
      const rubric = rubricVocab(ind.scoringRubricJsonb);
      // Some prompts list sentinels (e.g. not_addressed) that are deliberately
      // excluded from rubrics — drop them before comparing.
      const SENTINELS = new Set(['not_addressed', 'not_found', 'not_stated']);
      for (const v of promptVocab) {
        if (SENTINELS.has(v)) continue;
        expect(
          rubric.includes(v),
          `${ind.key}: prompt value "${v}" missing from rubric (rubric has [${rubric.join(', ')}])`
        ).toBe(true);
      }
    }
  );

  it.each(v1Categorical.map((i) => [i.key, i]))(
    '%s: every rubric value has a score in RUBRIC_SCORES',
    (_key, ind) => {
      const scores = RUBRIC_SCORES[ind.key];
      expect(scores, `${ind.key}: no entry in RUBRIC_SCORES`).toBeDefined();
      for (const v of rubricVocab(ind.scoringRubricJsonb)) {
        expect(
          v in scores!,
          `${ind.key}: rubric value "${v}" has no score in RUBRIC_SCORES (has [${Object.keys(scores!).join(', ')}])`
        ).toBe(true);
      }
    }
  );
});

describe('Rubric ↔ prompt vocabulary drift (v2 Phase 3.5 restructures)', () => {
  // Phase 3.5 restructures embed scores in the rubric directly (no
  // RUBRIC_SCORES indirection), so the consistency contract is:
  // prompt vocab == rubric vocab, and every rubric category has a score.
  const restructured = v2Categorical.filter((i) => PHASE_3_5_RESTRUCTURED_KEYS.includes(i.key));

  it.each(restructured.map((i) => [i.key, i]))(
    '%s: rubric values match prompt-enumerated values exactly',
    (_key, ind) => {
      const promptVocab = parsePromptVocab(ind.extractionPromptMd).sort();
      const rubric = rubricVocab(ind.scoringRubricJsonb).sort();
      expect(rubric).toEqual(promptVocab);
    }
  );

  it.each(restructured.map((i) => [i.key, i]))(
    '%s: every rubric category has an inline numeric score',
    (_key, ind) => {
      const cats = ind.scoringRubricJsonb?.categories ?? [];
      for (const c of cats) {
        expect(
          typeof c.score === 'number',
          `${ind.key}: rubric category "${c.value}" missing inline score`
        ).toBe(true);
      }
    }
  );
});

describe('REGIONAL_SUBSTITUTES ↔ rubric vocabulary', () => {
  it('every substitute value exists in the field rubric (v2)', () => {
    for (const [fieldKey, regions] of Object.entries(REGIONAL_SUBSTITUTES)) {
      const v2Ind = (methodologyV2.indicators as SeedIndicator[]).find((i) => i.key === fieldKey);
      expect(v2Ind, `${fieldKey}: no v2 indicator definition`).toBeDefined();
      const rubric = rubricVocab(v2Ind!.scoringRubricJsonb);
      for (const sub of Object.values(regions)) {
        if (!sub) continue;
        expect(
          rubric.includes(sub.value),
          `${fieldKey}: substitute writes "${sub.value}" but rubric is [${rubric.join(', ')}]`
        ).toBe(true);
      }
    }
  });

  it('every substitute score matches the rubric score for the same value', () => {
    for (const [fieldKey, regions] of Object.entries(REGIONAL_SUBSTITUTES)) {
      const v2Ind = (methodologyV2.indicators as SeedIndicator[]).find((i) => i.key === fieldKey);
      const cats = v2Ind?.scoringRubricJsonb?.categories ?? [];
      for (const sub of Object.values(regions)) {
        if (!sub) continue;
        const cat = cats.find((c) => c.value === sub.value);
        expect(cat, `${fieldKey}: rubric missing category "${sub.value}"`).toBeDefined();
        expect(
          cat!.score,
          `${fieldKey}: substitute score ${sub.score} for "${sub.value}" disagrees with rubric score ${cat!.score}`
        ).toBe(sub.score);
      }
    }
  });
});
