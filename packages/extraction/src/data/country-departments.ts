// Phase 3.9 / W3 — per-country cross-departmental authority registry.
//
// The single biggest coverage gap surfaced by every canary to date
// (AUS, SGP, NLD, JPN — same shape on each) is fields D.3.1 / D.3.2 /
// D.3.3 (tax-residency triggers and special-regime / territorial-tax
// rules) and E.1.1 (material policy changes), which ALL live on a
// different government domain than the immigration authority. Stage 0
// generic prompts find immigration pages reliably and tax / labour /
// citizenship pages unreliably, because the model has no signal that
// these are SEPARATE-domain authorities the country routinely splits.
//
// This table is the cohort-level "if your country is X, look on
// hostname Y" hint Stage 0 needs. Each entry names the canonical
// HOSTNAME of the authority — not a specific URL — so Perplexity can
// find the right page on the right site (the page within may move).
//
// Coverage: every ISO3 in the 30-country IMD Top-30 cohort. NULL is
// acceptable for any field where the country has no separate
// authority (e.g. SGP folds tax residency into MOM's worker pages,
// not a distinct IRAS website split).
//
// Re-check cadence: per-country review every methodology release.
// Hostnames change infrequently; URL paths change more often, but the
// hint is hostname-only.

export interface CountryDepartments {
  iso3: string;
  /** National tax authority (income tax residency, special expat regime). */
  taxAuthority?: string;
  /** Citizenship / naturalisation authority (separate from immigration in many cohort countries). */
  citizenshipAuthority?: string;
  /** Statistics bureau (median wage, labour-market data). */
  statisticsBureau?: string;
  /** Permanent residence pathway authority — distinct from the entry visa authority where applicable. */
  prAuthority?: string;
  /** Public-health entitlements authority. */
  healthAuthority?: string;
  /** Public-education access authority (most relevant for child-dependant fields). */
  educationAuthority?: string;
  /** Official gazette / legislation portal (the Act underlying the visa). */
  gazette?: string;
}

export const COUNTRY_DEPARTMENTS: Record<string, CountryDepartments> = {
  AUS: {
    iso3: 'AUS',
    taxAuthority: 'ato.gov.au',
    citizenshipAuthority: 'immi.homeaffairs.gov.au',
    statisticsBureau: 'abs.gov.au',
    prAuthority: 'immi.homeaffairs.gov.au',
    healthAuthority: 'servicesaustralia.gov.au',
    educationAuthority: 'education.gov.au',
    gazette: 'legislation.gov.au',
  },
  SGP: {
    iso3: 'SGP',
    taxAuthority: 'iras.gov.sg',
    citizenshipAuthority: 'ica.gov.sg',
    statisticsBureau: 'singstat.gov.sg',
    prAuthority: 'ica.gov.sg',
    healthAuthority: 'moh.gov.sg',
    educationAuthority: 'moe.gov.sg',
    gazette: 'sso.agc.gov.sg',
  },
  CAN: {
    iso3: 'CAN',
    taxAuthority: 'canada.ca/en/revenue-agency',
    citizenshipAuthority: 'canada.ca/en/immigration-refugees-citizenship',
    statisticsBureau: 'statcan.gc.ca',
    prAuthority: 'canada.ca/en/immigration-refugees-citizenship',
    healthAuthority: 'canada.ca/en/health-canada',
    educationAuthority: 'canada.ca/en/employment-social-development',
    gazette: 'laws-lois.justice.gc.ca',
  },
  NLD: {
    iso3: 'NLD',
    taxAuthority: 'belastingdienst.nl',
    citizenshipAuthority: 'ind.nl',
    statisticsBureau: 'cbs.nl',
    prAuthority: 'ind.nl',
    healthAuthority: 'rijksoverheid.nl',
    educationAuthority: 'duo.nl',
    gazette: 'wetten.overheid.nl',
  },
  JPN: {
    iso3: 'JPN',
    taxAuthority: 'nta.go.jp',
    citizenshipAuthority: 'moj.go.jp',
    statisticsBureau: 'stat.go.jp',
    prAuthority: 'isa.go.jp',
    healthAuthority: 'mhlw.go.jp',
    educationAuthority: 'mext.go.jp',
    gazette: 'kanpou.npb.go.jp',
  },
  GBR: {
    iso3: 'GBR',
    taxAuthority: 'gov.uk/government/organisations/hm-revenue-customs',
    citizenshipAuthority: 'gov.uk/browse/citizenship',
    statisticsBureau: 'ons.gov.uk',
    prAuthority: 'gov.uk',
    healthAuthority: 'nhs.uk',
    educationAuthority: 'gov.uk/government/organisations/department-for-education',
    gazette: 'legislation.gov.uk',
  },
  CHE: {
    iso3: 'CHE',
    taxAuthority: 'estv.admin.ch',
    citizenshipAuthority: 'sem.admin.ch',
    statisticsBureau: 'bfs.admin.ch',
    prAuthority: 'sem.admin.ch',
    healthAuthority: 'bag.admin.ch',
    educationAuthority: 'sbfi.admin.ch',
    gazette: 'fedlex.admin.ch',
  },
  IRL: {
    iso3: 'IRL',
    taxAuthority: 'revenue.ie',
    citizenshipAuthority: 'irishimmigration.ie',
    statisticsBureau: 'cso.ie',
    prAuthority: 'irishimmigration.ie',
    healthAuthority: 'hse.ie',
    educationAuthority: 'gov.ie/en/organisation/department-of-education',
    gazette: 'irishstatutebook.ie',
  },
  LUX: {
    iso3: 'LUX',
    taxAuthority: 'impotsdirects.public.lu',
    citizenshipAuthority: 'guichet.public.lu',
    statisticsBureau: 'statistiques.public.lu',
    prAuthority: 'guichet.public.lu',
    healthAuthority: 'cns.lu',
    educationAuthority: 'men.public.lu',
    gazette: 'legilux.public.lu',
  },
  ISL: {
    iso3: 'ISL',
    taxAuthority: 'rsk.is',
    citizenshipAuthority: 'utl.is',
    statisticsBureau: 'statice.is',
    prAuthority: 'utl.is',
    healthAuthority: 'sjukra.is',
    educationAuthority: 'mrn.is',
    gazette: 'althingi.is',
  },
  DEU: {
    iso3: 'DEU',
    taxAuthority: 'bzst.de',
    citizenshipAuthority: 'bamf.de',
    statisticsBureau: 'destatis.de',
    prAuthority: 'bamf.de',
    healthAuthority: 'bundesgesundheitsministerium.de',
    educationAuthority: 'bmbf.de',
    gazette: 'gesetze-im-internet.de',
  },
  SWE: {
    iso3: 'SWE',
    taxAuthority: 'skatteverket.se',
    citizenshipAuthority: 'migrationsverket.se',
    statisticsBureau: 'scb.se',
    prAuthority: 'migrationsverket.se',
    healthAuthority: 'socialstyrelsen.se',
    educationAuthority: 'skolverket.se',
    gazette: 'riksdagen.se',
  },
  BEL: {
    iso3: 'BEL',
    taxAuthority: 'finance.belgium.be',
    citizenshipAuthority: 'dofi.ibz.be',
    statisticsBureau: 'statbel.fgov.be',
    prAuthority: 'dofi.ibz.be',
    healthAuthority: 'inami.fgov.be',
    educationAuthority: 'enseignement.be',
    gazette: 'ejustice.just.fgov.be',
  },
  AUT: {
    iso3: 'AUT',
    taxAuthority: 'bmf.gv.at',
    citizenshipAuthority: 'bmi.gv.at',
    statisticsBureau: 'statistik.at',
    prAuthority: 'migration.gv.at',
    healthAuthority: 'sozialministerium.at',
    educationAuthority: 'bmbwf.gv.at',
    gazette: 'ris.bka.gv.at',
  },
  ARE: {
    iso3: 'ARE',
    taxAuthority: 'tax.gov.ae',
    citizenshipAuthority: 'icp.gov.ae',
    statisticsBureau: 'fcsc.gov.ae',
    prAuthority: 'icp.gov.ae',
    healthAuthority: 'mohap.gov.ae',
    educationAuthority: 'moe.gov.ae',
    gazette: 'mof.gov.ae',
  },
  NOR: {
    iso3: 'NOR',
    taxAuthority: 'skatteetaten.no',
    citizenshipAuthority: 'udi.no',
    statisticsBureau: 'ssb.no',
    prAuthority: 'udi.no',
    healthAuthority: 'helsenorge.no',
    educationAuthority: 'udir.no',
    gazette: 'lovdata.no',
  },
  TWN: {
    iso3: 'TWN',
    taxAuthority: 'dot.gov.tw',
    citizenshipAuthority: 'immigration.gov.tw',
    statisticsBureau: 'stat.gov.tw',
    prAuthority: 'immigration.gov.tw',
    healthAuthority: 'mohw.gov.tw',
    educationAuthority: 'edu.tw',
    gazette: 'law.moj.gov.tw',
  },
  LTU: {
    iso3: 'LTU',
    taxAuthority: 'vmi.lt',
    citizenshipAuthority: 'migracija.lrv.lt',
    statisticsBureau: 'osp.stat.gov.lt',
    prAuthority: 'migracija.lrv.lt',
    healthAuthority: 'sam.lrv.lt',
    educationAuthority: 'smm.lrv.lt',
    gazette: 'e-tar.lt',
  },
  USA: {
    iso3: 'USA',
    taxAuthority: 'irs.gov',
    citizenshipAuthority: 'uscis.gov',
    statisticsBureau: 'bls.gov',
    prAuthority: 'uscis.gov',
    healthAuthority: 'hhs.gov',
    educationAuthority: 'ed.gov',
    gazette: 'congress.gov',
  },
  FIN: {
    iso3: 'FIN',
    taxAuthority: 'vero.fi',
    citizenshipAuthority: 'migri.fi',
    statisticsBureau: 'stat.fi',
    prAuthority: 'migri.fi',
    healthAuthority: 'kela.fi',
    educationAuthority: 'minedu.fi',
    gazette: 'finlex.fi',
  },
  HKG: {
    iso3: 'HKG',
    taxAuthority: 'ird.gov.hk',
    citizenshipAuthority: 'immd.gov.hk',
    statisticsBureau: 'censtatd.gov.hk',
    prAuthority: 'immd.gov.hk',
    healthAuthority: 'gov.hk/en/residents/health',
    educationAuthority: 'edb.gov.hk',
    gazette: 'elegislation.gov.hk',
  },
  MYS: {
    iso3: 'MYS',
    taxAuthority: 'hasil.gov.my',
    citizenshipAuthority: 'imi.gov.my',
    statisticsBureau: 'dosm.gov.my',
    prAuthority: 'imi.gov.my',
    healthAuthority: 'moh.gov.my',
    educationAuthority: 'moe.gov.my',
    gazette: 'agc.gov.my',
  },
  CHL: {
    iso3: 'CHL',
    taxAuthority: 'sii.cl',
    citizenshipAuthority: 'serviciomigraciones.cl',
    statisticsBureau: 'ine.cl',
    prAuthority: 'serviciomigraciones.cl',
    healthAuthority: 'minsal.cl',
    educationAuthority: 'mineduc.cl',
    gazette: 'leychile.cl',
  },
  SAU: {
    iso3: 'SAU',
    taxAuthority: 'zatca.gov.sa',
    citizenshipAuthority: 'absher.sa',
    statisticsBureau: 'stats.gov.sa',
    prAuthority: 'iqama.com.sa',
    healthAuthority: 'moh.gov.sa',
    educationAuthority: 'moe.gov.sa',
    gazette: 'laws.boe.gov.sa',
  },
  NAM: {
    iso3: 'NAM',
    taxAuthority: 'mof.gov.na',
    citizenshipAuthority: 'mha.gov.na',
    statisticsBureau: 'nsa.org.na',
    prAuthority: 'mha.gov.na',
    healthAuthority: 'mhss.gov.na',
    educationAuthority: 'moe.gov.na',
    gazette: 'lac.org.na',
  },
  FRA: {
    iso3: 'FRA',
    taxAuthority: 'impots.gouv.fr',
    citizenshipAuthority: 'service-public.fr',
    statisticsBureau: 'insee.fr',
    prAuthority: 'service-public.fr',
    healthAuthority: 'ameli.fr',
    educationAuthority: 'education.gouv.fr',
    gazette: 'legifrance.gouv.fr',
  },
  EST: {
    iso3: 'EST',
    taxAuthority: 'emta.ee',
    citizenshipAuthority: 'politsei.ee',
    statisticsBureau: 'stat.ee',
    prAuthority: 'politsei.ee',
    healthAuthority: 'sm.ee',
    educationAuthority: 'hm.ee',
    gazette: 'riigiteataja.ee',
  },
  NZL: {
    iso3: 'NZL',
    taxAuthority: 'ird.govt.nz',
    citizenshipAuthority: 'govt.nz/browse/passports-citizenship-and-identity',
    statisticsBureau: 'stats.govt.nz',
    prAuthority: 'immigration.govt.nz',
    healthAuthority: 'health.govt.nz',
    educationAuthority: 'education.govt.nz',
    gazette: 'legislation.govt.nz',
  },
  BHR: {
    iso3: 'BHR',
    taxAuthority: 'nbr.gov.bh',
    citizenshipAuthority: 'npra.gov.bh',
    statisticsBureau: 'data.gov.bh',
    prAuthority: 'lmra.gov.bh',
    healthAuthority: 'moh.gov.bh',
    educationAuthority: 'moe.gov.bh',
    gazette: 'legalaffairs.gov.bh',
  },
  OMN: {
    iso3: 'OMN',
    taxAuthority: 'taxoman.gov.om',
    citizenshipAuthority: 'rop.gov.om',
    statisticsBureau: 'data.gov.om',
    prAuthority: 'rop.gov.om',
    healthAuthority: 'moh.gov.om',
    educationAuthority: 'moe.gov.om',
    gazette: 'mola.gov.om',
  },
};

/** Returns the entry for a country, or null if no entry exists. */
export function getCountryDepartments(iso3: string): CountryDepartments | null {
  return COUNTRY_DEPARTMENTS[iso3] ?? null;
}

/**
 * Render a compact "Stage 0 hint" block from a CountryDepartments entry.
 * Used by discover.ts buildUserMessage to inline the per-country authority
 * hostnames into the Perplexity prompt. Returns the empty string when the
 * lookup is null so the prompt stays clean for unmapped countries.
 */
export function renderCountryDepartmentsHint(iso3: string): string {
  const d = getCountryDepartments(iso3);
  if (!d) return '';
  const lines: string[] = [];
  lines.push(
    `COUNTRY-SPECIFIC AUTHORITY HOSTNAMES for ${iso3} — these are the canonical domains where the cross-departmental data lives. When searching for the categories below, prioritise pages on these hostnames:`
  );
  if (d.taxAuthority) lines.push(`- Tax authority (D.3.1 / D.3.2 / D.3.3): ${d.taxAuthority}`);
  if (d.citizenshipAuthority)
    lines.push(`- Citizenship / naturalisation (D.2.x): ${d.citizenshipAuthority}`);
  if (d.prAuthority && d.prAuthority !== d.citizenshipAuthority)
    lines.push(`- PR pathway authority (D.1.x): ${d.prAuthority}`);
  if (d.statisticsBureau)
    lines.push(`- Statistics bureau (median wage / labour data): ${d.statisticsBureau}`);
  if (d.healthAuthority)
    lines.push(`- Health authority (C.3.1 healthcare access): ${d.healthAuthority}`);
  if (d.educationAuthority)
    lines.push(`- Education authority (C.3.2 schooling access): ${d.educationAuthority}`);
  if (d.gazette) lines.push(`- Official gazette / legislation: ${d.gazette}`);
  return lines.join('\n');
}
