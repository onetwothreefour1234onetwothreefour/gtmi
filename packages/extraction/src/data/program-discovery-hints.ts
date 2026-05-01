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
  // 2026-05-01 update: post PRs F-I the gap is 4/48 (A.1.1, A.1.2,
  // B.2.2, D.3.1). D.3.1 is structurally null (NLD uses facts-and-
  // circumstances residency, no day-count). The remaining three need
  // sharper steering to specific IND sub-pages that DID load thin in
  // the last run despite already being mentioned in the hint.
  '668cec08-4b78-4cd2-b215-3047c551ce6e': {
    programId: '668cec08-4b78-4cd2-b215-3047c551ce6e',
    programName: 'Highly Skilled Migrant (HSM) Permit',
    hint:
      "IND's main HSM landing page (ind.nl/en/residence-permits/work/highly-skilled-migrant) " +
      'loads thin under headless scraping. The salary thresholds (A.1.1) live on the ' +
      'normbedragen page — the canonical URL in 2026 is ' +
      'ind.nl/en/required-amounts-income-requirement (English) which mirrors ' +
      'ind.nl/nl/normbedragen-inkomenseis. Application fees (B.2.2) live on ' +
      'ind.nl/en/fees, and the formal kennismigrant policy on ' +
      'government.nl/topics/new-in-the-netherlands/highly-skilled-migrants. For ' +
      'tax residency / 30%-ruling background, ' +
      'belastingdienst.nl/wps/wcm/connect/EN/Content_Areas/Individuals/30_facility ' +
      'is canonical. CBS publishes the median wage data backing A.1.2 derivation.',
    curatorNote: 'Updated 2026-05-01: split out the salary threshold + fees URLs.',
  },

  // JPN — Highly Skilled Professional Visa (HSP)
  // 2026-04-30 first canary: 17/48. 2026-05-01 second canary post W15:
  // 23/48 with www.isa.go.jp auto-flagged as a hash_equality blocker.
  // Wayback also has no useful snapshots for ISA HSP pages. Pivot the
  // hint AWAY from isa.go.jp entirely — substantive HSP content is
  // also published on JETRO (English investor portal), the Cabinet
  // Office HSP page, MOFA visa procedure pages, and METI talent-policy
  // briefs. None of these are on isa.go.jp.
  'a9f779f7-4384-420d-affe-ba269c87108e': {
    programId: 'a9f779f7-4384-420d-affe-ba269c87108e',
    programName: 'Highly Skilled Professional Visa (HSP)',
    hint:
      'IMPORTANT: avoid isa.go.jp — all paths on that domain serve an anti-bot ' +
      'interstitial that cannot be scraped (auto-flagged in blocker_domains). ' +
      'Substantive HSP information is also published OFF the ISA domain. Use these ' +
      'sources instead:\n' +
      '  - jetro.go.jp/en/invest/setting_up/laws/section3/page9.html (JETRO, English) ' +
      'covers the HSP points table, salary tiers, and PR fast-track tiers.\n' +
      '  - mofa.go.jp/j_info/visit/visa/long/index.html (MOFA, Japanese) for visa ' +
      'application procedures and required documents.\n' +
      '  - cao.go.jp/keizai1/pdf/202304_hsp.pdf (Cabinet Office briefing) for the ' +
      'J-Skip / J-Find supplementary tracks launched April 2023.\n' +
      '  - meti.go.jp/policy/external_economy/trade_control/05_hsp/ (METI) for ' +
      'talent-policy framework and recent reforms.\n' +
      '  - For tax residency (D.3.x), nta.go.jp/english/taxes/individual/12005.htm ' +
      '(English NTA page) is the canonical source.\n' +
      '  - For naturalisation (D.2.x), moj.go.jp/EN/MINJI/minji78.html (English MOJ) ' +
      'covers civic test burden and citizenship-residence years.\n' +
      'The translation pipeline (W2) handles any Japanese-only pages.',
    curatorNote: 'Updated 2026-05-01 after W15 flagged isa.go.jp; pivoted to non-ISA sources.',
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
