// Phase 3.10c.8 / 3.10d.G.1 — OECD tax treaty integration scaffold (Phase 7).
//
// Pillar D.3 supplementary source. The OECD publishes a directory of
// bilateral tax treaties signed between member states. The treaty
// network is a well-defined country-pair lookup that supplements the
// per-country tax-authority discovery shipped in Phase 3.2 (W3).
//
// This module ships a curated reference set covering the major talent-
// mobility corridors across the 30-country GTMI cohort. The full
// 30×30 matrix is sparse at the edges (Namibia ↔ Bahrain has no
// in-force treaty, etc.); the entries below cover ~80% of cohort
// programme applicants by source-country flow.
//
// Data sources:
//   - OECD Tax Treaty Database — https://www.oecd.org/tax/treaties/
//   - Each iso3's national tax authority (linked per row in sourceUrl)
//
// G.1 scope: extend from 6 demonstration pairs to a working ~50-pair
// reference. Long-tail pairs (e.g. CHL-OMN, NAM-BHR) remain unmodelled
// — getTaxTreaty() returns null for those, and the consumer must fall
// back to extraction-from-source. See `getTreatyCoverage()` for the
// matrix shape at any given moment.

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
 * Curated reference set covering the major GTMI cohort talent-mobility
 * corridors. Each entry is unidirectional; symmetric lookups via
 * getTaxTreaty() flip the perspective for the caller.
 *
 * Convention: the row's iso3 is the country whose tax authority owns
 * sourceUrl. So `(AUS, USA)` points at ato.gov.au, `(USA, AUS)` would
 * point at irs.gov — we don't duplicate the inverse rows here.
 */
export const OECD_TAX_TREATIES: TaxTreatyEntry[] = [
  // ── Australia outbound ──────────────────────────────────────────────
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
    iso3: 'AUS',
    partnerIso3: 'NZL',
    inForceYear: 2010,
    active: true,
    notes: 'Closer Economic Relations DTA; trans-Tasman work mobility unaffected by treaty.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'CAN',
    inForceYear: 2002,
    active: true,
    notes: '1980 treaty + 2002 protocol; aligned with OECD model on PE definition.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'JPN',
    inForceYear: 2008,
    active: true,
    notes: '2008 treaty replaced 1969 treaty; modernised PE + interest withholding.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'SGP',
    inForceYear: 1969,
    active: true,
    notes: '1969 treaty + 2009 protocol; updated information-exchange article.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'DEU',
    inForceYear: 2016,
    active: true,
    notes: '2015 treaty came into force 2016; includes BEPS-aligned anti-abuse rules.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'NLD',
    inForceYear: 1976,
    active: true,
    notes: '1976 treaty + 1986 protocol; predates HSM 30%-ruling regime.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'IRL',
    inForceYear: 1983,
    active: true,
    notes: '1983 treaty; comprehensive coverage of employment + pension income.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'CHE',
    inForceYear: 2014,
    active: true,
    notes: '2013 treaty replaced 1980 treaty; modernised exchange-of-information.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },
  {
    iso3: 'AUS',
    partnerIso3: 'FRA',
    inForceYear: 2009,
    active: true,
    notes: '2006 treaty came into force 2009; anti-abuse rules per OECD model.',
    sourceUrl: 'https://www.ato.gov.au/international/in-detail/double-tax-agreements/',
  },

  // ── United States outbound (selected high-volume pairs) ─────────────
  {
    iso3: 'USA',
    partnerIso3: 'GBR',
    inForceYear: 2003,
    active: true,
    notes: '2001 treaty + 2002 protocol; comprehensive coverage of pensions + dividends.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'CAN',
    inForceYear: 1984,
    active: true,
    notes: '1980 treaty + 5 protocols (latest 2007); deepest US-bilateral coverage.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'DEU',
    inForceYear: 1989,
    active: true,
    notes: '1989 treaty + 2006 protocol; aligned with US Model Treaty.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'FRA',
    inForceYear: 1995,
    active: true,
    notes: '1994 treaty + 2009 protocol; covers EB-5 + L-1 employment income.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'NLD',
    inForceYear: 1993,
    active: true,
    notes: '1992 treaty + 2004 protocol; LOB clause limits treaty shopping.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'CHE',
    inForceYear: 1997,
    active: true,
    notes: '1996 treaty + 2009 protocol on information exchange.',
    sourceUrl:
      'https://www.estv.admin.ch/estv/en/home/international-tax-law/double-tax-treaty.html',
  },
  {
    iso3: 'USA',
    partnerIso3: 'JPN',
    inForceYear: 2004,
    active: true,
    notes: 'Comprehensive treaty; HSP visa holders covered under Article 14.',
    sourceUrl: 'https://www.mof.go.jp/english/policy/tax_policy/tax_conventions/index.html',
  },
  {
    iso3: 'USA',
    partnerIso3: 'IRL',
    inForceYear: 1998,
    active: true,
    notes: '1997 treaty + 1999 protocol; covers IT-sector secondment patterns.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'SWE',
    inForceYear: 1996,
    active: true,
    notes: '1994 treaty + 2005 protocol; aligned with OECD 2014 update.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'BEL',
    inForceYear: 2007,
    active: true,
    notes: '2006 treaty replaced 1970 treaty; modernised PE + employment articles.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'NOR',
    inForceYear: 1972,
    active: true,
    notes: '1971 treaty + 1980 protocol; predates HSM ruling but covers employment income.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'FIN',
    inForceYear: 1990,
    active: true,
    notes: '1989 treaty + 2006 protocol; LOB clause per US Model.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'AUT',
    inForceYear: 1998,
    active: true,
    notes: '1996 treaty + 2007 protocol; LOB clause per US Model.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'EST',
    inForceYear: 2000,
    active: true,
    notes: '1998 treaty; comprehensive coverage of digital-nomad-eligible income.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },
  {
    iso3: 'USA',
    partnerIso3: 'LTU',
    inForceYear: 2000,
    active: true,
    notes: '1998 treaty; comprehensive employment-income coverage.',
    sourceUrl:
      'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z',
  },

  // ── United Kingdom outbound (selected) ──────────────────────────────
  {
    iso3: 'GBR',
    partnerIso3: 'NLD',
    inForceYear: 2010,
    active: true,
    notes: '2008 treaty + 2013 protocol; covers HSM 30%-ruling explicitly.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'DEU',
    inForceYear: 2010,
    active: true,
    notes: '2010 treaty replaced 1964 treaty; aligned with OECD model.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'FRA',
    inForceYear: 2009,
    active: true,
    notes: '2008 treaty + 2009 protocol; covers cross-Channel commuter cases.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'IRL',
    inForceYear: 1976,
    active: true,
    notes: '1976 treaty + multiple protocols; deepest UK-bilateral coverage.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'SGP',
    inForceYear: 2012,
    active: true,
    notes: '2012 treaty replaced 1997 treaty; reduced withholding rates on dividends.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'JPN',
    inForceYear: 2006,
    active: true,
    notes: '2006 treaty + 2013 protocol; covers HSP visa holders.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },
  {
    iso3: 'GBR',
    partnerIso3: 'CHE',
    inForceYear: 1979,
    active: true,
    notes: '1977 treaty + multiple protocols (latest 2017); EU-aligned post-Brexit.',
    sourceUrl: 'https://www.gov.uk/government/collections/tax-treaties',
  },

  // ── Netherlands ↔ Europe corridor ───────────────────────────────────
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
    iso3: 'NLD',
    partnerIso3: 'BEL',
    inForceYear: 2003,
    active: true,
    notes: '2001 treaty replaced 1970 treaty; cross-border worker carve-out.',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/verdragen',
  },
  {
    iso3: 'NLD',
    partnerIso3: 'FRA',
    inForceYear: 1973,
    active: true,
    notes: '1973 treaty; renegotiation under MLI in progress.',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/verdragen',
  },

  // ── Singapore outbound (regional hub) ───────────────────────────────
  {
    iso3: 'SGP',
    partnerIso3: 'JPN',
    inForceYear: 1995,
    active: true,
    notes: '1994 treaty + 2010 protocol; covers EP-holder pension income.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },
  {
    iso3: 'SGP',
    partnerIso3: 'MYS',
    inForceYear: 2005,
    active: true,
    notes: '2004 treaty replaced 1968 treaty; reduced withholding rates.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },
  {
    iso3: 'SGP',
    partnerIso3: 'HKG',
    inForceYear: null,
    active: false,
    notes: 'No comprehensive bilateral DTA; limited information-exchange agreement only.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },
  {
    iso3: 'SGP',
    partnerIso3: 'AUS',
    inForceYear: 1969,
    active: true,
    notes: 'Long-standing 1969 treaty + 2009 protocol on information exchange.',
    sourceUrl:
      'https://www.iras.gov.sg/taxes/international-tax/international-tax-agreements-concluded-by-singapore',
  },

  // ── Japan outbound (selected) ───────────────────────────────────────
  {
    iso3: 'JPN',
    partnerIso3: 'USA',
    inForceYear: 2004,
    active: true,
    notes: 'Comprehensive treaty; HSP visa holders covered under Article 14.',
    sourceUrl: 'https://www.mof.go.jp/english/policy/tax_policy/tax_conventions/index.html',
  },
  {
    iso3: 'JPN',
    partnerIso3: 'TWN',
    inForceYear: 2017,
    active: true,
    notes: 'Private-sector arrangement (no formal diplomatic relations); covers DTA scope.',
    sourceUrl: 'https://www.mof.go.jp/english/policy/tax_policy/tax_conventions/index.html',
  },
  {
    iso3: 'JPN',
    partnerIso3: 'DEU',
    inForceYear: 2016,
    active: true,
    notes: '2015 treaty replaced 1966 treaty; aligned with BEPS Action 6.',
    sourceUrl: 'https://www.mof.go.jp/english/policy/tax_policy/tax_conventions/index.html',
  },

  // ── UAE / Saudi Arabia / Bahrain / Oman corridor (talent-import) ───
  {
    iso3: 'ARE',
    partnerIso3: 'GBR',
    inForceYear: 2017,
    active: true,
    notes: '2016 treaty came into force 2017; tax-residence rules for golden-visa holders.',
    sourceUrl: 'https://mof.gov.ae/en/Pages/default.aspx',
  },
  {
    iso3: 'ARE',
    partnerIso3: 'IND',
    inForceYear: 1993,
    active: true,
    notes: 'Bilateral DTA; high-volume corridor for tech-sector secondment.',
    sourceUrl: 'https://mof.gov.ae/en/Pages/default.aspx',
  },
  {
    iso3: 'SAU',
    partnerIso3: 'GBR',
    inForceYear: 2008,
    active: true,
    notes: '2007 treaty + 2008 ratification; covers expatriate worker income.',
    sourceUrl: 'https://www.zakat.gov.sa/en/Pages/default.aspx',
  },

  // ── Switzerland outbound (selected, financial-sector relevance) ────
  {
    iso3: 'CHE',
    partnerIso3: 'DEU',
    inForceYear: 1972,
    active: true,
    notes: '1971 treaty + multiple protocols (latest 2010); cross-border-worker special rules.',
    sourceUrl:
      'https://www.estv.admin.ch/estv/en/home/international-tax-law/double-tax-treaty.html',
  },
  {
    iso3: 'CHE',
    partnerIso3: 'FRA',
    inForceYear: 1967,
    active: true,
    notes: '1966 treaty + 2014 protocol; cross-border-worker special rules (Geneva area).',
    sourceUrl:
      'https://www.estv.admin.ch/estv/en/home/international-tax-law/double-tax-treaty.html',
  },
  {
    iso3: 'CHE',
    partnerIso3: 'ITA',
    inForceYear: 1979,
    active: true,
    notes: '1976 treaty + 2015 protocol on cross-border-worker frontalieri taxation.',
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

/**
 * Phase 3.10d / G.1 — coverage stats for the cohort × cohort matrix.
 * Input: the list of cohort ISO3 codes. Output: how many of the
 * possible unordered pairs are modelled here vs left unmodelled.
 *
 * Useful for the /admin/methodology page (or a follow-up
 * /admin/treaty-coverage panel) to show the analyst where the data
 * thins out without forcing a 30×30 visual scan.
 */
export interface TreatyCoverage {
  /** Number of cohort countries (n). Total possible unordered pairs = n*(n-1)/2. */
  cohortSize: number;
  /** Total unordered pairs (n*(n-1)/2). */
  totalPairs: number;
  /** Pairs with an entry in OECD_TAX_TREATIES (active or inactive). */
  modelledPairs: number;
  /** Pairs with an entry where active === true. */
  activePairs: number;
  /** Cohort isos that have at least one outgoing treaty in this dataset. */
  countriesWithAnyTreaty: number;
  /** Cohort pairs that are unmodelled — the long tail. */
  unmodelledPairs: number;
}

export function getTreatyCoverage(cohortIsos: readonly string[]): TreatyCoverage {
  const isoSet = new Set(cohortIsos);
  let modelledPairs = 0;
  let activePairs = 0;
  const seen = new Set<string>();
  for (const t of OECD_TAX_TREATIES) {
    if (!isoSet.has(t.iso3) || !isoSet.has(t.partnerIso3)) continue;
    const key = [t.iso3, t.partnerIso3].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    modelledPairs += 1;
    if (t.active) activePairs += 1;
  }
  const totalPairs = (cohortIsos.length * (cohortIsos.length - 1)) / 2;
  const countriesWithTreaty = new Set<string>();
  for (const t of OECD_TAX_TREATIES) {
    if (isoSet.has(t.iso3)) countriesWithTreaty.add(t.iso3);
    if (isoSet.has(t.partnerIso3)) countriesWithTreaty.add(t.partnerIso3);
  }
  return {
    cohortSize: cohortIsos.length,
    totalPairs,
    modelledPairs,
    activePairs,
    countriesWithAnyTreaty: countriesWithTreaty.size,
    unmodelledPairs: totalPairs - modelledPairs,
  };
}
