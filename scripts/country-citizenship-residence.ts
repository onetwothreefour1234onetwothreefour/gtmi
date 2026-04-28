// Phase 3.6 / Fix D — minimum years of physical / lawful residence (as a
// PR / equivalent legal status) required before naturalisation eligibility,
// hand-curated from each country's citizenship law. Used by the derive
// stage to compute D.2.2 (Total minimum years from initial visa entry to
// citizenship eligibility):
//
//   D.2.2 = D.1.2 (years to PR) + COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[iso3]
//
// Hand-curated; refresh whenever a country amends its citizenship law (rare
// event; surfaces via Phase 6 living-index policy_changes).
//
// `null` → citizenship is not realistically attainable from the talent
// visa pathway (e.g. UAE / SAU / QAT — formal residency-to-citizenship
// path is effectively closed for skilled workers). The derive stage
// treats `null` as a skip condition (D.2.2 stays empty; missing-data
// penalty applies).

export interface CitizenshipResidence {
  iso3: string;
  /** Years required as a PR / equivalent legal resident. `null` = no realistic pathway. */
  yearsAsPr: number | null;
  /** Citation: official citizenship/nationality act page. */
  sourceUrl: string;
  /** Free-form note for analyst review. */
  notes?: string;
}

export const COUNTRY_CITIZENSHIP_RESIDENCE_YEARS: Record<string, CitizenshipResidence> = {
  AUS: {
    iso3: 'AUS',
    yearsAsPr: 4,
    sourceUrl: 'https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/permanent-resident',
    notes: '4 yrs lawful residence (incl. 1 yr as PR).',
  },
  CAN: {
    iso3: 'CAN',
    yearsAsPr: 3,
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility.html',
    notes: '3 of last 5 yrs as PR.',
  },
  GBR: {
    iso3: 'GBR',
    yearsAsPr: 5,
    sourceUrl: 'https://www.gov.uk/british-citizenship',
    notes: '5 yrs in UK + 1 yr as ILR.',
  },
  SGP: {
    iso3: 'SGP',
    yearsAsPr: 2,
    sourceUrl: 'https://www.ica.gov.sg/reside/PR/apply',
    notes: '2 yrs as PR (typically 6 yrs total work + PR).',
  },
  HKG: {
    iso3: 'HKG',
    yearsAsPr: 7,
    sourceUrl: 'https://www.immd.gov.hk/eng/services/right_of_abode_in_hk.html',
    notes: '7 yrs ordinary residence.',
  },
  USA: {
    iso3: 'USA',
    yearsAsPr: 5,
    sourceUrl: 'https://www.uscis.gov/citizenship',
    notes: '5 yrs LPR.',
  },
  DEU: {
    iso3: 'DEU',
    yearsAsPr: 5,
    sourceUrl: 'https://www.auswaertiges-amt.de/en/visa-service/staatsangehoerigkeitsrecht',
    notes: '5 yrs (3 yrs in fast-track post-2024).',
  },
  FRA: {
    iso3: 'FRA',
    yearsAsPr: 5,
    sourceUrl: 'https://www.service-public.fr/particuliers/vosdroits/F2213',
    notes: '5 yrs lawful residence.',
  },
  NLD: {
    iso3: 'NLD',
    yearsAsPr: 5,
    sourceUrl: 'https://ind.nl/en/dutch-citizenship',
    notes: '5 yrs uninterrupted residence.',
  },
  BEL: {
    iso3: 'BEL',
    yearsAsPr: 5,
    sourceUrl: 'https://dofi.ibz.be/en/themes/becoming-belgian',
    notes: '5 yrs lawful residence.',
  },
  AUT: {
    iso3: 'AUT',
    yearsAsPr: 10,
    sourceUrl: 'https://www.bmi.gv.at/302/start.aspx',
    notes: '10 yrs continuous residence.',
  },
  CHE: {
    iso3: 'CHE',
    yearsAsPr: 10,
    sourceUrl:
      'https://www.sem.admin.ch/sem/en/home/integration-einbuergerung/schweizer-werden.html',
    notes: '10 yrs (incl. 3 of last 5).',
  },
  LUX: {
    iso3: 'LUX',
    yearsAsPr: 5,
    sourceUrl: 'https://guichet.public.lu/en/citoyens/citoyennete.html',
    notes: '5 yrs continuous residence.',
  },
  IRL: {
    iso3: 'IRL',
    yearsAsPr: 5,
    sourceUrl: 'https://www.irishimmigration.ie/becoming-an-irish-citizen-by-naturalisation/',
    notes: '5 of last 9 yrs.',
  },
  ISL: {
    iso3: 'ISL',
    yearsAsPr: 7,
    sourceUrl: 'https://www.utl.is/index.php/en/icelandic-citizenship',
    notes: '7 yrs continuous residence.',
  },
  NOR: {
    iso3: 'NOR',
    yearsAsPr: 7,
    sourceUrl: 'https://www.udi.no/en/want-to-apply/citizenship/',
    notes: '7 of last 10 yrs.',
  },
  SWE: {
    iso3: 'SWE',
    yearsAsPr: 5,
    sourceUrl:
      'https://www.migrationsverket.se/English/Private-individuals/Becoming-a-Swedish-citizen.html',
    notes: '5 yrs continuous residence.',
  },
  FIN: {
    iso3: 'FIN',
    yearsAsPr: 5,
    sourceUrl: 'https://migri.fi/en/finnish-citizenship',
    notes: '5 yrs continuous residence.',
  },
  EST: {
    iso3: 'EST',
    yearsAsPr: 8,
    sourceUrl: 'https://www.politsei.ee/en/instructions/applying-for-estonian-citizenship',
    notes: '8 yrs (incl. 5 yrs permanent).',
  },
  LTU: {
    iso3: 'LTU',
    yearsAsPr: 10,
    sourceUrl: 'https://migracija.lrv.lt/en/services/citizenship',
    notes: '10 yrs lawful residence.',
  },
  JPN: {
    iso3: 'JPN',
    yearsAsPr: 5,
    sourceUrl: 'https://www.moj.go.jp/EN/MINJI/minji78.html',
    notes: '5 yrs continuous residence.',
  },
  NZL: {
    iso3: 'NZL',
    yearsAsPr: 5,
    sourceUrl: 'https://www.govt.nz/browse/passports-citizenship-and-identity/nz-citizenship/',
    notes: '5 yrs as resident.',
  },
  CHL: {
    iso3: 'CHL',
    yearsAsPr: 5,
    sourceUrl: 'https://www.serviciodemigraciones.cl/',
    notes: '5 yrs continuous residence.',
  },
  TWN: {
    iso3: 'TWN',
    yearsAsPr: 5,
    sourceUrl: 'https://www.immigration.gov.tw/5475/',
    notes: '5 yrs lawful residence.',
  },
  MYS: {
    iso3: 'MYS',
    yearsAsPr: 12,
    sourceUrl: 'https://www.imi.gov.my/index.php/en/citizenship/',
    notes: '12 yrs of last 15.',
  },
  NAM: {
    iso3: 'NAM',
    yearsAsPr: 5,
    sourceUrl: 'https://www.mhaiss.gov.na/citizenship',
    notes: '10 yrs ordinary residence.',
  },

  // No realistic citizenship pathway from talent visas.
  ARE: {
    iso3: 'ARE',
    yearsAsPr: null,
    sourceUrl:
      'https://u.ae/en/information-and-services/visa-and-emirates-id/types-of-visa/long-term-residence-visas-in-the-uae',
    notes: 'Citizenship effectively closed for talent-visa holders.',
  },
  BHR: {
    iso3: 'BHR',
    yearsAsPr: null,
    sourceUrl: 'https://www.npra.gov.bh/en',
    notes: '15-25 yrs; effectively no pathway for talent visas.',
  },
  OMN: {
    iso3: 'OMN',
    yearsAsPr: null,
    sourceUrl: 'https://www.rop.gov.om/english',
    notes: '20 yrs continuous residence; effectively no pathway.',
  },
  SAU: {
    iso3: 'SAU',
    yearsAsPr: null,
    sourceUrl: 'https://www.absher.sa/',
    notes: 'Citizenship by exception only; not a pathway.',
  },
};

export function getCitizenshipResidence(iso3: string): CitizenshipResidence | null {
  return COUNTRY_CITIZENSHIP_RESIDENCE_YEARS[iso3] ?? null;
}
