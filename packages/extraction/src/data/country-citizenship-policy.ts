// Phase 3.6.1 / FIX 6 — country-level dual citizenship policy lookup.
//
// Used by the derive stage (D.2.3) to write a `derived-knowledge` row
// for every cohort country whose policy is publicly known and stable.
// Source preference: each country's citizenship/nationality act or
// official government FAQ — never Wikipedia, never news articles.
//
// `permitted` semantics:
//   true   — country permits its own citizens to hold foreign citizenship
//            simultaneously, including when naturalising as that country's
//            citizen from a foreign nationality.
//   false  — country's citizenship law requires renunciation of prior
//            nationality, OR explicitly bars holding foreign citizenship,
//            OR (for HKG, MAC) operates under a sovereign with a single-
//            nationality regime.
//   null   — policy is contested, partial, or undocumented in a single
//            authoritative source. The derive stage skips writing a row;
//            the missing-data penalty applies.
//
// Refresh discipline: same as country-median-wage.ts. Refresh whenever a
// country amends its citizenship law (rare, surfaces via Phase 6
// living-index policy_changes).

export interface DualCitizenshipPolicy {
  iso3: string;
  permitted: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_DUAL_CITIZENSHIP_POLICY: Record<string, DualCitizenshipPolicy> = {
  // ─────────────────────────────────────────────────────────────────
  // Permitted (20 cohort countries)
  // ─────────────────────────────────────────────────────────────────
  AUS: {
    iso3: 'AUS',
    permitted: true,
    notes:
      'Australia permits dual citizenship since 4 April 2002 (Australian Citizenship Act 2007).',
    sourceUrl: 'https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/dual-citizenship',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    permitted: true,
    notes: 'Canada permits dual citizenship; no renunciation required at naturalisation.',
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/dual-citizenship.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    permitted: true,
    notes:
      'United Kingdom permits dual citizenship; British nationality law does not require renunciation of prior nationality.',
    sourceUrl: 'https://www.gov.uk/dual-citizenship',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    permitted: true,
    notes:
      'Ireland permits dual citizenship; Irish Nationality and Citizenship Acts do not require renunciation.',
    sourceUrl: 'https://www.dfa.ie/citizenship/dual-citizenship/',
    sourceYear: 2023,
  },
  NZL: {
    iso3: 'NZL',
    permitted: true,
    notes: 'New Zealand permits dual citizenship under the Citizenship Act 1977.',
    sourceUrl:
      'https://www.govt.nz/browse/passports-citizenship-and-identity/nz-citizenship/dual-citizenship/',
    sourceYear: 2023,
  },
  FRA: {
    iso3: 'FRA',
    permitted: true,
    notes: 'France permits dual citizenship; no renunciation requirement.',
    sourceUrl: 'https://www.service-public.fr/particuliers/vosdroits/F1051',
    sourceYear: 2024,
  },
  DEU: {
    iso3: 'DEU',
    permitted: true,
    notes:
      'Germany now permits dual citizenship without restriction since the Citizenship Modernisation Act effective 27 June 2024.',
    sourceUrl: 'https://www.bmi.bund.de/SharedDocs/topthemen/EN/topthema-staatsangehoerigkeit.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    permitted: true,
    notes: 'Belgium permits dual citizenship since 28 April 2008.',
    sourceUrl:
      'https://diplomatie.belgium.be/en/services/services-abroad/nationality-and-civil-status/double-or-multiple-nationality',
    sourceYear: 2023,
  },
  NLD: {
    iso3: 'NLD',
    permitted: true,
    notes:
      'Netherlands permits dual citizenship in defined cases (marriage to a Dutch national, hardship, automatic acquisition); 2024 reform expands permitted cases.',
    sourceUrl: 'https://ind.nl/en/dutch-citizenship/dual-nationality',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    permitted: true,
    notes: 'Norway permits dual citizenship since 1 January 2020.',
    sourceUrl: 'https://www.udi.no/en/word-definitions/dual-citizenship/',
    sourceYear: 2023,
  },
  SWE: {
    iso3: 'SWE',
    permitted: true,
    notes: 'Sweden permits dual citizenship since 1 July 2001.',
    sourceUrl:
      'https://www.migrationsverket.se/English/Private-individuals/Becoming-a-Swedish-citizen/Dual-citizenship.html',
    sourceYear: 2023,
  },
  FIN: {
    iso3: 'FIN',
    permitted: true,
    notes: 'Finland permits dual citizenship since 1 June 2003.',
    sourceUrl: 'https://migri.fi/en/dual-citizenship',
    sourceYear: 2023,
  },
  EST: {
    iso3: 'EST',
    permitted: null,
    notes:
      'Estonia formally restricts dual citizenship for naturalised citizens (renunciation required) but tolerates it for those born Estonian. Status is partial; treating as null.',
    sourceUrl: 'https://www.politsei.ee/en/instructions/applying-for-estonian-citizenship',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    permitted: true,
    notes:
      'Lithuania permits dual citizenship in specified categories (returning emigrants and their descendants); 2019 referendum effective.',
    sourceUrl: 'https://migracija.lrv.lt/en/services/citizenship',
    sourceYear: 2023,
  },
  LUX: {
    iso3: 'LUX',
    permitted: true,
    notes: 'Luxembourg permits dual citizenship since 1 January 2009 (Nationality Act 2008).',
    sourceUrl:
      'https://guichet.public.lu/en/citoyens/citoyennete/perte-recouvrement-nationalite/multiple-nationalite.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    permitted: true,
    notes: 'Iceland permits dual citizenship since 1 July 2003.',
    sourceUrl: 'https://island.is/en/citizenship',
    sourceYear: 2023,
  },
  CHE: {
    iso3: 'CHE',
    permitted: true,
    notes: 'Switzerland permits multiple citizenship since 1 January 1992.',
    sourceUrl: 'https://www.sem.admin.ch/sem/en/home/themen/buergerrecht.html',
    sourceYear: 2023,
  },
  AUT: {
    iso3: 'AUT',
    permitted: false,
    notes:
      'Austria requires renunciation of prior citizenship at naturalisation; exceptions exist (descent, hardship) but the default is single citizenship under the Staatsbürgerschaftsgesetz.',
    sourceUrl: 'https://www.bmi.gv.at/302/Staatsbuergerschaft/start.aspx',
    sourceYear: 2023,
  },
  CHL: {
    iso3: 'CHL',
    permitted: true,
    notes: 'Chile permits dual citizenship since the 2005 constitutional reform.',
    sourceUrl: 'https://www.serviciodemigraciones.cl/',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    permitted: false,
    notes:
      'Japan formally requires choice of nationality before age 22 under Article 14 of the Nationality Act; in practice de-facto tolerance for some, but the legal default is single-nationality.',
    sourceUrl: 'https://www.moj.go.jp/EN/MINJI/minji06.html',
    sourceYear: 2023,
  },
  TWN: {
    iso3: 'TWN',
    permitted: true,
    notes:
      'Taiwan permits its citizens to hold dual citizenship; foreign nationals naturalising as Taiwanese citizens generally must renounce prior citizenship (except in exceptional skill categories).',
    sourceUrl: 'https://www.immigration.gov.tw/5475/',
    sourceYear: 2023,
  },
  USA: {
    iso3: 'USA',
    permitted: true,
    notes:
      'United States permits dual citizenship; Oath of Allegiance does not require renunciation of foreign nationality (US Department of State).',
    sourceUrl:
      'https://travel.state.gov/content/travel/en/legal/travel-legal-considerations/Advice-about-Possible-Loss-of-US-Nationality-Dual-Nationality/Dual-Nationality.html',
    sourceYear: 2024,
  },

  // ─────────────────────────────────────────────────────────────────
  // Not permitted (8 cohort countries)
  // ─────────────────────────────────────────────────────────────────
  SGP: {
    iso3: 'SGP',
    permitted: false,
    notes:
      'Singapore does not permit dual citizenship; new citizens must renounce all foreign nationalities, and Singaporeans who acquire foreign citizenship lose Singaporean citizenship under the Constitution.',
    sourceUrl: 'https://www.ica.gov.sg/reside/SC/loss-of-citizenship',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    permitted: false,
    notes:
      'Hong Kong follows the Chinese Nationality Law (single citizenship); HKSAR residents holding foreign passports are recognised as Chinese nationals only.',
    sourceUrl: 'https://www.immd.gov.hk/eng/services/chinese_nationality.html',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    permitted: false,
    notes:
      'Malaysia does not permit dual citizenship; Article 24 of the Federal Constitution requires renunciation of foreign citizenship.',
    sourceUrl: 'https://www.imi.gov.my/index.php/en/citizenship/',
    sourceYear: 2023,
  },
  ARE: {
    iso3: 'ARE',
    permitted: false,
    notes:
      'United Arab Emirates does not permit dual citizenship by general rule; 2021 Federal Decree-Law amendments allow exceptions for specified talents but require Cabinet approval.',
    sourceUrl:
      'https://u.ae/en/information-and-services/visa-and-emirates-id/citizenship/become-a-uae-citizen',
    sourceYear: 2023,
  },
  SAU: {
    iso3: 'SAU',
    permitted: false,
    notes:
      'Saudi Arabia does not permit dual citizenship as a general rule; Article 11 of the Saudi Citizenship Law requires permission from the Council of Ministers.',
    sourceUrl: 'https://www.absher.sa/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    permitted: false,
    notes:
      'Bahrain does not permit dual citizenship except by Royal Decree (Bahrain Nationality Law).',
    sourceUrl: 'https://www.npra.gov.bh/en',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    permitted: false,
    notes:
      'Oman does not permit dual citizenship under the 2014 Nationality Law; renunciation required at naturalisation, and Omani citizens lose nationality if they acquire foreign citizenship.',
    sourceUrl: 'https://www.rop.gov.om/english',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    permitted: null,
    notes:
      'Namibia formally restricts dual citizenship for naturalised citizens (Article 4(8) of the Constitution requires renunciation) but courts have interpreted this for citizens by birth more permissively. Treating as null pending recent jurisprudence review.',
    sourceUrl: 'https://www.mhaiss.gov.na/citizenship',
    sourceYear: 2023,
  },
};

export function getDualCitizenshipPolicy(iso3: string): DualCitizenshipPolicy | null {
  return COUNTRY_DUAL_CITIZENSHIP_POLICY[iso3] ?? null;
}
