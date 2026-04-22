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
  {
    url: 'https://www.oecd.org/en/topics/policy-issues/international-migration.html',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Policy stability, immigration trend data by country',
    fieldKeys: ['E.1.1'],
  },
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
  // All URLs HEAD-checked 2026-04-22. 404s were removed.
  {
    url: 'https://www.servicesaustralia.gov.au/who-can-enrol-in-medicare',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Medicare enrolment eligibility for visa holders — public healthcare access for C.3.1',
    fieldKeys: ['C.3.1'],
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
    reason: 'FSW eligibility: salary, points, experience requirements — A.1.1, A.2.2, A.2.3',
    fieldKeys: ['A.1.1', 'A.2.2', 'A.2.3'],
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
    reason: 'Express Entry fee schedule — B.2.1 (principal fees)',
    fieldKeys: ['B.2.1', 'B.2.2'],
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
    reason: 'Skilled Worker salary thresholds and job eligibility — A.1.1, A.2.1, A.2.3',
    fieldKeys: ['A.1.1', 'A.2.1', 'A.2.3'],
    country: 'GBR',
  },
  {
    url: 'https://www.gov.uk/skilled-worker-visa/fees',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Skilled Worker visa fees and Immigration Health Surcharge — B.2.1, B.2.2',
    fieldKeys: ['B.2.1', 'B.2.2'],
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
  // HEAD-checked 2026-04-22.
  {
    url: 'https://www.mom.gov.sg/passes-and-permits/s-pass/eligibility',
    tier: 1,
    geographicLevel: 'national',
    reason:
      'S Pass eligibility: min salary SGD 3,150/mo, diploma-equivalent qualifications — A.1.1, A.2.2, A.3.2, B.1.1',
    fieldKeys: ['A.1.1', 'A.2.2', 'A.3.2', 'B.1.1'],
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
    reason: 'S Pass employer levy and quota — employer cost proxy for B.2.2',
    fieldKeys: ['B.2.2'],
    country: 'SGP',
  },
  {
    url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates',
    tier: 1,
    geographicLevel: 'national',
    reason: 'Singapore personal income tax rates — B.2.1 (effective tax burden)',
    fieldKeys: ['B.2.1'],
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
  countryIso3: string,
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

export async function fetchAllWgiScores(
  countryIsos: string[],
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
