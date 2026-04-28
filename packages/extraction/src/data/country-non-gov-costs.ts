// Phase 3.6.2 / ITEM 2 — country-level mandatory non-government costs lookup
// for B.2.4 (`Mandatory non-government costs`).
//
// The methodology-v2 prompt for B.2.4 states: "Almost every programme has at
// least one mandatory non-government cost (police certificate, panel-physician
// medical, statutory translation). Return hasMandatoryNonGovCosts=true unless
// the page explicitly states 'no third-party costs are required'."
//
// In practice EVERY cohort country requires at least one mandatory non-gov
// cost as a precondition to lodging an immigration application — typically
// a panel-physician medical, a national police certificate / criminal-record
// check, biometrics enrolment fees, or statutory translation of foreign
// documents. The LLM extraction path keeps returning empty because the visa
// listing page summarises *government* fees but rarely enumerates third-party
// costs separately. A country-level lookup is the right vehicle: the
// underlying answer is country-deterministic (set by immigration regulations,
// not the program type) and the per-country `notes` field captures the
// material differences (e.g. whether biometrics are required, whether a
// panel-physician system exists).
//
// HEADER NOTE (per analyst Flag 4 / Phase 3.6.2 sign-off, 2026-04-28):
// All 30 cohort countries below default to `hasMandatoryNonGovCosts=true`.
// Re-review individual entries if a specific program genuinely has no
// mandatory third-party costs (none currently known in the cohort).
//
// Each row carries:
//   - hasMandatoryNonGovCosts: true|false|null (null = unknown / disputed)
//   - notes: one-sentence description of the mandatory items
//   - sourceUrl: the official immigration-authority application checklist
//                or equivalent regulatory page
//   - sourceYear: the year the source was last verified
//
// Refresh discipline: same as country-citizenship-residence.ts.

export interface NonGovCostsPolicy {
  iso3: string;
  hasMandatoryNonGovCosts: boolean | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_NON_GOV_COSTS_POLICY: Record<string, NonGovCostsPolicy> = {
  AUS: {
    iso3: 'AUS',
    hasMandatoryNonGovCosts: true,
    notes:
      'Panel-physician medical examination, AFP national police certificate, biometrics where applicable, certified translation of non-English documents.',
    sourceUrl: 'https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/health',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    hasMandatoryNonGovCosts: true,
    notes:
      'IRCC-approved panel-physician medical exam, RCMP / national police certificates, biometrics enrolment fee, certified translations.',
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/biometrics.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    hasMandatoryNonGovCosts: true,
    notes:
      'TB test (designated countries), biometrics enrolment fee, ACRO/equivalent police certificate where required, certified translations.',
    sourceUrl: 'https://www.gov.uk/tb-test-visa',
    sourceYear: 2024,
  },
  SGP: {
    iso3: 'SGP',
    hasMandatoryNonGovCosts: true,
    notes:
      'Pre-employment medical examination by approved Singapore clinic, statutory translation of foreign documents, document attestation where required.',
    sourceUrl: 'https://www.mom.gov.sg/passes-and-permits/employment-pass/before-you-apply',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    hasMandatoryNonGovCosts: true,
    notes:
      'Notarised translation of foreign academic / employment documents; medical certificate where required for specific schemes.',
    sourceUrl: 'https://www.immd.gov.hk/eng/services/visas/general_employment_policy.html',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    hasMandatoryNonGovCosts: true,
    notes:
      'USCIS-designated panel-physician medical exam (Form I-693), biometrics enrolment fee, certified translations.',
    sourceUrl: 'https://www.uscis.gov/tools/designated-civil-surgeons',
    sourceYear: 2024,
  },
  // OECD high-income (EU + EEA + others) — broadly equivalent profile.
  CHE: {
    iso3: 'CHE',
    hasMandatoryNonGovCosts: true,
    notes:
      'Document apostille / legalisation, certified translations into German/French/Italian, biometrics enrolment.',
    sourceUrl: 'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt.html',
    sourceYear: 2023,
  },
  NLD: {
    iso3: 'NLD',
    hasMandatoryNonGovCosts: true,
    notes: 'TB screening (designated countries), biometrics, document legalisation/translation.',
    sourceUrl: 'https://ind.nl/en/work',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    hasMandatoryNonGovCosts: true,
    notes: 'TB screening, biometrics enrolment, document legalisation, certified translation.',
    sourceUrl: 'https://www.irishimmigration.ie/',
    sourceYear: 2024,
  },
  LUX: {
    iso3: 'LUX',
    hasMandatoryNonGovCosts: true,
    notes: 'Medical examination, document legalisation, certified French/German translation.',
    sourceUrl: 'https://guichet.public.lu/en/citoyens/immigration.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    hasMandatoryNonGovCosts: true,
    notes: 'Document apostille / legalisation, certified Icelandic translation.',
    sourceUrl: 'https://utl.is/index.php/en/',
    sourceYear: 2023,
  },
  DEU: {
    iso3: 'DEU',
    hasMandatoryNonGovCosts: true,
    notes: 'Document legalisation, certified German translation, biometrics enrolment.',
    sourceUrl: 'https://www.bamf.de/EN/',
    sourceYear: 2024,
  },
  SWE: {
    iso3: 'SWE',
    hasMandatoryNonGovCosts: true,
    notes: 'Biometrics enrolment, certified translation of foreign documents.',
    sourceUrl: 'https://www.migrationsverket.se/English/',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    hasMandatoryNonGovCosts: true,
    notes:
      'Medical certificate, police certificate, document legalisation, certified translation into Dutch/French/German.',
    sourceUrl: 'https://dofi.ibz.be/en',
    sourceYear: 2023,
  },
  AUT: {
    iso3: 'AUT',
    hasMandatoryNonGovCosts: true,
    notes:
      'Document legalisation / apostille, certified German translation, criminal record certificate.',
    sourceUrl: 'https://www.bmi.gv.at/',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    hasMandatoryNonGovCosts: true,
    notes:
      'Certified Japanese translation of foreign documents, document apostille / authentication where required.',
    sourceUrl: 'https://www.moj.go.jp/EN/isa/',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    hasMandatoryNonGovCosts: true,
    notes: 'Biometrics enrolment, document legalisation, certified Norwegian/English translation.',
    sourceUrl: 'https://www.udi.no/en/',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    hasMandatoryNonGovCosts: true,
    notes:
      'Health examination at designated hospital, criminal record certificate authenticated by ROC overseas mission, certified Mandarin translation.',
    sourceUrl: 'https://www.immigration.gov.tw/5475/',
    sourceYear: 2024,
  },
  LTU: {
    iso3: 'LTU',
    hasMandatoryNonGovCosts: true,
    notes:
      'Document legalisation, certified Lithuanian translation, criminal record check from country of origin.',
    sourceUrl: 'https://migracija.lrv.lt/en/',
    sourceYear: 2023,
  },
  FIN: {
    iso3: 'FIN',
    hasMandatoryNonGovCosts: true,
    notes:
      'Biometrics enrolment, certified Finnish/Swedish/English translation, document legalisation.',
    sourceUrl: 'https://migri.fi/en/',
    sourceYear: 2024,
  },
  FRA: {
    iso3: 'FRA',
    hasMandatoryNonGovCosts: true,
    notes:
      'OFII medical examination on arrival, document legalisation / apostille, certified French translation.',
    sourceUrl: 'https://www.ofii.fr/',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    hasMandatoryNonGovCosts: true,
    notes: 'Document legalisation, certified Estonian translation, criminal-record check.',
    sourceUrl: 'https://www.politsei.ee/en/instructions',
    sourceYear: 2023,
  },
  NZL: {
    iso3: 'NZL',
    hasMandatoryNonGovCosts: true,
    notes:
      'INZ-approved panel-physician medical examination, police certificates, biometrics, certified English translation.',
    sourceUrl: 'https://www.immigration.govt.nz/new-zealand-visas/preparing-a-visa-application',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    hasMandatoryNonGovCosts: true,
    notes:
      'Document apostille / legalisation, certified Spanish translation, criminal-record certificate.',
    sourceUrl: 'https://www.serviciodemigraciones.cl/',
    sourceYear: 2023,
  },
  // Non-OECD cohort.
  ARE: {
    iso3: 'ARE',
    hasMandatoryNonGovCosts: true,
    notes:
      'Medical fitness test at approved UAE clinic, document attestation by UAE embassy and MOFAIC, biometrics for Emirates ID.',
    sourceUrl: 'https://u.ae/en/information-and-services/visa-and-emirates-id',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    hasMandatoryNonGovCosts: true,
    notes:
      'Medical examination at approved clinic, document attestation by Saudi embassy, certified Arabic translation.',
    sourceUrl: 'https://www.absher.sa/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    hasMandatoryNonGovCosts: true,
    notes: 'Medical fitness test, document attestation, certified Arabic translation.',
    sourceUrl: 'https://www.npra.gov.bh/en',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    hasMandatoryNonGovCosts: true,
    notes:
      'Medical examination at approved clinic, document attestation by Omani embassy, certified Arabic translation.',
    sourceUrl: 'https://www.rop.gov.om/english',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    hasMandatoryNonGovCosts: true,
    notes:
      'FOMEMA medical examination, document legalisation, certified Bahasa Malaysia translation.',
    sourceUrl: 'https://www.imi.gov.my/index.php/en/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    hasMandatoryNonGovCosts: true,
    notes: 'Medical certificate, police clearance certificate, document legalisation.',
    sourceUrl: 'https://www.mhaiss.gov.na/',
    sourceYear: 2023,
  },
};

export function getNonGovCostsPolicy(iso3: string): NonGovCostsPolicy | null {
  return COUNTRY_NON_GOV_COSTS_POLICY[iso3] ?? null;
}
