// Phase 3.6.4 / FIX 2 — country-level lookup for D.1.2 (minimum years
// of residence to PR eligibility).
//
// D.1.2 is country-deterministic in most cohort jurisdictions: the rule
// is set by the immigration / citizenship authority, not by the
// individual visa programme. The temporary-visa pages (which Stage 0
// hits first) generally do not state this number — it lives on the PR
// authority's pages (ICA, Home Office, USCIS, etc.). After the AUS / SGP
// canaries left D.1.2 as LLM_MISS for both programmes (cascading into
// D.2.2 derive skips), a country-level lookup mirroring the D.2.2
// citizenship-residence pattern is the right vehicle.
//
// HEADER NOTE — analyst review required:
// Values were curated from public records of each country's PR pathway
// for talent-class visas. They MUST be re-checked before each new
// canary in case a regulatory change has shifted the threshold. Several
// jurisdictions have multiple PR routes with different durations; the
// number below reflects the FAST route most relevant to a talent-class
// applicant (e.g. AUS 482 → 186 TRT 2yr, not the general 5-year route).
//
// Re-check cadence: annual; trigger via Phase 6 living-index
// policy_changes.
//
// `d12MinYearsToPr: null` is reserved for jurisdictions where no
// realistic PR pathway exists from a talent visa (the GCC monarchies);
// `deriveD12` skips writing a row in that case and the missing-data
// penalty applies.

export interface PrTimeline {
  iso3: string;
  d12MinYearsToPr: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_PR_TIMELINE: Record<string, PrTimeline> = {
  AUS: {
    iso3: 'AUS',
    d12MinYearsToPr: 2,
    notes:
      '482 Skills in Demand → 186 ENS Temporary Residence Transition stream: 2 years continuous sponsored employment.',
    sourceUrl:
      'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186/temporary-residence-transition-stream',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    d12MinYearsToPr: 2,
    notes:
      'Express Entry — Canadian Experience Class typically 1 yr Canadian work experience; FSW + work history ~2 yrs to ITA. Time as work-permit holder.',
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    d12MinYearsToPr: 5,
    notes: 'Skilled Worker → Indefinite Leave to Remain: 5-year qualifying period.',
    sourceUrl: 'https://www.gov.uk/indefinite-leave-to-remain',
    sourceYear: 2024,
  },
  SGP: {
    iso3: 'SGP',
    d12MinYearsToPr: 2,
    notes:
      'Employment Pass / S Pass holders: ICA accepts PR applications after ~6 months of employment in practice; analyst-noted typical successful timeline ≥2 years.',
    sourceUrl: 'https://www.ica.gov.sg/reside/PR/apply',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    d12MinYearsToPr: 7,
    notes: '7 years continuous ordinary residence required for Right of Abode (PR equivalent).',
    sourceUrl: 'https://www.immd.gov.hk/eng/services/right_of_abode_in_hk.html',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    d12MinYearsToPr: 2,
    notes:
      'EB-2 / EB-3 talent pathway via labour certification + I-140 + I-485 — typical 1.5–3 yrs depending on country backlog. Analyst-noted median 2.',
    sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/permanent-workers',
    sourceYear: 2024,
  },
  NZL: {
    iso3: 'NZL',
    d12MinYearsToPr: 2,
    notes:
      'Skilled Migrant Category Resident Visa typically converts to permanent within 2 years subject to presence requirement.',
    sourceUrl:
      'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/permanent-resident-visa',
    sourceYear: 2024,
  },
  CHE: {
    iso3: 'CHE',
    d12MinYearsToPr: 10,
    notes: '10 years lawful residence for C-permit (5 yrs for some EU/EFTA nationals).',
    sourceUrl: 'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt.html',
    sourceYear: 2023,
  },
  NLD: {
    iso3: 'NLD',
    d12MinYearsToPr: 5,
    notes: '5 years continuous lawful residence for permanent residence permit.',
    sourceUrl: 'https://ind.nl/en/permanent-residence-permit',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    d12MinYearsToPr: 5,
    notes: '5 years reckonable residence required for Stamp 4 long-term residence.',
    sourceUrl:
      'https://www.irishimmigration.ie/registering-your-immigration-permission/long-term-residence/',
    sourceYear: 2023,
  },
  LUX: {
    iso3: 'LUX',
    d12MinYearsToPr: 5,
    notes: '5 years uninterrupted lawful residence for long-term residence.',
    sourceUrl:
      'https://guichet.public.lu/en/citoyens/immigration/long-stay-visa-third-country/long-term-residence.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    d12MinYearsToPr: 4,
    notes: '4 years continuous lawful residence in Iceland.',
    sourceUrl: 'https://utl.is/index.php/en/permanent-residence-permit',
    sourceYear: 2023,
  },
  DEU: {
    iso3: 'DEU',
    d12MinYearsToPr: 5,
    notes:
      '5 years lawful residence (3 yrs accelerated post-2024 reform; 21 mos for Blue Card with B1 German).',
    sourceUrl:
      'https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Daueraufenthalt/daueraufenthalt-node.html',
    sourceYear: 2024,
  },
  SWE: {
    iso3: 'SWE',
    d12MinYearsToPr: 4,
    notes: '4 years on a work permit before permanent residence eligibility.',
    sourceUrl:
      'https://www.migrationsverket.se/English/Private-individuals/Work-and-permanent-residence.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    d12MinYearsToPr: 5,
    notes: '5 years uninterrupted lawful residence.',
    sourceUrl: 'https://dofi.ibz.be/en',
    sourceYear: 2023,
  },
  AUT: {
    iso3: 'AUT',
    d12MinYearsToPr: 5,
    notes: '5 years uninterrupted residence for Daueraufenthalt-EU.',
    sourceUrl: 'https://www.bmi.gv.at/302/start.aspx',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    d12MinYearsToPr: 5,
    notes:
      '10 years standard; 5 yrs (or 1 yr) for Highly Skilled Professional fast-track. Talent route → 5 typical.',
    sourceUrl: 'https://www.moj.go.jp/EN/isa/policies/residency/residency_management.html',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    d12MinYearsToPr: 3,
    notes: '3 years lawful residence with continuous presence for Permanent Residence Permit.',
    sourceUrl: 'https://www.udi.no/en/word-definitions/permanent-residence-permit/',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    d12MinYearsToPr: 5,
    notes:
      '5 years continuous residence with required presence for APRC (Alien Permanent Resident Certificate).',
    sourceUrl: 'https://www.immigration.gov.tw/5475/',
    sourceYear: 2024,
  },
  FIN: {
    iso3: 'FIN',
    d12MinYearsToPr: 4,
    notes: '4 years continuous residence on A-permit before permanent residence permit.',
    sourceUrl: 'https://migri.fi/en/permanent-residence-permit',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    d12MinYearsToPr: 5,
    notes: '5 years on long-stay visa before long-term residence permit eligibility.',
    sourceUrl: 'https://www.politsei.ee/en/long-term-residence-permit',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    d12MinYearsToPr: 5,
    notes: '5 years continuous residence before permanent residence eligibility.',
    sourceUrl: 'https://migracija.lrv.lt/en/services/residence-permit',
    sourceYear: 2023,
  },
  FRA: {
    iso3: 'FRA',
    d12MinYearsToPr: 5,
    notes:
      '5 years continuous lawful residence for carte de résident (Talent Passport holders may apply at 4 yrs).',
    sourceUrl: 'https://www.service-public.fr/particuliers/vosdroits/F17359',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    d12MinYearsToPr: 2,
    notes:
      '2 years on a temporary residence permit before applying for permanent residence (definitiva).',
    sourceUrl: 'https://www.serviciodemigraciones.cl/',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    d12MinYearsToPr: 5,
    notes: '5 years residence on Employment Pass (or via REP) before PR application.',
    sourceUrl: 'https://www.imi.gov.my/index.php/en/main-services/permanent-residence/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    d12MinYearsToPr: 5,
    notes: '5 years lawful residence on a renewable work permit before PR application.',
    sourceUrl: 'https://www.mhaiss.gov.na/',
    sourceYear: 2023,
  },
  // Non-OECD GCC cohort with no realistic PR pathway from talent visas → null.
  ARE: {
    iso3: 'ARE',
    d12MinYearsToPr: null,
    notes:
      'No conventional PR pathway. Golden Visa is renewable residency, not permanent residence.',
    sourceUrl:
      'https://u.ae/en/information-and-services/visa-and-emirates-id/types-of-visa/long-term-residence-visas-in-the-uae',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    d12MinYearsToPr: null,
    notes: 'Premium Residency Permit replaces traditional kafala but is not formal PR.',
    sourceUrl: 'https://www.absher.sa/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    d12MinYearsToPr: null,
    notes: 'No standard PR pathway; Golden Residency available case-by-case.',
    sourceUrl: 'https://www.npra.gov.bh/en',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    d12MinYearsToPr: null,
    notes: 'Long-term-residency programmes introduced 2021; no conventional PR pathway.',
    sourceUrl: 'https://www.rop.gov.om/english',
    sourceYear: 2023,
  },
};

export function getPrTimeline(iso3: string): PrTimeline | null {
  return COUNTRY_PR_TIMELINE[iso3] ?? null;
}
