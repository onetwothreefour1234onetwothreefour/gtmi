// Phase 3.9 / W21 — country-level lookup for D.2.4 (civic / language /
// integration test burden for citizenship).
//
// D.2.4 is country-deterministic: the test burden for naturalisation is
// set by citizenship law (or analogue), not by the visa programme that
// brought the applicant in. Across the cohort, this rule lives on the
// citizenship authority's pages (Home Office, BAMF, ICA, USCIS, etc.),
// which Stage 0 does not reach when seeded from a temporary-visa page.
// A country-level lookup mirroring the D.2.3 / B.2.4 / D.1.2 pattern is
// the right vehicle.
//
// HEADER NOTE — analyst review required:
// Values were curated from public records of each country's
// naturalisation / citizenship requirements. The mapping uses the
// methodology-v1 D.2.4 categorical scale:
//
//   "none"     — no test required.
//   "light"    — single test of single type (language A2/B1 OR short civics).
//   "moderate" — multiple tests OR one substantial test (B2+ language and civics).
//   "heavy"    — multiple substantial tests including language above B2,
//                civics, and integration / history.
//
// Re-check cadence: annual; trigger via Phase 6 living-index policy_changes.
//
// `burden: null` is reserved for jurisdictions where naturalisation is
// not realistically available from a talent visa (the GCC monarchies)
// — the derive will skip and the missing-data penalty applies.

export interface CivicTestPolicy {
  iso3: string;
  burden: 'none' | 'light' | 'moderate' | 'heavy' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_CIVIC_TEST_POLICY: Record<string, CivicTestPolicy> = {
  AUS: {
    iso3: 'AUS',
    burden: 'moderate',
    notes:
      'Australian citizenship test (civics, multiple-choice, 75% pass) plus "competent English" requirement (functional + good understanding) — civics + B2-equivalent language → moderate.',
    sourceUrl: 'https://immi.homeaffairs.gov.au/citizenship/citizenship-test-and-interview',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    burden: 'moderate',
    notes:
      'Citizenship test (Discover Canada study guide, 20 questions, 75% pass) plus CLB 4 in English/French (≈ A2/B1). Two tests = moderate per methodology.',
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/citizenship-test.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    burden: 'moderate',
    notes:
      '"Life in the UK" civics test (24 questions, 75% pass) plus B1 English (SELT). Civics + B1 language = moderate per methodology.',
    sourceUrl: 'https://www.gov.uk/life-in-the-uk-test',
    sourceYear: 2024,
  },
  SGP: {
    iso3: 'SGP',
    burden: 'light',
    notes:
      'No formal civics or language test mandated for naturalisation; ICA discretion-based assessment. Light = no formal test burden.',
    sourceUrl: 'https://www.ica.gov.sg/reside/PR/SC/apply',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    burden: 'none',
    notes:
      'No civic or language test for naturalisation. Right of Abode after 7 years of ordinary residence; no test required.',
    sourceUrl: 'https://www.immd.gov.hk/eng/services/right_of_abode_in_hk.html',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    burden: 'moderate',
    notes:
      'USCIS naturalisation civics test (10 of 100 questions, 6 correct to pass) plus English (reading, writing, speaking) at A2/B1. Two substantive tests = moderate.',
    sourceUrl:
      'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
    sourceYear: 2024,
  },
  NZL: {
    iso3: 'NZL',
    burden: 'light',
    notes:
      'No civics test. Functional English required (assessed administratively). Single light test = light.',
    sourceUrl:
      'https://www.govt.nz/browse/passports-citizenship-and-identity/nz-citizenship/apply-for-nz-citizenship/',
    sourceYear: 2024,
  },
  CHE: {
    iso3: 'CHE',
    burden: 'heavy',
    notes:
      'Cantonal + federal naturalisation tests covering Swiss history, geography, civics, plus language B1 spoken / A2 written in a national language. Multiple substantial tests = heavy.',
    sourceUrl: 'https://www.sem.admin.ch/sem/en/home/integration-einbuergerung/einbuergerung.html',
    sourceYear: 2024,
  },
  NLD: {
    iso3: 'NLD',
    burden: 'moderate',
    notes:
      'Civic Integration Examination (Inburgering): KNM (Dutch society civics) + reading + writing + listening + speaking at A2 (B1 from 2025). Multiple components = moderate.',
    sourceUrl:
      'https://ind.nl/en/dutch-citizenship/becoming-a-dutch-citizen-through-naturalisation',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    burden: 'none',
    notes:
      'No civic or language test for naturalisation. Good character + 5 reckonable years residence; ceremony declaration of fidelity. None.',
    sourceUrl: 'https://www.irishimmigration.ie/becoming-an-irish-citizen/',
    sourceYear: 2024,
  },
  LUX: {
    iso3: 'LUX',
    burden: 'moderate',
    notes:
      'Luxembourgish language test (A2 spoken, B1 listening) plus "Living in Luxembourg" civics course/test. Civics + language = moderate.',
    sourceUrl: 'https://guichet.public.lu/en/citoyens/citoyennete/nationalite-luxembourgeoise.html',
    sourceYear: 2024,
  },
  ISL: {
    iso3: 'ISL',
    burden: 'light',
    notes: 'Icelandic language test only (no formal civics test). Single test = light.',
    sourceUrl: 'https://www.utl.is/index.php/en/icelandic-citizenship',
    sourceYear: 2023,
  },
  DEU: {
    iso3: 'DEU',
    burden: 'moderate',
    notes:
      'Einbürgerungstest (33 civics questions) plus B1 German. Civics + B1 = moderate per methodology.',
    sourceUrl:
      'https://www.bamf.de/EN/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html',
    sourceYear: 2024,
  },
  SWE: {
    iso3: 'SWE',
    burden: 'none',
    notes:
      'No language or civics test required for naturalisation as of 2026. (Government has proposed a test from 2027 but not yet enacted.)',
    sourceUrl:
      'https://www.migrationsverket.se/English/Private-individuals/Becoming-a-Swedish-citizen.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    burden: 'light',
    notes:
      'Knowledge of one of the three national languages at A2 plus integration evidence (work or course). Single substantive requirement = light.',
    sourceUrl: 'https://dofi.ibz.be/en/themes/specifieke-verblijfsprocedures/becoming-belgian',
    sourceYear: 2024,
  },
  AUT: {
    iso3: 'AUT',
    burden: 'heavy',
    notes:
      'B1 German plus comprehensive civics test (federal + Land history, institutions, democratic order). Multiple substantial tests = heavy.',
    sourceUrl: 'https://www.bmi.gv.at/302/Staatsbuergerschaft/start.aspx',
    sourceYear: 2024,
  },
  JPN: {
    iso3: 'JPN',
    burden: 'light',
    notes:
      'No formal civics test. Japanese language ability at ~elementary-school level assessed informally during MOJ interview. Single light test = light.',
    sourceUrl: 'https://www.moj.go.jp/EN/MINJI/minji78.html',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    burden: 'moderate',
    notes:
      'Norwegian language test at A2 spoken plus civics test ("Samfunnskunnskap") for naturalisation. Civics + language = moderate.',
    sourceUrl: 'https://www.udi.no/en/want-to-apply/citizenship/',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    burden: 'light',
    notes:
      'Basic Mandarin language ability assessed; no separate civics test. Single light test = light.',
    sourceUrl: 'https://www.ris.gov.tw/app/en/3209',
    sourceYear: 2023,
  },
  FIN: {
    iso3: 'FIN',
    burden: 'light',
    notes:
      'Finnish or Swedish at B1 (YKI test). No separate civics requirement. Single test = light.',
    sourceUrl: 'https://migri.fi/en/finnish-citizenship',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    burden: 'moderate',
    notes:
      'Estonian language at B1 plus knowledge of constitution and citizenship act test. Two tests = moderate.',
    sourceUrl: 'https://www.politsei.ee/en/estonian-citizenship',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    burden: 'moderate',
    notes: 'Lithuanian language exam plus constitution test. Two tests = moderate.',
    sourceUrl: 'https://migracija.lrv.lt/en/services/citizenship',
    sourceYear: 2023,
  },
  FRA: {
    iso3: 'FRA',
    burden: 'moderate',
    notes:
      'French at B1 (TCF/TEF/DELF) plus civics-knowledge interview based on "Livret du citoyen". Civics + B1 = moderate.',
    sourceUrl: 'https://www.service-public.fr/particuliers/vosdroits/N111',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    burden: 'light',
    notes: 'No formal language or civics test; Spanish ability assessed informally. Light.',
    sourceUrl: 'https://www.serviciodemigraciones.cl/nacionalizacion/',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    burden: 'moderate',
    notes:
      'Malay language proficiency required; oath/loyalty assessment functions as civics-equivalent. Two requirements = moderate.',
    sourceUrl: 'https://www.imi.gov.my/index.php/en/main-services/citizenship/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    burden: 'light',
    notes:
      'English language ability required (national official language). No formal civics test. Single light test = light.',
    sourceUrl: 'https://www.mhaiss.gov.na/citizenship',
    sourceYear: 2023,
  },
  // GCC monarchies — naturalisation is not realistically available from
  // a talent visa. Skip rather than write a misleading row.
  ARE: {
    iso3: 'ARE',
    burden: null,
    notes:
      'Naturalisation extremely rare and discretionary; no public test framework. Golden Visa is renewable residency, not citizenship.',
    sourceUrl: 'https://u.ae/en/information-and-services/visa-and-emirates-id/naturalisation',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    burden: null,
    notes: 'Naturalisation by Royal Decree only; no public test framework.',
    sourceUrl: 'https://www.absher.sa/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    burden: null,
    notes: 'Naturalisation discretionary by Royal Decree; no public test framework.',
    sourceUrl: 'https://www.npra.gov.bh/en',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    burden: null,
    notes: 'Naturalisation discretionary by Sultanic Decree; no public test framework.',
    sourceUrl: 'https://www.rop.gov.om/english',
    sourceYear: 2023,
  },
};

export function getCivicTestPolicy(iso3: string): CivicTestPolicy | null {
  return COUNTRY_CIVIC_TEST_POLICY[iso3] ?? null;
}
