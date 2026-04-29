// Phase 3.6.2 / ITEM 2 — country-level PR-pathway physical-presence lookups
// for D.1.3 (`Physical presence requirement during PR accrual`) and D.1.4
// (`PR retention rules — days/yr to keep PR`).
//
// Both indicators are deterministic at the COUNTRY level (set by the
// citizenship / residency-obligation legislation, not by the visa program).
// Three Tier-2 fallback attempts during Phase 3.6.1 failed because the
// authoritative pages are on the citizenship / PR-residency-obligation
// section of each country's immigration authority — not on the temporary
// visa listing pages discovered first by Stage 0. A country-level lookup
// table is the right vehicle, mirroring the pattern used for D.2.2
// (citizenship residence) and D.2.3 (dual-citizenship policy).
//
// HEADER NOTE (per analyst sign-off, 2026-04-28; FIX 2 audit 2026-04-29):
// Values below were verified from public records (each row's sourceUrl).
// They MUST be re-checked before Phase 5 SGP/CAN/GBR/HKG canaries to
// catch any regulatory changes since the last verification year.
// Re-check cadence: annual; trigger via Phase 6 living-index policy_changes.
//
// Phase 3.6.3 / FIX 2 — D.1.3 SEMANTIC AUDIT:
// D.1.3 measures physical-presence-DURING-PR-ACCRUAL (while on the
// temporary visa transitioning to PR). It is NOT the citizenship-residence
// rule (which is captured separately by D.2.2 input via
// COUNTRY_CITIZENSHIP_RESIDENCE_YEARS). The original cohort entries for
// AUS, CAN, and USA used citizenship-naturalisation figures (1095/5 days,
// 30/60 months) as D.1.3 proxies — that is a category error. Those three
// were corrected to required=false where the talent-visa pathway has NO
// per-year accrual presence rule. Genuine PR-accrual presence rules
// (GBR 180/12 absence cap during ILR qualifying; SGP, HKG continuous
// residence; NZL 184/yr pre-PR; TWN 6-month absence cap during APRC
// 5-year period; CHE/NLD/IRL/FRA/DEU/etc. continuity-of-residence) were
// kept as-is. GCC entries (ARE/SAU/BHR/OMN) remain required=null because
// no PR pathway exists.
//
// Each entry has:
//   - d13: physical presence DURING accrual to PR (boolean_with_annotation
//          shape — required, daysPerYear, notes).
//   - d14: physical presence AFTER PR is granted to RETAIN PR status
//          (same shape).
//   - sourceUrl + sourceYear shared between both.
//
// `required: null` is reserved for cases where the policy is genuinely
// contested or where the program has no PR pathway at all (deriveD13/D14
// will skip writing a row).

export interface PrPresenceFieldEntry {
  required: boolean | null;
  daysPerYear: number | null;
  notes: string;
}

export interface PrPresencePolicy {
  iso3: string;
  d13: PrPresenceFieldEntry;
  d14: PrPresenceFieldEntry;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_PR_PRESENCE_POLICY: Record<string, PrPresencePolicy> = {
  AUS: {
    iso3: 'AUS',
    d13: {
      // Phase 3.6.3 / FIX 2 — D.1.3 measures physical-presence-during-PR-ACCRUAL,
      // i.e. while on the temporary 482 visa transitioning to ENS-186/PR. AUS
      // 482 → ENS-186-DET requires 2 years of CONTINUOUS SPONSORED EMPLOYMENT,
      // not a per-year physical-presence count. The 1095/5 figure is for
      // citizenship (post-PR), captured by D.2.2 input, not D.1.3. Setting
      // required=false with a clear note is more honest than a misleading
      // proxy number.
      required: false,
      daysPerYear: null,
      notes:
        'No per-year physical-presence requirement during 482 → 186 TRT transition. The pathway rule is 2 years of continuous sponsored employment, not a presence-day count. (1095/5 days/yr applies to citizenship-after-PR — captured separately by D.2.2 input.)',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        '5-year travel facility on PR; Resident Return Visa (subclass 155) required to re-enter after 5 years out.',
    },
    sourceUrl:
      'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186/temporary-residence-transition-stream',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    d13: {
      // Phase 3.6.3 / FIX 2 — Express Entry candidates do NOT have a per-year
      // physical-presence requirement during accrual. The PR accrual rule is
      // CRS-points + invitation-to-apply, with continuous-residence assessed
      // at PR-application time, not during accrual. The 1095/5 figure
      // (citizenship after PR) is a D.2.2 input, not D.1.3.
      required: false,
      daysPerYear: null,
      notes:
        'Express Entry has no per-year physical-presence requirement during accrual. (1095/5 days applies to citizenship-after-PR — captured by D.2.2 input. 730/5 PR-retention rule lives in D.1.4.)',
    },
    d14: {
      required: true,
      daysPerYear: 146,
      notes: '730 days in any rolling 5-year window to retain PR (=146 days/yr proxy).',
    },
    sourceUrl:
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/understand-pr-status.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    d13: {
      required: true,
      daysPerYear: 185,
      notes:
        'Maximum 180 days absence per rolling 12-month period during the 5-year qualifying period for ILR (~185 days/yr presence proxy).',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'ILR lapses after 2 years continuous absence from the UK.',
    },
    sourceUrl: 'https://www.gov.uk/indefinite-leave-to-remain/residency',
    sourceYear: 2024,
  },
  SGP: {
    iso3: 'SGP',
    d13: {
      required: true,
      daysPerYear: 180,
      notes:
        'ICA discretionary; expects substantial physical presence; re-entry permit holders generally required to maintain a Singapore presence.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Re-entry Permit (REP) required to retain PR while abroad; typically 5-year validity, must be renewed.',
    },
    sourceUrl: 'https://www.ica.gov.sg/reside/PR/rep',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    d13: {
      required: true,
      daysPerYear: 180,
      notes:
        '7 years continuous ordinary residence required to qualify for permanent residency; HK Immigration assesses substantial connection.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Right of Abode lost if absent from Hong Kong for ≥36 months continuously after gaining permanent residency.',
    },
    sourceUrl: 'https://www.immd.gov.hk/eng/services/right_of_abode_in_hk.html',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    d13: {
      // Phase 3.6.3 / FIX 2 — INA 316 30/60-month physical presence is a
      // CITIZENSHIP-AFTER-PR requirement (naturalisation), not a PR-accrual
      // requirement. EB visa accrual to LPR is processed without a per-year
      // physical-presence count; the rule is 6-month-absence-presumed-
      // abandonment for LPRs (D.1.4) plus naturalisation residency (D.2.2).
      required: false,
      daysPerYear: null,
      notes:
        'EB-visa pathway to LPR has no per-year physical-presence requirement during accrual. (INA 316 30/60-month figure applies to naturalisation — captured by D.2.2 input. 12-month-presumed-abandonment rule lives in D.1.4.)',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'LPR status presumed abandoned after 12 months continuous absence without re-entry permit; conditional below 6 months.',
    },
    sourceUrl:
      'https://www.uscis.gov/green-card/after-we-grant-your-green-card/maintaining-permanent-residence',
    sourceYear: 2024,
  },
  CHE: {
    iso3: 'CHE',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '10 years residence required; specific physical-presence rules vary by canton.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'C-permit lapses after 6 months absence (extendable to 4 years on request).',
    },
    sourceUrl: 'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt.html',
    sourceYear: 2023,
  },
  NLD: {
    iso3: 'NLD',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        'Continuous lawful residence; absences > 6 months break continuity for permanent permit.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Permanent residence permit lapses after 6 consecutive months absence (12 months for EU long-term).',
    },
    sourceUrl: 'https://ind.nl/en/permanent-residence-permit',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        '5 years reckonable residence required; absences >6 weeks/year may break reckonable count.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Long-term residence (Stamp 5/6) lapses after extended absence; case-by-case INIS review.',
    },
    sourceUrl:
      'https://www.irishimmigration.ie/registering-your-immigration-permission/long-term-residence/',
    sourceYear: 2023,
  },
  NZL: {
    iso3: 'NZL',
    d13: {
      required: true,
      daysPerYear: 184,
      notes:
        'Resident Visa holders must be in NZ for ≥184 days in each of the 2 years before applying for permanent residence.',
    },
    d14: {
      required: false,
      daysPerYear: null,
      notes:
        'Permanent Resident Visa is indefinite once granted; no ongoing presence requirement. Resident Visa (pre-PR) requires presence to convert to PR.',
    },
    sourceUrl:
      'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/permanent-resident-visa',
    sourceYear: 2024,
  },
  FRA: {
    iso3: 'FRA',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        '5 years continuous lawful residence; absences > 6 months / year may break continuity for permanent residence (carte de résident).',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Carte de résident lapses after 3 consecutive years absence from France.',
    },
    sourceUrl: 'https://www.service-public.fr/particuliers/vosdroits/F17359',
    sourceYear: 2024,
  },
  DEU: {
    iso3: 'DEU',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        '5 years lawful residence (3 years on accelerated track post-2024 reform); absences > 6 months/year break continuity.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Niederlassungserlaubnis lapses after 6 months continuous absence (longer if approved in advance).',
    },
    sourceUrl:
      'https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Daueraufenthalt/daueraufenthalt-node.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years uninterrupted lawful residence with limited absences allowed.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Permanent residence lapses after 12 months continuous absence (24 months for EU long-term).',
    },
    sourceUrl: 'https://dofi.ibz.be/en',
    sourceYear: 2023,
  },
  AUT: {
    iso3: 'AUT',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years uninterrupted residence with limited absences.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Daueraufenthalt-EU lapses after 12 months absence (24 months for some categories).',
    },
    sourceUrl: 'https://www.bmi.gv.at/302/start.aspx',
    sourceYear: 2023,
  },
  SWE: {
    iso3: 'SWE',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        '5 years lawful residence (or 4 for EU long-term residence); absences must stay below threshold.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Permanent residence permit revoked after extended absences; specifically 12 months continuous.',
    },
    sourceUrl:
      'https://www.migrationsverket.se/English/Private-individuals/Work-and-permanent-residence.html',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '3 years lawful residence with continuous presence in Norway.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Permanent residence permit lapses after 2 years continuous absence.',
    },
    sourceUrl: 'https://www.udi.no/en/word-definitions/permanent-residence-permit/',
    sourceYear: 2024,
  },
  FIN: {
    iso3: 'FIN',
    d13: {
      required: true,
      daysPerYear: null,
      notes:
        '4 years continuous residence (A-permit duration) before permanent residence eligibility.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Permanent residence permit lapses after 2 years continuous absence from Finland.',
    },
    sourceUrl: 'https://migri.fi/en/permanent-residence-permit',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years residence on long-stay visa before long-term residence permit eligibility.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Long-term residence permit revoked if holder is absent from Estonia for 12 consecutive months or > 6 years over 10.',
    },
    sourceUrl: 'https://www.politsei.ee/en/long-term-residence-permit',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years continuous residence before permanent residence eligibility.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes:
        'Long-term residence revoked after 6 consecutive months absence (or 10 months over a 5-year period).',
    },
    sourceUrl: 'https://migracija.lrv.lt/en/services/residence-permit',
    sourceYear: 2023,
  },
  LUX: {
    iso3: 'LUX',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years uninterrupted residence required.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Long-term residence lapses after 12 months continuous absence.',
    },
    sourceUrl:
      'https://guichet.public.lu/en/citoyens/immigration/long-stay-visa-third-country/long-term-residence.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '4 years continuous lawful residence in Iceland.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Permanent residence permit lapses after 18 months continuous absence.',
    },
    sourceUrl: 'https://utl.is/index.php/en/permanent-residence-permit',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '10 years continuous residence (5 years for highly-skilled professionals fast-track).',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'PR (eijuken) lapses after 1 year continuous absence without re-entry permit.',
    },
    sourceUrl: 'https://www.moj.go.jp/EN/isa/policies/residency/residency_management.html',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    d13: {
      required: true,
      daysPerYear: 183,
      notes:
        'Maximum 6 months/year absence during 5-year residence period required for APRC eligibility.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'APRC lapses after 5 years continuous absence from Taiwan.',
    },
    sourceUrl: 'https://www.immigration.gov.tw/5475/',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years continuous residence (or relevant lower threshold for definitivo).',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Permanent residence revoked after 1 year continuous absence without authorisation.',
    },
    sourceUrl: 'https://www.serviciodemigraciones.cl/',
    sourceYear: 2023,
  },
  // Non-OECD cohort with no realistic PR pathway from talent visas → null.
  ARE: {
    iso3: 'ARE',
    d13: {
      required: null,
      daysPerYear: null,
      notes:
        'No conventional PR pathway; Golden Visa is renewable residency, not permanent residence.',
    },
    d14: {
      required: null,
      daysPerYear: null,
      notes: 'Golden Visa renewability requires periodic UAE presence but no formal day-count.',
    },
    sourceUrl:
      'https://u.ae/en/information-and-services/visa-and-emirates-id/types-of-visa/long-term-residence-visas-in-the-uae',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    d13: {
      required: null,
      daysPerYear: null,
      notes: 'Premium Residency Permit replaces traditional kafala but no formal PR pathway.',
    },
    d14: {
      required: null,
      daysPerYear: null,
      notes: 'Premium Residency renewable; no documented physical-presence retention rule.',
    },
    sourceUrl: 'https://www.absher.sa/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    d13: {
      required: null,
      daysPerYear: null,
      notes: 'No standard PR pathway; Golden Residency available case-by-case.',
    },
    d14: {
      required: null,
      daysPerYear: null,
      notes: 'Bahraini Golden Residency renewability; no documented retention rule.',
    },
    sourceUrl: 'https://www.npra.gov.bh/en',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    d13: {
      required: null,
      daysPerYear: null,
      notes: 'Long-term-residency programs introduced 2021; no conventional PR pathway.',
    },
    d14: {
      required: null,
      daysPerYear: null,
      notes: 'Investor residency renewable; no documented physical-presence retention.',
    },
    sourceUrl: 'https://www.rop.gov.om/english',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years residence required for PR application via several routes.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Malaysian PR (Entry Permit) revoked after 24 months continuous absence.',
    },
    sourceUrl: 'https://www.imi.gov.my/index.php/en/main-services/permanent-residence/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    d13: {
      required: true,
      daysPerYear: null,
      notes: '5 years lawful residence on a renewable work permit.',
    },
    d14: {
      required: true,
      daysPerYear: null,
      notes: 'Permanent residence revoked on extended absences; Ministry case-by-case review.',
    },
    sourceUrl: 'https://www.mhaiss.gov.na/',
    sourceYear: 2023,
  },
};

export function getPrPresencePolicy(iso3: string): PrPresencePolicy | null {
  return COUNTRY_PR_PRESENCE_POLICY[iso3] ?? null;
}
