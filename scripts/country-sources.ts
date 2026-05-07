export interface CountryLevelSource {
  url: string;
  tier: 1 | 2;
  geographicLevel: 'global' | 'continental' | 'national';
  reason: string;
  fieldKeys: string[];
  /** ISO3 country code — if set, source is only used for this country. Omit for global sources. */
  country?: string;
}

export const COUNTRY_LEVEL_SOURCES: CountryLevelSource[] = [
  // OECD migration pages were removed 2026-04-26 — every probed path under
  // oecd.org/en/topics/.../migration returned a soft-404 ("the requested page
  // cannot be found") during the OECD site migration. Migration Policy Institute
  // (below) covers E.2.1 (severity-weighted policy changes) with similar
  // geography. Re-add an OECD source once the site stabilises and a stable URL
  // is confirmed. Methodology v6.0.0 / ADR-032: E.3.2 retired; the IMD source
  // now serves E.2.1 only.
  {
    url: 'https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-talent-ranking/',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Country-level talent competitiveness and policy-change context for E.2.1',
    fieldKeys: ['E.2.1'],
  },
  {
    url: 'https://www.migrationpolicy.org/programs/migration-data-hub',
    tier: 2,
    geographicLevel: 'global',
    reason: 'Cross-country immigration policy tracking and changes (E.2.1)',
    fieldKeys: ['E.2.1'],
  },
  // AUS national-level sources — only scraped for Australian programs.
  // URLs re-validated 2026-04-26: stale soft-404s replaced; ATO tax sources added.
  {
    url: 'https://www.servicesaustralia.gov.au/medicare',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Medicare overview — public healthcare access for C.3.1',
    fieldKeys: ['C.3.1'],
    country: 'AUS',
  },
  // ATO tax-residency entries (D.3.1, D.3.2, D.3.3) removed in
  // methodology v5.0.0 (ADR-031) — Pillar D no longer measures tax.
  {
    url: 'https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/permanent-resident',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'Citizenship from PR — residency/time requirements for D.2.2 (years to citizenship eligibility)',
    fieldKeys: ['D.2.2'],
    country: 'AUS',
  },
  {
    url: 'https://immi.homeaffairs.gov.au/visas/already-have-a-visa/check-visa-details-and-conditions/see-your-visa-conditions?product=482',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'Visa conditions detail page for 482 — covers family members, work/study rights (C.1.x, C.2.x)',
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.3', 'C.2.1', 'C.2.2', 'C.2.3'],
    country: 'AUS',
  },
  {
    url: 'https://www.studyaustralia.gov.au/en/plan-your-studies',
    tier: 2,
    geographicLevel: 'national',
    reason: 'Education access for visa holders and dependants — C.3.2',
    fieldKeys: ['C.3.2'],
    country: 'AUS',
  },
  // NOTE: Dedicated "including family" DOHA sub-pages for 482 Core/Specialist returned 404.
  // Family-inclusion data is instead reached via the visa-conditions page above, which links
  // to the relevant family sub-docs. If family fields remain empty after next canary run,
  // the DOHA URL structure has changed again and we need to navigate the live site manually.

  // CAN national-level sources — Express Entry / Federal Skilled Worker.
  {
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'FSW eligibility: salary (% of median), experience, language requirements — A.1.1, A.1.3, A.1.4',
    fieldKeys: ['A.1.1', 'A.1.3', 'A.1.4'],
    country: 'CAN',
  },
  {
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html',
    tier: 1,
    geographicLevel: 'national',
    reason: 'IRCC processing times — B.1.1 (processing days)',
    fieldKeys: ['B.1.1'],
    country: 'CAN',
  },
  {
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence/fees.html',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Express Entry fee schedule — B.3.1 (total applicant cost USD)',
    fieldKeys: ['B.3.1'],
    country: 'CAN',
  },
  {
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/new-life-canada/health-care-card.html',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Provincial health card eligibility for PR/work permit holders — C.3.1',
    fieldKeys: ['C.3.1'],
    country: 'CAN',
  },
  {
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility.html',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Citizenship eligibility: 3 years physical presence in 5 — D.1.2, D.2.2',
    fieldKeys: ['D.1.2', 'D.2.2'],
    country: 'CAN',
  },

  // GBR national-level sources — Skilled Worker Visa.
  {
    url: 'https://www.gov.uk/skilled-worker-visa/your-job',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'Skilled Worker salary thresholds (% of median), education floor, language — A.1.1, A.1.2, A.1.4',
    fieldKeys: ['A.1.1', 'A.1.2', 'A.1.4'],
    country: 'GBR',
  },
  {
    url: 'https://www.gov.uk/skilled-worker-visa/fees',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'Skilled Worker visa fees and Immigration Health Surcharge — B.3.1 (total applicant cost USD)',
    fieldKeys: ['B.3.1'],
    country: 'GBR',
  },
  {
    url: 'https://www.gov.uk/skilled-worker-visa/family-members',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Skilled Worker dependant rights: work, study, healthcare — C.1.x, C.2.x, C.3.x',
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.3', 'C.2.1', 'C.2.2', 'C.2.3', 'C.3.1', 'C.3.2'],
    country: 'GBR',
  },
  {
    url: 'https://www.gov.uk/indefinite-leave-to-remain/skilled-worker-visa',
    tier: 1,
    geographicLevel: 'national',
    reason: 'ILR (PR) eligibility from Skilled Worker — D.1.2 (years to PR)',
    fieldKeys: ['D.1.2'],
    country: 'GBR',
  },
  {
    url: 'https://www.gov.uk/british-citizenship',
    tier: 1,
    geographicLevel: 'national',
    reason: 'British citizenship — D.2.2 (years from arrival to citizenship)',
    fieldKeys: ['D.2.2'],
    country: 'GBR',
  },

  // SGP national-level sources — S Pass program.
  // Last HEAD-checked 2026-04-22; due for re-validation alongside SGP canary run.
  {
    url: 'https://www.mom.gov.sg/passes-and-permits/s-pass/eligibility',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'S Pass eligibility: min salary (% of median), experience, quota — A.1.1, A.1.3, A.3.1, B.1.1',
    fieldKeys: ['A.1.1', 'A.1.3', 'A.3.1', 'B.1.1'],
    country: 'SGP',
  },
  {
    url: 'https://www.mom.gov.sg/passes-and-permits/s-pass/bringing-your-family-to-singapore',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'S Pass dependent pass rights — who qualifies, work/study rights for family (C.1.x, C.2.x)',
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.3', 'C.2.1', 'C.2.2', 'C.2.3'],
    country: 'SGP',
  },
  {
    url: 'https://www.mom.gov.sg/passes-and-permits/s-pass/quota-and-levy',
    tier: 1,
    geographicLevel: 'national',
    reason: 'S Pass employer levy and quota — applicant-cost proxy for B.3.1',
    fieldKeys: ['B.3.1'],
    country: 'SGP',
  },
  {
    url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Singapore personal income tax rates — B.3.1 (applicant cost burden context)',
    fieldKeys: ['B.3.1'],
    country: 'SGP',
  },
  {
    url: 'https://www.ica.gov.sg/reside/PR/apply',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Singapore PR application — eligibility, years of work required (D.2.2)',
    fieldKeys: ['D.2.2'],
    country: 'SGP',
  },
  {
    url: 'https://www.moh.gov.sg/cost-financing/healthcare-schemes-subsidies/medisave',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Medisave scheme — public healthcare access for work pass holders (C.3.1)',
    fieldKeys: ['C.3.1'],
    country: 'SGP',
  },
  {
    url: 'https://www.moe.gov.sg/primary/admissions/register-for-primary-1',
    tier: 1,
    geographicLevel: 'national',
    reason: 'MOE school registration for dependants — C.3.2 (public education access)',
    fieldKeys: ['C.3.2'],
    country: 'SGP',
  },
];

export function getCountryLevelSources(fieldKey: string, country?: string): CountryLevelSource[] {
  return COUNTRY_LEVEL_SOURCES.filter((s) => {
    if (!s.fieldKeys.includes(fieldKey)) return false;
    if (s.country && s.country !== country) return false;
    return true;
  });
}

// Methodology v6.0.0 / ADR-032 — the ISO3_TO_ISO2 map, fetchWgiScore,
// fetchVdemRuleOfLawScore, and fetchAllWgiScores were retired alongside
// the Pillar E restructure. Pillar E no longer ingests external indices
// (E.3.1 / E.3.2 retired); the new E.2.1 (severity-weighted policy
// changes) is LLM-extracted from the same recall hints.
