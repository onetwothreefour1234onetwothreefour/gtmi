// Phase 3.9 / W5 — per-program curated discovery hints.
//
// Empty by default. Populated only for the ~20% of programmes where
// generic Stage 0 discovery (W3 cross-departmental + W4 native-
// language acceptance) underperforms because the substantive policy
// detail lives in a non-obvious place (a PDF annex, a separate
// authority, a less-discoverable subdomain).
//
// Each entry is a free-form English hint inlined into the Stage 0
// Perplexity prompt as a "PROGRAMME-SPECIFIC HINT" block. Perplexity
// treats it as authoritative context: it WILL prioritise the named
// resources over what generic ranking would surface.
//
// Curation workflow:
//   1. Run a canary against the programme.
//   2. If coverage < 42/48, identify which fields are absent and
//      WHERE the answer actually lives (often a different domain
//      from the immigration authority).
//   3. Write a 1-3 sentence hint naming the specific page / PDF /
//      authority. Keep it short — the prompt budget matters.
//   4. Add an entry below.
//   5. Re-run with --mode narrow to validate the hint moved
//      coverage.
//
// Steady state: ~15-20 entries across the 85-programme cohort.
// Programmes with generic-discoverable policy data don't need an
// entry. The lookup returns null for unknown programIds and
// renderProgramDiscoveryHint returns the empty string, so the prompt
// stays clean for the unmapped majority.

export interface ProgramDiscoveryHint {
  programId: string;
  /** Human-friendly name for log lines and admin tooling — not part of the prompt. */
  programName: string;
  /** The hint text that gets inlined into the Stage 0 prompt. Markdown OK. */
  hint: string;
  /** Free-form note for the curator (not used at runtime). */
  curatorNote?: string;
}

export const PROGRAM_DISCOVERY_HINTS: Record<string, ProgramDiscoveryHint> = {
  // NLD — Highly Skilled Migrant (HSM) Permit
  // First-canary outcome (2026-04-30): coverage 38/48; A.1.1 / B.1.1 /
  // B.2.2 missed because the IND main /residence-permits/work/highly-
  // skilled-migrant page returned thin content (anti-bot or SPA shell).
  // D.3.x missed because Belastingdienst was not surfaced.
  '668cec08-4b78-4cd2-b215-3047c551ce6e': {
    programId: '668cec08-4b78-4cd2-b215-3047c551ce6e',
    programName: 'Highly Skilled Migrant (HSM) Permit',
    hint:
      "IND's main HSM landing page (ind.nl/en/residence-permits/work/highly-skilled-migrant) " +
      'often loads thin under headless scraping. Prioritise IND sub-pages — fees ' +
      '(ind.nl/en/forms), salary thresholds (ind.nl/en/normbedragen), and ' +
      'kennismigrant policy at government.nl. For tax residency / 30%-ruling, ' +
      'belastingdienst.nl/wps/wcm/connect/EN/Content_Areas/Individuals/30_facility ' +
      'is the canonical English-language source. CBS publishes the median wage ' +
      'data backing A.1.2 derivation.',
    curatorNote: 'Added 2026-04-30 after first canary returned 38/48.',
  },

  // JPN — Highly Skilled Professional Visa (HSP)
  // First-canary outcome (2026-04-30): coverage 17/48; ISA English HSP
  // pages are summary-only. Substantive points-system data is in a
  // Japanese-language PDF on isa.go.jp; tax-residency rule is on NTA
  // in Japanese; naturalisation rules are on MOJ in Japanese.
  // Translation pipeline (W2) handles the Japanese pages once Stage 0
  // surfaces them.
  'a9f779f7-4384-420d-affe-ba269c87108e': {
    programId: 'a9f779f7-4384-420d-affe-ba269c87108e',
    programName: 'Highly Skilled Professional Visa (HSP)',
    hint:
      "ISA's English HSP pages are summary only — substantive content " +
      'lives in Japanese-language PDFs on isa.go.jp/jp/publications and on the ' +
      'isa.go.jp/jp/applications/procedures/16-1.html points-calculation table. ' +
      'For tax residency (D.3.x), use nta.go.jp/taxes/shiraberu/taxanswer/gaikoku ' +
      '(Japanese). For naturalisation (D.2.x), use moj.go.jp/MINJI/minji78.html ' +
      '(Japanese). The downstream translation pipeline will translate any ' +
      'Japanese-only pages to English.',
    curatorNote: 'Added 2026-04-30 after first canary returned 17/48.',
  },
};

/** Returns the hint entry for a programId, or null if no entry exists. */
export function getProgramDiscoveryHint(programId: string): ProgramDiscoveryHint | null {
  return PROGRAM_DISCOVERY_HINTS[programId] ?? null;
}

/**
 * Render a programme-specific hint as a Stage 0 prompt block. Returns
 * the empty string when no hint is registered for the programme so the
 * Perplexity prompt stays clean for the unmapped majority.
 *
 * Format mirrors the W3 / W4 blocks in discover.ts so the LLM treats
 * it as just-another-instruction-section rather than ambiguous text.
 */
export function renderProgramDiscoveryHint(programId: string): string {
  const entry = getProgramDiscoveryHint(programId);
  if (!entry) return '';
  return (
    `\n\nPROGRAMME-SPECIFIC HINT for "${entry.programName}" — these resources ` +
    `have historically produced field-level data that generic discovery missed; ` +
    `prioritise them in your URL set:\n${entry.hint}\n\n`
  );
}
