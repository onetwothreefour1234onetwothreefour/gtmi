// Phase 3.10c.8 — OECD tax treaty integration scaffold (Phase 7).
//
// Pillar D.3 supplementary source. The OECD publishes a directory of
// bilateral tax treaties signed between member states. The treaty
// network is a well-defined country-pair lookup that supplements the
// per-country tax-authority discovery shipped in Phase 3.2 (W3).
//
// This scaffold ships the data layer + lookup helper. It does NOT
// change extraction yet — the future cohort run can consult it as a
// Tier-1 supplement when programme tax pages are silent on
// foreign-income treatment.
//
// Real implementation will fetch from
//   https://www.oecd.org/tax/treaties/
// or the structured API at
//   https://stats.oecd.org/SDMX-JSON/data/TAX_TREATIES/...
//
// For now: a curated stub keyed by ISO3 country pair. Six high-value
// pairs from the Phase 3.9 cohort to demonstrate the shape; the full
// 30×30 matrix lands once the cohort run identifies which pairs
// actually need the lookup.

export interface TaxTreatyEntry {
  /** ISO3 of the country whose perspective this row represents. */
  iso3: string;
  /** ISO3 of the treaty partner. */
  partnerIso3: string;
  /** Year the treaty came into force. Null when in negotiation only. */
  inForceYear: number | null;
  /** Whether the treaty is currently active. */
  active: boolean;
  /** Free-form note (variant clauses, withholding rates, etc.). */
  notes: string;
  sourceUrl: string;
}

/**
 * Six demonstration pairs. Real Phase 7 work expands this to the full
 * cohort × cohort matrix (30×30 = 900 entries, of which ~600 will
 * have an in-force treaty).
 */
export const OECD_TAX_TREATIES: TaxTreatyEntry[] = [
  {
    iso3: 'AUS',
    partnerIso3: 'GBR',
    inForceYear: 2003,
    active: true,
    notes:
      'Comprehensive double-tax agreement; revised 2003. Pension carve-out for short-term residents.',
    sourceUrl: 'https://treaties.un.org/pages/showDetails.aspx?objid=080000028050a4b8',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'USA',
    inForceYear: 1983,
    active: true,
    notes: 'Original 1982 treaty + 2001 protocol; covers H-1B / E-3 visa holders explicitly.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'NLD',
    partnerIso3: 'DEU',
    inForceYear: 2016,
    active: true,
    notes: 'Replaced 1959 treaty; German source rules now apply for HSM 30%-ruling holders.',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/verdragen',
  },
  {
    iso3: 'JPN',
    partnerIso3: 'USA',
    inForceYear: 2004,
    active: true,
    notes: 'Comprehensive treaty; HSP visa holders covered under Article 14.',
    sourceUrl: 'https://www.mof.go.jp/english/policy/tax_policy/tax_conventions/index.html',
  },
  {
    iso3: 'SGP',
    partnerIso3: 'GBR',
    inForceYear: 2012,
    active: true,
    notes: 'Revised treaty; reduced withholding rates on dividends.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },
  {
    iso3: 'CHE',
    partnerIso3: 'USA',
    inForceYear: 1996,
    active: true,
    notes: 'Comprehensive treaty + 2009 protocol on information exchange.',
    sourceUrl:
      'https://www.estv.admin.ch/estv/en/home/international-tax-law/double-tax-treaty.html',
  },
];

/**
 * Lookup helper. Returns null when no curated entry exists for the
 * pair (the common case until the full matrix lands).
 *
 * Symmetric: looking up (AUS, GBR) returns the same entry as
 * (GBR, AUS) because the underlying data is symmetric per OECD model
 * convention.
 */
export function getTaxTreaty(iso3: string, partnerIso3: string): TaxTreatyEntry | null {
  const direct = OECD_TAX_TREATIES.find((t) => t.iso3 === iso3 && t.partnerIso3 === partnerIso3);
  if (direct) return direct;
  const reverse = OECD_TAX_TREATIES.find((t) => t.iso3 === partnerIso3 && t.partnerIso3 === iso3);
  if (reverse) {
    return {
      ...reverse,
      iso3,
      partnerIso3,
    };
  }
  return null;
}

/**
 * List every active treaty for a single country. Useful for the
 * /countries/[iso] page's "tax treaty network" panel (Phase 7).
 */
export function listTreatiesForCountry(iso3: string): TaxTreatyEntry[] {
  return OECD_TAX_TREATIES.filter(
    (t) => (t.iso3 === iso3 || t.partnerIso3 === iso3) && t.active
  ).map((t) =>
    t.iso3 === iso3
      ? t
      : {
          ...t,
          iso3,
          partnerIso3: t.iso3,
        }
  );
}
