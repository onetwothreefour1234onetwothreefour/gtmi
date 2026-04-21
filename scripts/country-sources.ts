export interface CountryLevelSource {
  url: string;
  tier: 1 | 2;
  geographicLevel: 'global' | 'continental' | 'national';
  reason: string;
  fieldKeys: string[];
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
];

export function getCountryLevelSources(fieldKey: string): CountryLevelSource[] {
  return COUNTRY_LEVEL_SOURCES.filter((s) => s.fieldKeys.includes(fieldKey));
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
    const json = await res.json();
    const record = json?.[1]?.[0];
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
