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
  // (below) covers E.1.1 with similar geography. Re-add an OECD source once the
  // site stabilises and a stable URL is confirmed.
  {
    url: 'https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-talent-ranking/',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Country-level talent competitiveness and appeal scores',
    fieldKeys: ['E.1.1', 'E.3.2'],
  },
  {
    url: 'https://www.migrationpolicy.org/programs/migration-data-hub',
    tier: 2,
    geographicLevel: 'global',
    reason: 'Cross-country immigration policy tracking and changes',
    fieldKeys: ['E.1.1'],
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
  {
    url: 'https://www.ato.gov.au/individuals-and-families/coming-to-australia-or-going-overseas/your-tax-residency',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'ATO tax residency tests — D.3.1 (residency trigger days), D.3.3 (territorial vs worldwide)',
    fieldKeys: ['D.3.1', 'D.3.3'],
    country: 'AUS',
  },
  {
    url: 'https://www.ato.gov.au/individuals-and-families/coming-to-australia-or-going-overseas/your-tax-residency/foreign-and-temporary-residents',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'ATO foreign and temporary resident tax — D.3.1, D.3.2 (special regime: temp resident foreign-source income exemption), D.3.3',
    fieldKeys: ['D.3.1', 'D.3.2', 'D.3.3'],
    country: 'AUS',
  },
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
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.4', 'C.2.1', 'C.2.2', 'C.2.3'],
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
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.4', 'C.2.1', 'C.2.2', 'C.2.3', 'C.3.1', 'C.3.2'],
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
    fieldKeys: ['C.1.1', 'C.1.2', 'C.1.4', 'C.2.1', 'C.2.2', 'C.2.3'],
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

export const ISO3_TO_ISO2: Record<string, string> = {
  AUS: 'AU',
  AUT: 'AT',
  BEL: 'BE',
  BHR: 'BH',
  CAN: 'CA',
  CHE: 'CH',
  CHL: 'CL',
  DEU: 'DE',
  DNK: 'DK',
  ESP: 'ES',
  EST: 'EE',
  FIN: 'FI',
  FRA: 'FR',
  GBR: 'GB',
  HKG: 'HK',
  HUN: 'HU',
  IND: 'IN',
  IRL: 'IE',
  ISL: 'IS',
  ISR: 'IL',
  ITA: 'IT',
  JPN: 'JP',
  KOR: 'KR',
  LTU: 'LT',
  LUX: 'LU',
  MYS: 'MY',
  NAM: 'NA',
  NLD: 'NL',
  NOR: 'NO',
  NZL: 'NZ',
  OMN: 'OM',
  POL: 'PL',
  PRT: 'PT',
  SAU: 'SA',
  SGP: 'SG',
  SVK: 'SK',
  SVN: 'SI',
  SWE: 'SE',
  TWN: 'TW',
  UAE: 'AE',
  USA: 'US',
  ZAF: 'ZA',
  CZE: 'CZ',
  GRC: 'GR',
  MEX: 'MX',
  THA: 'TH',
  IDN: 'ID',
  PHL: 'PH',
  VNM: 'VN',
  QAT: 'QA',
  KWT: 'KW',
  JOR: 'JO',
  KAZ: 'KZ',
  ROU: 'RO',
  BGR: 'BG',
  HRV: 'HR',
  LVA: 'LV',
  MKD: 'MK',
  MNE: 'ME',
  SRB: 'RS',
  ALB: 'AL',
  BIH: 'BA',
  MDA: 'MD',
  UKR: 'UA',
  GEO: 'GE',
  ARM: 'AM',
  AZE: 'AZ',
  BLR: 'BY',
  KGZ: 'KG',
  TJK: 'TJ',
  TKM: 'TM',
  UZB: 'UZ',
  MNG: 'MN',
  CHN: 'CN',
  RUS: 'RU',
  BRA: 'BR',
  ARG: 'AR',
  COL: 'CO',
  PER: 'PE',
  ECU: 'EC',
  BOL: 'BO',
  PRY: 'PY',
  URY: 'UY',
  VEN: 'VE',
  GTM: 'GT',
  HND: 'HN',
  SLV: 'SV',
  NIC: 'NI',
  CRI: 'CR',
  PAN: 'PA',
  DOM: 'DO',
  CUB: 'CU',
  JAM: 'JM',
  TTO: 'TT',
  BRB: 'BB',
  EGY: 'EG',
  MAR: 'MA',
  TUN: 'TN',
  DZA: 'DZ',
  LBY: 'LY',
  SDN: 'SD',
  ETH: 'ET',
  KEN: 'KE',
  TZA: 'TZ',
  UGA: 'UG',
  GHA: 'GH',
  NGA: 'NG',
  ZMB: 'ZM',
  ZWE: 'ZW',
  BWA: 'BW',
  MOZ: 'MZ',
  AGO: 'AO',
  CMR: 'CM',
  CIV: 'CI',
  SEN: 'SN',
  PAK: 'PK',
  BGD: 'BD',
  LKA: 'LK',
  NPL: 'NP',
  MMR: 'MM',
  KHM: 'KH',
  LAO: 'LA',
  BRN: 'BN',
  TLS: 'TL',
  PNG: 'PG',
  FJI: 'FJ',
  WSM: 'WS',
  TON: 'TO',
  VUT: 'VU',
  SLB: 'SB',
  IRN: 'IR',
  IRQ: 'IQ',
  SYR: 'SY',
  LBN: 'LB',
  PSE: 'PS',
  YEM: 'YE',
  AFG: 'AF',
  TUR: 'TR',
  CYP: 'CY',
  MLT: 'MT',
};

export async function fetchWgiScore(
  countryIso3: string
): Promise<{ score: string; year: string; countryName: string } | null> {
  const iso2 = ISO3_TO_ISO2[countryIso3];
  if (!iso2) {
    console.warn(`[WGI] No ISO2 mapping found for ${countryIso3}`);
    return null;
  }
  const url = `https://api.worldbank.org/v2/country/${iso2}/indicator/GOV_WGI_GE.EST?format=json&mrv=1&source=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown[];
    const record = (json?.[1] as unknown[])?.[0] as
      | {
          value?: number | null;
          date?: string;
          country?: { value?: string };
        }
      | undefined;
    if (!record || record.value === null || record.value === undefined) return null;
    return {
      score: String(Math.round(record.value * 100) / 100),
      year: String(record.date),
      countryName: record.country?.value ?? countryIso3,
    };
  } catch {
    return null;
  }
}

// Phase 3.6.1 / FIX 1 — manual live-API validation command for the
// WGI indicator codes (run when refactoring this file or upgrading
// the World Bank API client). Cannot be a vitest unit test because
// scripts/ is outside any package's tsconfig rootDir.
//
//   pnpm exec tsx -e "import { fetchVdemRuleOfLawScore, fetchWgiScore } \
//     from './scripts/country-sources'; (async () => { \
//     for (const iso of ['AUS','SGP','CAN','GBR','HKG']) { \
//       const ge = await fetchWgiScore(iso); \
//       const rl = await fetchVdemRuleOfLawScore(iso); \
//       console.log(iso, 'GE.EST=', ge?.score, 'RL.EST=', rl?.score); \
//     } })();"
//
// Both fetchers must return numeric scores. The bug fixed in FIX 1 was
// the indicator-code prefix: `RL.EST` returns "indicator not found",
// `GOV_WGI_RL.EST` (the source=3 form) returns the data.
//
// Phase 3.6 / Fix A — E.3.1 Rule of Law direct fetch.
//
// Methodology v1 line 309 specifies E.3.1 as "Rule of law (V-Dem / World
// Bank WGI)". Both are accepted; we use the World Bank WGI Rule of Law
// indicator (`RL.EST`) because it has the same fetch shape, latency, and
// availability profile as the existing E.3.2 (`GE.EST`) path. V-Dem's
// `v2x_rule` series can be wired later as a cross-check; for the canary
// the WGI value is the deterministic primary source.
//
// Gate: `PHASE3_VDEM_ENABLED` env var (default true post-commit-3 per
// analyst Q5 decision). When false/unset, `executeE31VdemFetch` returns
// null and the field falls through to the LLM extraction batch (which
// will produce empty for ABSENT countries — same as today).
export async function fetchVdemRuleOfLawScore(
  countryIso3: string
): Promise<{ score: string; year: string; countryName: string } | null> {
  const iso2 = ISO3_TO_ISO2[countryIso3];
  if (!iso2) {
    console.warn(`[VDEM/WGI-RL] No ISO2 mapping found for ${countryIso3}`);
    return null;
  }
  // WGI indicators under source=3 (Worldwide Governance Indicators) require
  // the GOV_WGI_ prefix. The bare `RL.EST` returns "indicator not found";
  // verified empirically against the API. E.3.2 already uses GOV_WGI_GE.EST.
  const url = `https://api.worldbank.org/v2/country/${iso2}/indicator/GOV_WGI_RL.EST?format=json&mrv=1&source=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown[];
    const record = (json?.[1] as unknown[])?.[0] as
      | {
          value?: number | null;
          date?: string;
          country?: { value?: string };
        }
      | undefined;
    if (!record || record.value === null || record.value === undefined) return null;
    return {
      score: String(Math.round(record.value * 100) / 100),
      year: String(record.date),
      countryName: record.country?.value ?? countryIso3,
    };
  } catch {
    return null;
  }
}

export async function fetchAllWgiScores(
  countryIsos: string[]
): Promise<Map<string, { score: string; year: string; countryName: string }>> {
  const results = new Map<string, { score: string; year: string; countryName: string }>();
  for (const iso3 of countryIsos) {
    const result = await fetchWgiScore(iso3);
    if (result) {
      results.set(iso3, result);
      console.log(`  [WGI] ${iso3}: ${result.score} (${result.year})`);
    } else {
      console.warn(`  [WGI] ${iso3}: no score returned`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}
