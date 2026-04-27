/**
 * GTMI design tokens.
 *
 * Color and pillar values are duplicated in `tailwind.config.ts` (so utility
 * classes like `bg-pillar-a` work) and `app/globals.css` (so HSL CSS variables
 * drive light/dark theming). This file is the JS/TS-side reference for any
 * component that needs the raw values — for example, a Recharts `<Radar>`
 * fill prop that can't read a Tailwind class.
 *
 * Keep these in sync with the dispatch §7 design language and `tailwind.config.ts`.
 */

export const PILLAR_COLORS = {
  A: '#3D5A80',
  B: '#98C1D9',
  C: '#5C8A9B',
  D: '#EE6C4D',
  E: '#293241',
} as const;

export type PillarKey = keyof typeof PILLAR_COLORS;

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

export const ACCENT_DEEP_TEAL = '#0F4C5C';

export const PRE_CALIBRATION = {
  light: { fg: '#A66A00', bg: '#FFF6E6' },
  dark: { fg: '#FFC971', bg: '#33260D' },
} as const;
