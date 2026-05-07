/**
 * Methodology V2 — Phase 3.3 prompt-sweep overlay on V1.
 *
 * V1 (`methodology-v1.ts`) is preserved as the historical record. This file
 * re-exports the same methodology object structure but overrides the
 * `extractionPromptMd` for LLM_MISS fields identified in
 * `docs/phase-3/baseline-gaps.csv`.
 *
 * V2 does NOT change weights, normalization, indicators, or the rubric.
 * The methodology version remains 1.0.0 — `version_tag` is bumped to
 * `1.0.1-phase-3-3-prompts` only as a content marker; the
 * `methodology_versions` DB row does not need a new entry because no
 * scoring inputs have changed.
 *
 * Phase 3.5 (ADR-014) may introduce a true V2.0.0 with weight changes;
 * that will live in a separate file.
 *
 * See docs/prompt-engineering-patterns.md for the failure-mode taxonomy
 * and decision rules behind each rewrite.
 */

import { methodologyV1 } from './methodology-v1';

// Re-export the SHARED_PREAMBLE pattern by reading it off any v1 prompt.
// (V1 doesn't export the constant, so we reconstruct it via the prefix
// shared by every v1 prompt — everything before the first occurrence of
// "Extraction Task:".)
const sampleV1Prompt = methodologyV1.indicators[0]!.extractionPromptMd;
const SHARED_PREAMBLE_PLUS_NEWLINES = sampleV1Prompt.slice(
  0,
  sampleV1Prompt.indexOf('Extraction Task:')
);

// Methodology v6.0.0 / ADR-032: PHASE_3_3_PROMPT_OVERRIDES is empty
// (every pillar's prompts now live in methodology-v1.ts as the single
// source of truth). The helper is retained dormant in case a future
// overlay needs the SHARED_PREAMBLE prefix — cleanup deferred to
// ADR-033 alongside the other dormant-infrastructure sweep.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function withPreamble(extractionTask: string): string {
  return SHARED_PREAMBLE_PLUS_NEWLINES + extractionTask;
}

// ────────────────────────────────────────────────────────────────────
// Phase 3.8 / P0.5 — generate the "Allowed values:" enumeration in the
// extraction prompt directly from the field's rubric. Eliminates the
// drift class where the prompt and the rubric disagree on vocabulary
// (the C.3.2 / C.3.1 bug class). The generator is opt-in: existing
// prompts that hand-roll the block keep working, but new prompts and
// rewrites should use `renderAllowedValues` so the prompt and rubric
// are mechanically tied.
//
// Usage:
//   withRubricVocab('C.3.2', C32_REGIONAL_RUBRIC, `
//     Extraction Task: C.3.2 — Public education access for children
//     Question: ...
//     {{ALLOWED_VALUES}}
//     Edge cases: ...
//   `)
// ────────────────────────────────────────────────────────────────────

interface CategoricalRubric {
  categories: Array<{ value: string; score?: number; description?: string }>;
}

export function renderAllowedValues(rubric: CategoricalRubric): string {
  const lines = rubric.categories.map((c) => {
    const desc = c.description ? c.description : '';
    return `"${c.value}": ${desc}`;
  });
  return ['Allowed values:', '', ...lines].join('\n');
}

const ALLOWED_VALUES_MARKER = '{{ALLOWED_VALUES}}';

export function withRubricVocab(
  key: string,
  rubric: CategoricalRubric,
  extractionTask: string
): string {
  if (!extractionTask.includes(ALLOWED_VALUES_MARKER)) {
    throw new Error(
      `withRubricVocab(${key}): prompt body is missing the ${ALLOWED_VALUES_MARKER} marker. Insert it where the "Allowed values:" block should render.`
    );
  }
  const block = renderAllowedValues(rubric);
  return SHARED_PREAMBLE_PLUS_NEWLINES + extractionTask.replace(ALLOWED_VALUES_MARKER, block);
}

/**
 * Phase 3.3 prompt overrides — keyed by indicator code. Only fields
 * classified LLM_MISS in baseline-gaps.csv with a clear, prompt-fixable
 * failure mode appear here. Boundary failures (data lives on a sibling
 * page Stage 0 didn't discover) are documented in
 * docs/prompt-engineering-patterns.md as PROMPT_UNCERTAIN and are NOT
 * rewritten here — the prompt isn't the problem, the page coverage is.
 */
export const PHASE_3_3_PROMPT_OVERRIDES: Record<string, string> = {
  // ────────────────────────────────────────────────────────────────────
  // Pillar A overrides removed in methodology v2.0.0 — the entire
  // Pillar A indicator set has been restructured. The prompts in
  // methodology-v1.ts are now the canonical source of truth for every
  // Pillar A field (no Phase 3.3 overlay). See ADR superseding ADR-016.
  // ────────────────────────────────────────────────────────────────────
  // B.2.1 — Phase 3.6.6 / FIX 3: multi-currency acceptance. Country-agnostic.
  // The original v1 prompt asked for USD-denominated values, but
  // government fee pages publish in local currency (CAD, AUD, GBP,
  // SGD, HKD, NZD, JPY, EUR, etc.). The model returned empty when it
  // saw a local-currency figure. Now we extract the value AS STATED
  // with its currency code; FX conversion happens downstream at score
  // time, not at extraction.
  // ────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────
  // Pillar B overrides removed in methodology v3.0.0 — the entire
  // Pillar B indicator set has been restructured. The prompts in
  // methodology-v1.ts are now the canonical source of truth for every
  // Pillar B field (no Phase 3.3 overlay). See ADR-029.
  // ────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────
  // Pillar C overrides removed in methodology v4.0.0 — the entire
  // Pillar C indicator set has been restructured (renamed to "Benefits"),
  // collapsing rubrics and dropping C.1.4 / C.2.4 entirely. The prompts
  // in methodology-v1.ts are now the canonical source of truth for every
  // Pillar C field (no Phase 3.3 overlay). See ADR-030.
  // ────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────
  // Pillar D overrides removed in methodology v5.0.0 — the entire
  // Pillar D indicator set has been restructured (D dropped from 11 to
  // 5 indicators, sub-factor D.3 retired). The prompts in
  // methodology-v1.ts are now the canonical source of truth for every
  // Pillar D field (no Phase 3.3 overlay). See ADR-031.
  // ────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────
  // Pillar E overrides removed in methodology v6.0.0 — the entire
  // Pillar E indicator set has been restructured (8 → 4 indicators;
  // sub-factor E.3 retired alongside the WGI / V-Dem external-index
  // ingestion path; old E.1.1 severity-weighted count moved to new
  // E.2.1 with normFn change z_score → min_max; old E.1.3 program age
  // moved to new E.1.1; new E.1.2 cumulative approvals introduces the
  // numeric_or_categorical dual-format normFn; new E.2.2 covers
  // suspension history). The prompts in methodology-v1.ts are now the
  // canonical source of truth for every Pillar E field (no Phase 3.3
  // overlay). See ADR-032.
  // ────────────────────────────────────────────────────────────────────
};

// ────────────────────────────────────────────────────────────────────
// PROMPT_UNCERTAIN — fields where the failure mode is BOUNDARY (data
// lives on a sibling page Stage 0 didn't discover) rather than RECALL
// or NEGATIVE_MATCH. The v1 prompt is kept; the underlying issue is
// page coverage, which Phase 3.2 (department-aware discovery) and a
// follow-up "deep-link discovery" pass will address.
//
// These keys are documented but NOT overridden:
//   D.1.3 — physical presence days/year (CAN: lives on PR-residency-
//           obligation page, not on Express Entry eligibility page)
//   D.1.4 — PR retention rules (same — lives on residency-obligation
//           page; the 730-days-in-5 rule for Canada).
//   D.2.2 — total years to citizenship (CAN: 3-of-5 years / 1,095 days
//           lives on the citizenship physical-presence calculator page,
//           which is JS-rendered and the canary scrape returned only the
//           bullet-point summary).
// ────────────────────────────────────────────────────────────────────
export const PHASE_3_3_PROMPT_UNCERTAIN: Record<string, string> = {
  'D.1.3':
    'Boundary failure — data lives on PR-residency-obligation page; Phase 3.2 deep-link discovery needed.',
  'D.1.4':
    'Boundary failure — data lives on PR-residency-obligation page; Phase 3.2 deep-link discovery needed.',
  'D.2.2':
    'Boundary failure — citizenship physical-presence calculator page is JS-rendered; thin scrape on canary.',
};

// ────────────────────────────────────────────────────────────────────
// Phase 3.5 / ADR-014 — APPROVED indicator dispositions.
//
// Five indicators are restructured:
//   B.2.3 — numeric → boolean_with_annotation (hasLevy + notes).
//   B.2.4 — numeric → boolean_with_annotation (hasMandatoryNonGovCosts + notes).
//   D.1.3 — numeric → boolean_with_annotation (required + daysPerYear + notes).
//   D.1.4 — numeric → boolean_with_annotation (required + daysPerYear + notes).
//   C.3.2 — categorical → country_substitute_regional (regional default
//           value when LLM extraction returns empty).
//
// Sub-factor weights are unchanged: each restructured indicator stays
// in its original sub-factor with its original weight. The data-type
// change does not require weight re-normalization.
//
// Each indicator override below specifies:
//   - dataType: 'json' for boolean_with_annotation; 'categorical' for C.3.2.
//   - normalizationFn: 'boolean_with_annotation' or 'country_substitute_regional'.
//   - direction: lower_is_better (presence of levy/cost/requirement is a penalty)
//     for B.2.3/B.2.4/D.1.3/D.1.4; higher_is_better for C.3.2 (more access better).
//   - scoringRubricJsonb: replaced for boolean_with_annotation with a
//     two-entry rubric so the dashboard can render rubric-aware
//     (the engine itself reads the structured boolean directly via
//     BOOLEAN_WITH_ANNOTATION_KEYS, not the rubric).
//   - extractionPromptMd: requests the structured JSON output shape.
// ────────────────────────────────────────────────────────────────────

interface MethodologyV1Indicator {
  key: string;
  label: string;
  dataType: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: number;
  extractionPromptMd: string;
  scoringRubricJsonb: unknown;
  normalizationFn: string;
  direction: string;
  sourceTierRequired: number;
}

interface IndicatorRestructure {
  dataType: string;
  normalizationFn: string;
  direction: string;
  scoringRubricJsonb: unknown;
  extractionPromptMd: string;
}

// Methodology v5.0.0 / ADR-031 — orphaned alongside C32_REGIONAL_RUBRIC
// after the last boolean_with_annotation field (D.1.4) retired.
// Retained dormant pending ADR-032 cleanup.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STRUCTURED_BOOL_RUBRIC = {
  categories: [
    { value: 'true', score: 0, description: 'requirement / charge present (penalised)' },
    { value: 'false', score: 100, description: 'no requirement / charge (best case)' },
  ],
};

// Phase 3.8 / P0 reconciliation — the 4-value rubric is the single
// source of truth for C.3.2 vocabulary. REGIONAL_SUBSTITUTES (in
// packages/scoring/src/normalize.ts) writes a *subset* of these values
// (automatic for OECD, fee_paying for GCC) when extraction is empty;
// LLM-extracted values can be any of the four, scored via the rubric.
// 100 / 40 are analyst-set; 20 / 0 fill the gradient for restricted / none.
//
// Methodology v4.0.0 / ADR-030: C.3.2 reverted to plain categorical;
// this rubric is dormant. Retained alongside the rest of the
// country_substitute_regional infrastructure (REGIONAL_SUBSTITUTES,
// executeCountrySubstitute, engine branch) per §k.4 — cleanup deferred.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const C32_REGIONAL_RUBRIC = {
  categories: [
    {
      value: 'automatic',
      score: 100,
      description: 'public schooling available on the same basis as citizens/PRs.',
    },
    {
      value: 'fee_paying',
      score: 40,
      description: 'access available but foreign-student or fee-paying levy applies.',
    },
    {
      value: 'restricted',
      score: 20,
      description: 'case-by-case basis or local-authority approval, not guaranteed.',
    },
    {
      value: 'none',
      score: 0,
      description: 'no access to public education.',
    },
  ],
};

export const PHASE_3_5_INDICATOR_RESTRUCTURES: Record<string, IndicatorRestructure> = {
  // Methodology v5.0.0 (ADR-031): the entire PHASE_3_5_INDICATOR_RESTRUCTURES
  // map is empty.
  //   - B.2.3 / B.2.4 retired in v3.0.0 (ADR-029)
  //   - C.3.2 country_substitute_regional reverted to plain categorical in v4.0.0 (ADR-030)
  //   - D.1.3 / D.1.4 retired in v5.0.0 (ADR-031)
  //
  // The boolean_with_annotation and country_substitute_regional engine
  // infrastructure is left in place dormant; cleanup deferred to ADR-032.
};

/**
 * Apply Phase 3.5 indicator restructures on top of an indicator with
 * Phase 3.3 prompt overrides already applied.
 */
function applyPhase3_5(ind: MethodologyV1Indicator): MethodologyV1Indicator {
  const restructure = PHASE_3_5_INDICATOR_RESTRUCTURES[ind.key];
  if (!restructure) return ind;
  return {
    ...ind,
    dataType: restructure.dataType,
    normalizationFn: restructure.normalizationFn,
    direction: restructure.direction,
    scoringRubricJsonb: restructure.scoringRubricJsonb,
    extractionPromptMd: restructure.extractionPromptMd,
  };
}

/**
 * Compose v2 = v1
 *   + Phase 3.3 prompt overrides (applied first)
 *   + Phase 3.5 indicator restructures (applied second).
 *
 * Identical shape to v1 — same indicators array, same per-indicator
 * weights, same sub-factor and pillar weights. Phase 3.5 changes
 * dataType / normalizationFn / direction / scoringRubricJsonb /
 * extractionPromptMd for 5 indicators (B.2.3, B.2.4, D.1.3, D.1.4,
 * C.3.2) but does NOT change weights.
 */
export const methodologyV2 = {
  ...methodologyV1,
  // Phase 3.5 / ADR-014: methodology version bump from 1.0.1 (prompt
  // marker only) to 2.0.0 (data-type changes for 5 indicators).
  version_tag: '2.0.0',
  indicators: methodologyV1.indicators.map((ind) => {
    // Phase 3.3 prompt overlay first.
    const promptOverride = PHASE_3_3_PROMPT_OVERRIDES[ind.key];
    const withPromptV2 = promptOverride ? { ...ind, extractionPromptMd: promptOverride } : ind;
    // Phase 3.5 structural change second (Phase 3.5 prompt replaces 3.3
    // prompt for the 5 restructured fields).
    return applyPhase3_5(withPromptV2);
  }),
};

/** List of indicator keys whose prompts were rewritten in Phase 3.3. */
export const PHASE_3_3_REWRITTEN_KEYS: string[] = Object.keys(PHASE_3_3_PROMPT_OVERRIDES);

/** List of indicator keys whose data-type was restructured in Phase 3.5. */
export const PHASE_3_5_RESTRUCTURED_KEYS: string[] = Object.keys(PHASE_3_5_INDICATOR_RESTRUCTURES);
