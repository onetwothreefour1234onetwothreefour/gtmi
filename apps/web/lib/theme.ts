/**
 * GTMI design tokens.
 *
 * Color and pillar values are duplicated in `tailwind.config.ts` (so utility
 * classes like `bg-pillar-a` work, via CSS custom properties) and
 * `app/globals.css` (the design tokens). This file is the JS/TS-side
 * reference for any component that needs the raw values — for example, a
 * Recharts `<Radar>` fill prop that can't read a Tailwind class.
 *
 * Source of truth: docs/design/styles.css. Light-only after the Phase 4
 * redesign — dark-mode tokens removed (analyst decision Q2).
 */

export const PILLAR_COLORS = {
  A: '#5C4A2E',
  B: '#846A3F',
  C: '#4F6B3E',
  D: '#2C4159',
  E: '#6E3A2E',
} as const;

export type PillarKey = keyof typeof PILLAR_COLORS;

/**
 * Canonical pillar display labels (methodology v6.0.0 / ADR-028..032).
 * Single source of truth — every component imports from here so the
 * next pillar rename is one diff, not nine.
 */
export const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Product Design',
  B: 'Process Design',
  C: 'Benefits',
  D: 'Pathway',
  E: 'Performance Outcomes',
};

/** Stable display order (used by every pillar strip / radar / table). */
export const PILLAR_ORDER: readonly PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Canonical sub-factor display labels (methodology v6.0.0). Keyed on
 * the sub-factor code as it appears in `field_definitions.subfactor_code`
 * and in `methodology_versions.framework.subFactors[].code`.
 */
export const SUB_FACTOR_LABEL: Record<string, string> = {
  'A.1': 'Qualification Threshold',
  'A.2': 'System Design',
  'A.3': 'Volume',
  'B.1': 'Speed',
  'B.2': 'Complexity',
  'B.3': 'Cost',
  'B.4': 'Transparency',
  'C.1': 'Work Flexibility',
  'C.2': 'Family',
  'C.3': 'Social Access',
  'D.1': 'Permanent Residency',
  'D.2': 'Citizenship',
  'E.1': 'Track Record',
  'E.2': 'Rule Stability',
};

/** Sequential score scale, low → high. Higher score = better. */
export const SCORE_SCALE = ['#FCEEC9', '#E8B17A', '#C46A4A', '#9C3F2A', '#7A2A1F'] as const;

/** Map a 0–100 score to a 1–5 bucket index into SCORE_SCALE. */
export function scoreBucket(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score < 20) return 0;
  if (score < 40) return 1;
  if (score < 60) return 2;
  if (score < 80) return 3;
  return 4;
}

/** Resolve a 0–100 score to its sequential color. Null/undefined → muted grey. */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#D4D4D4';
  return SCORE_SCALE[scoreBucket(score)];
}

/** Editorial accent — oxblood. Used for headlines, score-change emphasis,
 *  focus rings, and the pre-cal chip family. */
export const ACCENT_OXBLOOD = '#B8412A';

/** Pre-calibration chip palette. Light-only. */
export const PRE_CALIBRATION = {
  fg: '#B8862A',
  bg: '#FBF3DC',
} as const;
