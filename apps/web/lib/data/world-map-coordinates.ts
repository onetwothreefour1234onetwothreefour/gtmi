/**
 * Hand-laid dot-matrix coordinates for the landing-page world map.
 * Translated from docs/design/screen-rankings-v2.jsx.
 *
 * Each entry is a country dot at column/row position. Multiple dots per
 * country (e.g. CAN, USA, BRA, JPN, AUS) shape the silhouette. The grid
 * is 17 cols × 12 rows; cellSize is 18px.
 *
 * Per analyst Q6 the world map ships in Phase B. We render every cohort
 * country's top-scoring composite as a coloured dot; non-cohort dots are
 * drawn but shown muted so the geography reads.
 */

export interface WorldMapDot {
  /** Column position (0–17). */
  col: number;
  /** Row position (0–12). */
  row: number;
  /** ISO-3 code; matches `countries.iso_code` for live joins. */
  iso: string;
  /** Human-readable name (used for tooltips). */
  name: string;
}

export const WORLD_MAP_GRID = {
  cols: 17,
  rows: 12,
  cellSize: 18,
} as const;

export const WORLD_MAP_DOTS: readonly WorldMapDot[] = [
  // North America
  { col: 3, row: 3, iso: 'CAN', name: 'Canada' },
  { col: 3, row: 4, iso: 'CAN', name: 'Canada' },
  { col: 4, row: 4, iso: 'USA', name: 'United States' },
  { col: 3, row: 5, iso: 'USA', name: 'United States' },
  { col: 4, row: 5, iso: 'USA', name: 'United States' },
  { col: 3, row: 6, iso: 'MEX', name: 'Mexico' },
  // South America
  { col: 5, row: 8, iso: 'BRA', name: 'Brazil' },
  { col: 5, row: 9, iso: 'BRA', name: 'Brazil' },
  { col: 4, row: 9, iso: 'CHL', name: 'Chile' },
  { col: 4, row: 10, iso: 'ARG', name: 'Argentina' },
  // Europe
  { col: 9, row: 3, iso: 'ISL', name: 'Iceland' },
  { col: 10, row: 3, iso: 'NOR', name: 'Norway' },
  { col: 10, row: 4, iso: 'SWE', name: 'Sweden' },
  { col: 11, row: 3, iso: 'FIN', name: 'Finland' },
  { col: 9, row: 4, iso: 'IRL', name: 'Ireland' },
  { col: 10, row: 4.5, iso: 'GBR', name: 'United Kingdom' },
  { col: 10, row: 5, iso: 'NLD', name: 'Netherlands' },
  { col: 11, row: 5, iso: 'DEU', name: 'Germany' },
  { col: 11, row: 4, iso: 'EST', name: 'Estonia' },
  { col: 10, row: 5.5, iso: 'BEL', name: 'Belgium' },
  { col: 10, row: 6, iso: 'FRA', name: 'France' },
  { col: 11, row: 6, iso: 'CHE', name: 'Switzerland' },
  { col: 11.5, row: 6, iso: 'AUT', name: 'Austria' },
  { col: 10.5, row: 5.8, iso: 'LUX', name: 'Luxembourg' },
  // MENA / Africa
  { col: 12, row: 7, iso: 'ARE', name: 'United Arab Emirates' },
  { col: 11.5, row: 7, iso: 'SAU', name: 'Saudi Arabia' },
  { col: 11, row: 7, iso: 'EGY', name: 'Egypt' },
  { col: 10, row: 8, iso: 'NGA', name: 'Nigeria' },
  { col: 11, row: 9, iso: 'KEN', name: 'Kenya' },
  { col: 11, row: 10, iso: 'ZAF', name: 'South Africa' },
  // Asia
  { col: 13, row: 5, iso: 'JPN', name: 'Japan' },
  { col: 13, row: 6, iso: 'JPN', name: 'Japan' },
  { col: 13, row: 5.5, iso: 'KOR', name: 'South Korea' },
  { col: 12.5, row: 6, iso: 'HKG', name: 'Hong Kong' },
  { col: 13, row: 7, iso: 'SGP', name: 'Singapore' },
  { col: 12, row: 7.5, iso: 'IND', name: 'India' },
  { col: 12.5, row: 5, iso: 'CHN', name: 'China' },
  // Oceania
  { col: 14, row: 9, iso: 'AUS', name: 'Australia' },
  { col: 14.5, row: 9.5, iso: 'AUS', name: 'Australia' },
  { col: 15, row: 10, iso: 'NZL', name: 'New Zealand' },
];

/** Quintile bucket from a 0–100 composite score. Mirrors the design. */
export function compositeQuintile(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 70) return 5;
  if (score >= 60) return 4;
  if (score >= 50) return 3;
  if (score >= 40) return 2;
  return 1;
}

/** Colours for each quintile, matching docs/design/screen-rankings-v2.jsx. */
export const QUINTILE_COLORS = {
  5: 'var(--accent)',
  4: '#D27F66',
  3: '#C9A48E',
  2: '#B5A687',
  1: '#9C9275',
} as const;

/** Muted colour for non-cohort countries (no score available). */
export const MUTED_DOT_COLOR = 'var(--paper-3)';
