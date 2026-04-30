// Phase 3.9 / W21 — country-level lookup for D.3.1 (tax residency
// trigger — days/year of physical presence before worldwide tax applies).
//
// D.3.1 is country-deterministic: the trigger threshold is set by the
// national tax code, not by the visa programme. Authoritative pages live
// on the tax authority (HMRC, IRS, ATO, IRAS, etc.), not on the visa
// listing page that Stage 0 reaches first. A country-level lookup
// mirroring D.1.2 / D.2.4 is the right vehicle.
//
// HEADER NOTE — analyst review required:
// The number below is the PRIMARY day-count threshold used by each
// jurisdiction. Several jurisdictions use a multi-test (e.g. US
// substantial-presence with prior-year weighting, UK statutory
// residence test with ties, NLD centre-of-life test). For those, the
// primary day-count threshold is recorded; the secondary tests are
// captured in `notes` and surfaced via /review.
//
// Re-check cadence: annual; trigger via Phase 6 living-index policy_changes.
//
// `triggerDays: null` is reserved for jurisdictions that do not use a
// day-count test as the primary mechanism (e.g. domicile-only systems
// or pure territorial regimes — those are captured by D.3.3 instead).

export interface TaxResidencyPolicy {
  iso3: string;
  triggerDays: number | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_TAX_RESIDENCY: Record<string, TaxResidencyPolicy> = {
  AUS: {
    iso3: 'AUS',
    triggerDays: 183,
    notes:
      '183-day rule (one of four ATO residency tests). Domicile, "resides", and superannuation tests can also trigger residency below the threshold.',
    sourceUrl:
      'https://www.ato.gov.au/individuals-and-families/coming-to-australia-or-going-overseas/your-tax-residency',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    triggerDays: 183,
    notes:
      '183-day deemed-resident rule. Common-law factual residency (significant residential ties) can trigger residency below threshold.',
    sourceUrl:
      'https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-or-entering-canada-establishing-residency.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    triggerDays: 183,
    notes:
      'Statutory Residence Test: 183+ days = automatic UK resident. Sufficient-ties test can produce residency at lower day counts (16/46/91/120) depending on UK ties.',
    sourceUrl: 'https://www.gov.uk/tax-foreign-income/residence',
    sourceYear: 2024,
  },
  SGP: {
    iso3: 'SGP',
    triggerDays: 183,
    notes:
      '183-day rule under IRAS for tax residency (calendar year). Three-year test for some employment-pass holders (concession).',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    triggerDays: 180,
    notes:
      'No formal "residency" concept for salaries tax — territorial regime keys off source of income. 180-day threshold from DTAs commonly applied for non-domestic-source determinations.',
    sourceUrl: 'https://www.ird.gov.hk/eng/pdf/dipn44.pdf',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    triggerDays: 183,
    notes:
      'Substantial-presence test: 183 weighted days over current + 2 prior years (1.0 / 0.333 / 0.166). Green-card holders are also residents irrespective of days.',
    sourceUrl: 'https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test',
    sourceYear: 2024,
  },
  NZL: {
    iso3: 'NZL',
    triggerDays: 183,
    notes:
      '183-day rule (any 12-month window). Permanent place of abode test can produce residency at lower day counts.',
    sourceUrl: 'https://www.ird.govt.nz/international/tax-residency',
    sourceYear: 2024,
  },
  CHE: {
    iso3: 'CHE',
    triggerDays: 90,
    notes:
      '30 days with gainful activity OR 90 days without gainful activity OR domicile (centre of life). Lowest of the three is recorded.',
    sourceUrl: 'https://www.estv.admin.ch/estv/en/home.html',
    sourceYear: 2024,
  },
  NLD: {
    iso3: 'NLD',
    triggerDays: null,
    notes:
      'No statutory day-count threshold; residency is determined facts-and-circumstances by the Belastingdienst (centre of life: family, work, social ties). Secondary tests apply.',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/individuals/living_or_working_abroad_or_not_having_the_dutch_nationality/',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    triggerDays: 183,
    notes:
      '183 days in a tax year OR 280 days over a 2-year window with at least 30 in the current year. Lower threshold (183) recorded.',
    sourceUrl: 'https://www.revenue.ie/en/jobs-and-pensions/tax-residence/index.aspx',
    sourceYear: 2024,
  },
  LUX: {
    iso3: 'LUX',
    triggerDays: 183,
    notes:
      '6-month / 183-day rule under the Income Tax Act. Domicile / habitual abode tests can also trigger residency.',
    sourceUrl: 'https://impotsdirects.public.lu/en.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    triggerDays: 183,
    notes:
      '183-day rule over any 12-month window. Domicile test (registered residence) also triggers.',
    sourceUrl: 'https://www.skatturinn.is/english/individuals/tax-liability-residency/',
    sourceYear: 2023,
  },
  DEU: {
    iso3: 'DEU',
    triggerDays: 183,
    notes:
      'Habitual-abode test (gewöhnlicher Aufenthalt) ≥ 6 months continuous presence triggers unlimited tax liability. Domicile (Wohnsitz) also triggers regardless of days.',
    sourceUrl:
      'https://www.bundesfinanzministerium.de/Content/EN/Standardartikel/Topics/Taxation/2018-09-06-tax-questions-foreign-employees.html',
    sourceYear: 2024,
  },
  SWE: {
    iso3: 'SWE',
    triggerDays: 183,
    notes:
      '183-day rule for non-residents working short-term; otherwise habitual-residence test (Skatteverket folkbokföring).',
    sourceUrl:
      'https://www.skatteverket.se/servicelankar/otherlanguages/inenglish/individualsandemployees/livinginsweden/limitedtaxliability.4.7be5268414bea064694c40c.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    triggerDays: 183,
    notes:
      '183-day rule plus centre-of-vital-interests test. SPF Finances treats registration in National Register as additional indicator.',
    sourceUrl: 'https://finances.belgium.be/en',
    sourceYear: 2023,
  },
  AUT: {
    iso3: 'AUT',
    triggerDays: 183,
    notes:
      'Habitual abode (gewöhnlicher Aufenthalt) ≥ 183 days OR domicile triggers unlimited tax liability.',
    sourceUrl: 'https://www.bmf.gv.at/themen/steuern.html',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    triggerDays: 183,
    notes:
      'Resident if domicile or 1+ year of continuous presence in Japan. "Non-permanent resident" sub-category for residents under 5 years (limits foreign-source taxation).',
    sourceUrl: 'https://www.nta.go.jp/english/taxes/individual/12005.htm',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    triggerDays: 183,
    notes: '183 days within a 12-month window OR 270 days over 36 months triggers tax residency.',
    sourceUrl:
      'https://www.skatteetaten.no/en/person/foreign/are-you-going-to-work-in-norway-or-have-you-just-arrived/tax-residence/',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    triggerDays: 183,
    notes:
      '183-day rule per calendar year. Different graduated rates for residents vs non-residents (≤90 vs 91-182 vs 183+).',
    sourceUrl: 'https://www.dot.gov.tw/en/singlehtml/ch44',
    sourceYear: 2024,
  },
  FIN: {
    iso3: 'FIN',
    triggerDays: 183,
    notes:
      '6 months continuous stay triggers full residency. Domicile also triggers. Tax-at-source flat-rate option for some short-term workers.',
    sourceUrl: 'https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/arriving_in_finland/',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    triggerDays: 183,
    notes:
      '183 days over any 12-month window OR registered place of residence triggers full residency.',
    sourceUrl: 'https://www.emta.ee/en/private-client',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    triggerDays: 183,
    notes: '183 days within a calendar year OR 280 days over 2 calendar years triggers residency.',
    sourceUrl: 'https://www.vmi.lt/evmi/en',
    sourceYear: 2023,
  },
  FRA: {
    iso3: 'FRA',
    triggerDays: 183,
    notes:
      '183 days in France OR principal residence / centre of economic interests / professional activity test. Multiple alternative tests; 183-day primary day-count.',
    sourceUrl: 'https://www.impots.gouv.fr/portail/international-particulier',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    triggerDays: 183,
    notes:
      '6 months in current calendar year OR 6 months over 2 consecutive calendar years (totalling ≥183 days).',
    sourceUrl: 'https://www.sii.cl/destacados/sii_atiende/tributacion-internacional.html',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    triggerDays: 182,
    notes:
      '182-day rule per calendar year. Linkage rules can extend residency from prior or following year.',
    sourceUrl:
      'https://www.hasil.gov.my/en/individual/individual-life-cycle/becoming-a-tax-resident-of-malaysia/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    triggerDays: null,
    notes:
      'Source-based (territorial) tax system; residency status does not control tax base. See D.3.3 for territorial regime.',
    sourceUrl: 'https://www.mof.gov.na/inland-revenue',
    sourceYear: 2023,
  },
  // GCC: no individual income tax — D.3.1 not applicable. Recorded as
  // null with a note; the derive emits a row with notes describing the
  // regime (since the absence is itself meaningful information).
  ARE: {
    iso3: 'ARE',
    triggerDays: null,
    notes:
      'No personal income tax. Tax-residency certificate available after 183 days for treaty purposes only.',
    sourceUrl: 'https://tax.gov.ae/en/services/issuance.of.tax.residency.certificate.aspx',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    triggerDays: null,
    notes:
      'No personal income tax for individuals. Zakat applies to Saudi/GCC nationals; foreign tax-residency certificate processes exist for treaty use.',
    sourceUrl: 'https://zatca.gov.sa/en/Pages/default.aspx',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    triggerDays: null,
    notes: 'No personal income tax. Tax-residency analogue recognised for treaty purposes only.',
    sourceUrl: 'https://www.nbr.gov.bh/',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    triggerDays: null,
    notes:
      'No personal income tax as of 2026. (PIT framework announced for high earners from 2028 — not yet effective.)',
    sourceUrl: 'https://tms.taxoman.gov.om/portal/en',
    sourceYear: 2024,
  },
};

export function getTaxResidencyPolicy(iso3: string): TaxResidencyPolicy | null {
  return COUNTRY_TAX_RESIDENCY[iso3] ?? null;
}
