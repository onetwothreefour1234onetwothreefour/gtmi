// Phase 3.9 / W21 — country-level lookup for D.3.3 (territorial vs.
// worldwide taxation for residents).
//
// D.3.3 is country-deterministic: the tax base for residents is set by
// the national tax code, not by the visa programme. The authoritative
// information lives on the tax-authority pages, not on the visa
// listing page that Stage 0 reaches first. A country-level lookup
// mirroring D.2.3 / D.2.4 is the right vehicle.
//
// Allowed values per methodology-v1:
//   "worldwide"                       — residents taxed on worldwide income.
//   "worldwide_with_remittance_basis" — worldwide in principle but foreign
//                                       income taxed only if remitted.
//   "territorial"                     — residents taxed only on domestic-source income.
//   "hybrid"                          — specific income types territorial,
//                                       others worldwide.
//
// Re-check cadence: annual; trigger via Phase 6 living-index policy_changes.

export interface TaxBasisPolicy {
  iso3: string;
  basis: 'worldwide' | 'worldwide_with_remittance_basis' | 'territorial' | 'hybrid' | null;
  notes: string;
  sourceUrl: string;
  sourceYear: number;
}

export const COUNTRY_TAX_BASIS: Record<string, TaxBasisPolicy> = {
  AUS: {
    iso3: 'AUS',
    basis: 'worldwide',
    notes:
      'Australian residents are taxed on worldwide income. Temporary residents have a quasi-remittance carve-out for foreign-source income (foreign employment income still taxable).',
    sourceUrl:
      'https://www.ato.gov.au/individuals-and-families/coming-to-australia-or-going-overseas/your-tax-residency/tax-on-australian-income-for-foreign-residents',
    sourceYear: 2024,
  },
  CAN: {
    iso3: 'CAN',
    basis: 'worldwide',
    notes: 'Canadian residents are taxed on worldwide income.',
    sourceUrl:
      'https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-or-entering-canada-establishing-residency/factual-residents-temporarily-outside-canada.html',
    sourceYear: 2024,
  },
  GBR: {
    iso3: 'GBR',
    basis: 'worldwide',
    notes:
      'UK residents are taxed on worldwide income from 2025-26 (the previous non-dom remittance basis was abolished). Pre-2025 era: worldwide_with_remittance_basis.',
    sourceUrl: 'https://www.gov.uk/tax-foreign-income',
    sourceYear: 2025,
  },
  SGP: {
    iso3: 'SGP',
    basis: 'territorial',
    notes:
      'Residents are taxed only on Singapore-source income. Foreign-source income remitted is generally exempt. Effectively territorial.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/individual-income-tax/employees/working-outside-singapore/foreign-income',
    sourceYear: 2024,
  },
  HKG: {
    iso3: 'HKG',
    basis: 'territorial',
    notes:
      'Salaries tax is territorial: only Hong Kong-source employment income is taxed. Time apportionment for split employment.',
    sourceUrl: 'https://www.ird.gov.hk/eng/tax/ind_stl.htm',
    sourceYear: 2024,
  },
  USA: {
    iso3: 'USA',
    basis: 'worldwide',
    notes:
      'US tax residents (including green-card holders) and US citizens are taxed on worldwide income, regardless of residence.',
    sourceUrl:
      'https://www.irs.gov/individuals/international-taxpayers/taxation-of-resident-aliens',
    sourceYear: 2024,
  },
  NZL: {
    iso3: 'NZL',
    basis: 'worldwide',
    notes:
      'NZ tax residents are taxed on worldwide income. Transitional resident exemption available for new migrants for first 4 years.',
    sourceUrl: 'https://www.ird.govt.nz/international/tax-residency',
    sourceYear: 2024,
  },
  CHE: {
    iso3: 'CHE',
    basis: 'worldwide',
    notes:
      'Swiss residents are taxed on worldwide income (with foreign real-estate / permanent-establishment income carved out).',
    sourceUrl: 'https://www.estv.admin.ch/estv/en/home.html',
    sourceYear: 2024,
  },
  NLD: {
    iso3: 'NLD',
    basis: 'worldwide',
    notes:
      'Dutch residents are taxed on worldwide income across Box 1, Box 2, and Box 3. 30%-ruling provides a partial carve-out for qualifying expats.',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/individuals/living_or_working_abroad_or_not_having_the_dutch_nationality/',
    sourceYear: 2024,
  },
  IRL: {
    iso3: 'IRL',
    basis: 'worldwide_with_remittance_basis',
    notes:
      'Irish residents non-domiciled in Ireland are taxed on Irish-source + foreign income remitted. Domiciled residents: worldwide.',
    sourceUrl:
      'https://www.revenue.ie/en/jobs-and-pensions/tax-residence/tax-residence-and-domicile-rules.aspx',
    sourceYear: 2024,
  },
  LUX: {
    iso3: 'LUX',
    basis: 'worldwide',
    notes:
      'Luxembourg residents are taxed on worldwide income. Inbound expat regime provides partial relief for qualifying highly-skilled workers.',
    sourceUrl: 'https://impotsdirects.public.lu/en.html',
    sourceYear: 2023,
  },
  ISL: {
    iso3: 'ISL',
    basis: 'worldwide',
    notes: 'Icelandic residents are taxed on worldwide income.',
    sourceUrl: 'https://www.skatturinn.is/english/individuals/',
    sourceYear: 2023,
  },
  DEU: {
    iso3: 'DEU',
    basis: 'worldwide',
    notes:
      'German residents have unbeschränkte Steuerpflicht — unlimited (worldwide) tax liability.',
    sourceUrl: 'https://www.bundesfinanzministerium.de/Web/EN/Home/home.html',
    sourceYear: 2024,
  },
  SWE: {
    iso3: 'SWE',
    basis: 'worldwide',
    notes:
      'Swedish residents are taxed on worldwide income. Expert-tax relief available for qualifying foreign experts.',
    sourceUrl:
      'https://www.skatteverket.se/servicelankar/otherlanguages/inenglish/individualsandemployees/livinginsweden.4.7be5268414bea064694c40c.html',
    sourceYear: 2024,
  },
  BEL: {
    iso3: 'BEL',
    basis: 'worldwide',
    notes:
      'Belgian residents are taxed on worldwide income. New 2022 expat regime (BBIB / BBIK) provides specific exemptions for qualifying inbound workers.',
    sourceUrl: 'https://finances.belgium.be/en/private-individuals',
    sourceYear: 2024,
  },
  AUT: {
    iso3: 'AUT',
    basis: 'worldwide',
    notes: 'Austrian residents have unbeschränkte Steuerpflicht — worldwide tax liability.',
    sourceUrl: 'https://www.bmf.gv.at/themen/steuern.html',
    sourceYear: 2023,
  },
  JPN: {
    iso3: 'JPN',
    basis: 'hybrid',
    notes:
      'Permanent residents (5+ years): worldwide. Non-permanent residents (<5 years): Japanese-source income + foreign income remitted to Japan. Hybrid by tenure.',
    sourceUrl: 'https://www.nta.go.jp/english/taxes/individual/12005.htm',
    sourceYear: 2024,
  },
  NOR: {
    iso3: 'NOR',
    basis: 'worldwide',
    notes: 'Norwegian residents are taxed on worldwide income.',
    sourceUrl: 'https://www.skatteetaten.no/en/person/foreign/',
    sourceYear: 2024,
  },
  TWN: {
    iso3: 'TWN',
    basis: 'territorial',
    notes:
      'Taiwan personal income tax is largely territorial — Taiwan-source income only is taxed under PIT. Foreign-source income above NT$1m falls under separate AMT thresholds.',
    sourceUrl: 'https://www.dot.gov.tw/en/singlehtml/ch44',
    sourceYear: 2024,
  },
  FIN: {
    iso3: 'FIN',
    basis: 'worldwide',
    notes:
      'Finnish residents are taxed on worldwide income. Foreign experts may qualify for a 32% flat-rate withholding for first 48 months.',
    sourceUrl: 'https://www.vero.fi/en/individuals/',
    sourceYear: 2024,
  },
  EST: {
    iso3: 'EST',
    basis: 'worldwide',
    notes: 'Estonian residents are taxed on worldwide income.',
    sourceUrl: 'https://www.emta.ee/en',
    sourceYear: 2023,
  },
  LTU: {
    iso3: 'LTU',
    basis: 'worldwide',
    notes: 'Lithuanian residents are taxed on worldwide income.',
    sourceUrl: 'https://www.vmi.lt/evmi/en',
    sourceYear: 2023,
  },
  FRA: {
    iso3: 'FRA',
    basis: 'worldwide',
    notes:
      'French residents are taxed on worldwide income. Impatriate regime (régime des impatriés) provides exemptions on qualifying foreign-source income for up to 8 years.',
    sourceUrl: 'https://www.impots.gouv.fr/portail/international-particulier',
    sourceYear: 2024,
  },
  CHL: {
    iso3: 'CHL',
    basis: 'hybrid',
    notes:
      'Chilean residents in their first 3 years are taxed only on Chilean-source income (territorial); thereafter, worldwide. Hybrid by tenure.',
    sourceUrl: 'https://www.sii.cl/destacados/sii_atiende/tributacion-internacional.html',
    sourceYear: 2023,
  },
  MYS: {
    iso3: 'MYS',
    basis: 'territorial',
    notes:
      'Malaysian residents are taxed only on Malaysian-source income. Remitted foreign income is exempt for individuals (LHDN ruling 2022, extended).',
    sourceUrl: 'https://www.hasil.gov.my/en/individual/',
    sourceYear: 2023,
  },
  NAM: {
    iso3: 'NAM',
    basis: 'territorial',
    notes:
      'Namibia operates a source-based (territorial) PIT system: only Namibian-source income is taxable.',
    sourceUrl: 'https://www.mof.gov.na/inland-revenue',
    sourceYear: 2023,
  },
  // GCC: no personal income tax. Effectively territorial/none — reported
  // as 'territorial' since there is no worldwide-tax exposure. The notes
  // record the no-PIT regime.
  ARE: {
    iso3: 'ARE',
    basis: 'territorial',
    notes:
      'No personal income tax on individuals. No worldwide-tax exposure for residents on personal income.',
    sourceUrl: 'https://tax.gov.ae/en/',
    sourceYear: 2024,
  },
  SAU: {
    iso3: 'SAU',
    basis: 'territorial',
    notes:
      'No personal income tax on individuals. No worldwide-tax exposure for residents on personal income.',
    sourceUrl: 'https://zatca.gov.sa/en/',
    sourceYear: 2023,
  },
  BHR: {
    iso3: 'BHR',
    basis: 'territorial',
    notes: 'No personal income tax on individuals.',
    sourceUrl: 'https://www.nbr.gov.bh/',
    sourceYear: 2023,
  },
  OMN: {
    iso3: 'OMN',
    basis: 'territorial',
    notes:
      'No personal income tax on individuals as of 2026. PIT framework for high earners announced for 2028 (not yet effective).',
    sourceUrl: 'https://tms.taxoman.gov.om/portal/en',
    sourceYear: 2024,
  },
};

export function getTaxBasisPolicy(iso3: string): TaxBasisPolicy | null {
  return COUNTRY_TAX_BASIS[iso3] ?? null;
}
