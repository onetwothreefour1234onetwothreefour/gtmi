/**
 * scripts/seed-launch-years.ts
 *
 * Phase 3.10 / step 1 — data hygiene. Backfill `programs.launch_year`
 * for the cohort. The E.1.3 derive depends on launch_year and skips
 * with `derived skip — programs.launch_year is null` when absent.
 *
 * Curated map below. Each row carries a year + a one-line source
 * note. Years are best-evidence dates of the programme in its
 * CURRENT form: a major reform that creates a distinct legal basis
 * resets the clock; minor amendments do not. This matches the
 * methodology-v1 E.1.3 prompt verbatim.
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx seed-launch-years.ts            (dry run)
 *   pnpm --filter @gtmi/scripts exec tsx seed-launch-years.ts --execute  (apply)
 *   pnpm --filter @gtmi/scripts exec tsx seed-launch-years.ts --execute --force
 *     # --force overwrites existing launch_year values; default skips them.
 *
 * Read-only by default. The DB write is a single UPDATE per programme
 * keyed on (country_iso, name) so re-runs are idempotent. Programmes
 * not in this map are left untouched.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { db, programs } from '@gtmi/db';
import { and, eq } from 'drizzle-orm';

dotenv.config({ path: join(__dirname, '../.env') });

interface LaunchYearEntry {
  countryIso: string;
  name: string;
  year: number;
  note: string;
}

const LAUNCH_YEARS: LaunchYearEntry[] = [
  // AUS
  {
    countryIso: 'AUS',
    name: 'Skills in Demand 482 – Core Skills Stream',
    year: 2024,
    note: 'SID 482 replaced TSS 482 in late 2024.',
  },
  {
    countryIso: 'AUS',
    name: 'Skills in Demand 482 – Specialist Skills Stream',
    year: 2024,
    note: 'SID 482 replaced TSS 482 in late 2024.',
  },
  {
    countryIso: 'AUS',
    name: 'Skills in Demand 482 – Labour Agreement Stream',
    year: 2024,
    note: 'SID 482 replaced TSS 482 in late 2024.',
  },
  {
    countryIso: 'AUS',
    name: 'Skilled Independent (subclass 189) - Points Tested Stream',
    year: 2012,
    note: 'Subclass 189 introduced 1 July 2012.',
  },
  {
    countryIso: 'AUS',
    name: 'Skilled Independent (subclass 189) - Hong Kong Stream',
    year: 2020,
    note: 'HK stream introduced 2020 in response to NSL.',
  },
  {
    countryIso: 'AUS',
    name: 'Skilled Nominated (subclass 190)',
    year: 2012,
    note: 'Subclass 190 introduced 1 July 2012.',
  },
  {
    countryIso: 'AUS',
    name: 'Employer Nomination Scheme (subclass 186) - Direct Entry Stream',
    year: 2012,
    note: 'ENS 186 reformed 1 July 2012.',
  },
  {
    countryIso: 'AUS',
    name: 'Employer Nomination Scheme (subclass 186) - Temporary Residence Transition Stream',
    year: 2012,
    note: 'ENS 186 TRT stream introduced 1 July 2012.',
  },
  {
    countryIso: 'AUS',
    name: 'Employer Nomination Scheme (subclass 186) - Labour Agreement Stream',
    year: 2012,
    note: 'ENS 186 reformed 1 July 2012.',
  },
  {
    countryIso: 'AUS',
    name: 'Global Talent Visa (subclass 858)',
    year: 2019,
    note: 'GTV 858 reform / re-launch 2019.',
  },
  {
    countryIso: 'AUS',
    name: 'National Innovation Visa',
    year: 2024,
    note: 'NIV announced 2024 to replace 858 GTV path.',
  },
  {
    countryIso: 'AUS',
    name: 'Business Innovation and Investment (subclass 188A)',
    year: 2012,
    note: 'BIIP reformed 1 July 2012.',
  },

  // GBR
  {
    countryIso: 'GBR',
    name: 'Skilled Worker Visa',
    year: 2020,
    note: 'Post-Brexit immigration system; SW Visa from December 2020.',
  },
  {
    countryIso: 'GBR',
    name: 'Global Talent Visa',
    year: 2020,
    note: 'GTV launched February 2020.',
  },
  {
    countryIso: 'GBR',
    name: 'High Potential Individual (HPI) Visa',
    year: 2022,
    note: 'HPI launched 30 May 2022.',
  },
  {
    countryIso: 'GBR',
    name: 'Innovator Founder Visa',
    year: 2023,
    note: 'Replaced Innovator + Start-up routes April 2023.',
  },

  // CAN
  {
    countryIso: 'CAN',
    name: 'Express Entry – Federal Skilled Worker',
    year: 2015,
    note: 'Express Entry system launched January 2015.',
  },
  {
    countryIso: 'CAN',
    name: 'Global Talent Stream',
    year: 2017,
    note: 'GTS launched 12 June 2017.',
  },
  {
    countryIso: 'CAN',
    name: 'Provincial Nominee Program (PNP)',
    year: 1998,
    note: 'PNP framework dates to 1998 (capped at 20).',
  },
  {
    countryIso: 'CAN',
    name: 'Start-up Visa Program',
    year: 2018,
    note: 'SUV made permanent April 2018 (pilot 2013).',
  },

  // SGP
  {
    countryIso: 'SGP',
    name: 'Employment Pass (EP)',
    year: 1998,
    note: 'EP framework predates 2005 (capped at 20).',
  },
  { countryIso: 'SGP', name: 'S Pass', year: 2004, note: 'S Pass introduced July 2004.' },
  { countryIso: 'SGP', name: 'ONE Pass', year: 2023, note: 'ONE Pass live from 1 January 2023.' },
  { countryIso: 'SGP', name: 'Tech.Pass', year: 2021, note: 'Tech.Pass live from January 2021.' },
  { countryIso: 'SGP', name: 'EntrePass', year: 2003, note: 'EntrePass introduced October 2003.' },

  // HKG
  {
    countryIso: 'HKG',
    name: 'General Employment Policy (GEP)',
    year: 2003,
    note: 'GEP from 2003 (replaces older GEPs).',
  },
  {
    countryIso: 'HKG',
    name: 'Quality Migrant Admission Scheme (QMAS)',
    year: 2006,
    note: 'QMAS launched June 2006.',
  },
  {
    countryIso: 'HKG',
    name: 'Top Talent Pass Scheme (TTPS)',
    year: 2022,
    note: 'TTPS launched 28 December 2022.',
  },
  {
    countryIso: 'HKG',
    name: 'Technology Talent Admission Scheme (TechTAS)',
    year: 2018,
    note: 'TechTAS launched June 2018.',
  },

  // USA
  {
    countryIso: 'USA',
    name: 'H-1B Specialty Occupation',
    year: 1990,
    note: 'H-1B from Immigration Act of 1990 (capped at 20).',
  },
  {
    countryIso: 'USA',
    name: 'O-1 Extraordinary Ability (non-immigrant)',
    year: 1990,
    note: 'O-1 from Immigration Act of 1990 (capped at 20).',
  },
  {
    countryIso: 'USA',
    name: 'EB-1 Extraordinary Ability / Priority Worker',
    year: 1990,
    note: 'EB-1 from Immigration Act of 1990 (capped at 20).',
  },
  {
    countryIso: 'USA',
    name: 'EB-2 Advanced Degree / NIW',
    year: 1990,
    note: 'EB-2 from Immigration Act of 1990 (capped at 20).',
  },

  // NZL
  {
    countryIso: 'NZL',
    name: 'Skilled Migrant Category (SMC)',
    year: 2003,
    note: 'SMC launched December 2003 (replaced GSC).',
  },
  {
    countryIso: 'NZL',
    name: 'Green List (Straight to Residence)',
    year: 2022,
    note: 'Green List live from September 2022.',
  },
  {
    countryIso: 'NZL',
    name: 'Accredited Employer Work Visa (AEWV)',
    year: 2022,
    note: 'AEWV from 4 July 2022.',
  },
  {
    countryIso: 'NZL',
    name: 'Entrepreneur Residence Visa',
    year: 2014,
    note: 'Current ERV form from March 2014.',
  },

  // CHE
  {
    countryIso: 'CHE',
    name: 'B-Permit (Residence Permit for Employment)',
    year: 2008,
    note: 'Current B-Permit framework: Foreign Nationals and Integration Act 2008.',
  },
  {
    countryIso: 'CHE',
    name: 'Highly Qualified Non-EU Worker Quota',
    year: 2008,
    note: 'Non-EU quota system from FNI Act 2008.',
  },

  // NLD
  {
    countryIso: 'NLD',
    name: 'Highly Skilled Migrant (HSM) Permit',
    year: 2004,
    note: 'Kennismigrant introduced 1 October 2004.',
  },
  {
    countryIso: 'NLD',
    name: 'EU Blue Card',
    year: 2011,
    note: 'NL EU Blue Card transposed 19 June 2011.',
  },
  {
    countryIso: 'NLD',
    name: 'Orientation Year (Zoekjaar)',
    year: 2007,
    note: 'Zoekjaar from 1 January 2007.',
  },
  {
    countryIso: 'NLD',
    name: 'Startup Visa (Startupvisum)',
    year: 2015,
    note: 'Startupvisum from 1 January 2015.',
  },

  // DEU
  {
    countryIso: 'DEU',
    name: 'EU Blue Card Germany',
    year: 2012,
    note: 'DE Blue Card transposed 1 August 2012.',
  },
  {
    countryIso: 'DEU',
    name: 'Skilled Worker Visa (Fachkräfteeinwanderungsgesetz)',
    year: 2020,
    note: 'Fachkräfteeinwanderungsgesetz live 1 March 2020 (revised 2023).',
  },
  {
    countryIso: 'DEU',
    name: 'Opportunity Card (Chancenkarte)',
    year: 2024,
    note: 'Chancenkarte live 1 June 2024.',
  },
  {
    countryIso: 'DEU',
    name: 'Freiberufler Visa (Liberal Professions)',
    year: 2005,
    note: 'Freiberufler residence permit AufenthG §21 (2005).',
  },

  // FRA
  {
    countryIso: 'FRA',
    name: 'Talent Passport (Passeport Talent)',
    year: 2016,
    note: 'Passeport Talent from 1 November 2016.',
  },
  {
    countryIso: 'FRA',
    name: 'Talent Passport – Company Creation',
    year: 2016,
    note: 'Passeport Talent variant from 2016.',
  },
  {
    countryIso: 'FRA',
    name: 'French Tech Visa',
    year: 2017,
    note: 'French Tech Visa live June 2017.',
  },
  {
    countryIso: 'FRA',
    name: 'EU Blue Card (Carte Bleue Européenne)',
    year: 2011,
    note: 'FR EU Blue Card transposed 19 June 2011.',
  },

  // IRL
  {
    countryIso: 'IRL',
    name: 'Critical Skills Employment Permit',
    year: 2014,
    note: 'CSEP from 1 October 2014.',
  },
  {
    countryIso: 'IRL',
    name: 'General Employment Permit',
    year: 2014,
    note: 'GEP from 1 October 2014.',
  },
  {
    countryIso: 'IRL',
    name: 'Start-up Entrepreneur Programme (STEP)',
    year: 2012,
    note: 'STEP from 24 January 2012.',
  },

  // LUX
  {
    countryIso: 'LUX',
    name: 'EU Blue Card',
    year: 2011,
    note: 'LU EU Blue Card transposed 19 June 2011.',
  },
  {
    countryIso: 'LUX',
    name: 'Single Permit (Employed Persons)',
    year: 2017,
    note: 'LU Single Permit transposed 8 March 2017.',
  },

  // ISL
  {
    countryIso: 'ISL',
    name: 'Work Permit for Skilled Workers',
    year: 2002,
    note: 'Current Skilled Workers permit Act 97/2002.',
  },

  // SWE
  {
    countryIso: 'SWE',
    name: 'Work Permit (Non-EU)',
    year: 2008,
    note: 'Current employer-driven framework from 15 December 2008.',
  },
  {
    countryIso: 'SWE',
    name: 'EU Blue Card',
    year: 2013,
    note: 'SE EU Blue Card transposed August 2013.',
  },

  // BEL
  {
    countryIso: 'BEL',
    name: 'Single Permit (Highly Qualified)',
    year: 2019,
    note: 'BE Single Permit live 3 January 2019.',
  },
  {
    countryIso: 'BEL',
    name: 'European Blue Card (Belgium)',
    year: 2012,
    note: 'BE EU Blue Card transposed 4 May 2012.',
  },

  // AUT
  {
    countryIso: 'AUT',
    name: 'Red-White-Red Card (Skilled Workers)',
    year: 2011,
    note: 'RWR Card live 1 July 2011.',
  },
  {
    countryIso: 'AUT',
    name: 'EU Blue Card Austria',
    year: 2011,
    note: 'AT EU Blue Card transposed 1 July 2011.',
  },

  // FIN
  {
    countryIso: 'FIN',
    name: 'Residence Permit for Employed Person',
    year: 2004,
    note: 'Current TTOL permit Aliens Act 2004.',
  },
  {
    countryIso: 'FIN',
    name: 'EU Blue Card Finland',
    year: 2012,
    note: 'FI EU Blue Card transposed 1 January 2012.',
  },

  // EST
  {
    countryIso: 'EST',
    name: 'Startup Visa',
    year: 2017,
    note: 'EST Startup Visa live 18 January 2017.',
  },
  {
    countryIso: 'EST',
    name: 'Digital Nomad Visa (D-visa)',
    year: 2020,
    note: 'EST DNV live 1 August 2020.',
  },
  {
    countryIso: 'EST',
    name: 'Work Permit / Short-term Employment',
    year: 2017,
    note: 'STE framework from Aliens Act amendments 2017.',
  },

  // LTU
  {
    countryIso: 'LTU',
    name: 'Single Permit for Employment',
    year: 2019,
    note: 'LT Single Permit consolidated 2019.',
  },

  // NOR
  {
    countryIso: 'NOR',
    name: 'Skilled Worker Permit',
    year: 2010,
    note: 'Current Skilled Worker framework from Immigration Act 2010.',
  },

  // TWN
  {
    countryIso: 'TWN',
    name: 'Employment Gold Card',
    year: 2018,
    note: 'Gold Card live 8 February 2018.',
  },
  {
    countryIso: 'TWN',
    name: 'Work Permit for Professionals',
    year: 1992,
    note: 'Employment Services Act 1992 (capped at 20).',
  },

  // CHL
  {
    countryIso: 'CHL',
    name: 'Residencia Temporal – Paid Lawful Activities',
    year: 2022,
    note: 'New Migration Law (21.325) effective 12 February 2022.',
  },

  // MYS
  {
    countryIso: 'MYS',
    name: 'Employment Pass (EP)',
    year: 2017,
    note: 'Current ESD-MyXpats EP framework from 2017.',
  },
  {
    countryIso: 'MYS',
    name: 'Premium Visa Programme (PVIP)',
    year: 2022,
    note: 'PVIP live 1 October 2022.',
  },
  {
    countryIso: 'MYS',
    name: 'Tech Entrepreneur Programme',
    year: 2017,
    note: 'MDEC TEP live 2017.',
  },

  // NAM
  {
    countryIso: 'NAM',
    name: 'Employment Permit (Long-Term, >6 months)',
    year: 1993,
    note: 'Immigration Control Act 1993 (capped at 20).',
  },
  {
    countryIso: 'NAM',
    name: 'Short-Term Employment Permit / Work Visa (≤6 months)',
    year: 1993,
    note: 'Immigration Control Act 1993 (capped at 20).',
  },

  // ARE
  {
    countryIso: 'ARE',
    name: 'Golden Visa (Skilled Workers)',
    year: 2019,
    note: 'Golden Visa launched May 2019.',
  },
  {
    countryIso: 'ARE',
    name: 'Green Visa (Self-sponsored)',
    year: 2022,
    note: 'Green Visa live 3 October 2022.',
  },
  {
    countryIso: 'ARE',
    name: 'Standard Work Permit',
    year: 1980,
    note: 'Standard work permit framework predates 2006 (capped at 20).',
  },

  // SAU
  {
    countryIso: 'SAU',
    name: 'Premium Residency (Green Card)',
    year: 2019,
    note: 'Premium Residency live 13 June 2019.',
  },
  {
    countryIso: 'SAU',
    name: 'Special Talent Residency',
    year: 2024,
    note: 'Special Talent Residency announced March 2024.',
  },
  {
    countryIso: 'SAU',
    name: 'Work Visa / Iqama',
    year: 1990,
    note: 'Iqama framework predates 2006 (capped at 20).',
  },

  // BHR
  {
    countryIso: 'BHR',
    name: 'Golden Residency Permit',
    year: 2022,
    note: 'Golden Residency live 13 January 2022.',
  },
  {
    countryIso: 'BHR',
    name: 'LMRA Work Permit',
    year: 2009,
    note: 'LMRA Flexi-permit framework from LMRA Act 2006 (live 2009).',
  },

  // OMN
  {
    countryIso: 'OMN',
    name: 'Employment (Work) Visa – Standard (2-year)',
    year: 2003,
    note: 'Foreigners Residence Act 2003.',
  },

  // JPN
  {
    countryIso: 'JPN',
    name: 'Highly Skilled Professional Visa (HSP)',
    year: 2015,
    note: 'HSP residence status live 1 April 2015 (points system 2012).',
  },
  {
    countryIso: 'JPN',
    name: 'J-Skip / J-Find (Global Startup Visa)',
    year: 2023,
    note: 'J-Skip + J-Find launched April 2023.',
  },
  {
    countryIso: 'JPN',
    name: 'Specified Skilled Worker (SSW) Visa',
    year: 2019,
    note: 'SSW live 1 April 2019.',
  },
  {
    countryIso: 'JPN',
    name: 'Startup Visa (Municipal)',
    year: 2015,
    note: 'Municipal startup visa pilot from January 2015 (Fukuoka).',
  },
];

interface CliArgs {
  execute: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  return {
    execute: argv.includes('--execute'),
    force: argv.includes('--force'),
  };
}

async function main(): Promise<void> {
  const { execute, force } = parseArgs(process.argv.slice(2));

  console.log(
    `[seed-launch-years] ${LAUNCH_YEARS.length} curated rows; mode=${execute ? 'EXECUTE' : 'DRY-RUN'}${force ? ' (force overwrite)' : ''}`
  );

  let updated = 0;
  let skippedExisting = 0;
  let notFound = 0;
  for (const entry of LAUNCH_YEARS) {
    const matches = await db
      .select({ id: programs.id, currentLy: programs.launchYear })
      .from(programs)
      .where(and(eq(programs.countryIso, entry.countryIso), eq(programs.name, entry.name)))
      .limit(1);
    if (matches.length === 0) {
      console.log(`  NOT FOUND  ${entry.countryIso}  ${entry.name}`);
      notFound++;
      continue;
    }
    const row = matches[0]!;
    if (row.currentLy !== null && !force) {
      console.log(
        `  SKIP       ${entry.countryIso}  ${entry.name}  (already=${row.currentLy}; pass --force to overwrite)`
      );
      skippedExisting++;
      continue;
    }
    if (row.currentLy === entry.year && !force) {
      console.log(`  ALREADY    ${entry.countryIso}  ${entry.name}  (already=${entry.year})`);
      skippedExisting++;
      continue;
    }
    if (!execute) {
      console.log(
        `  WOULD SET  ${entry.countryIso}  ${entry.name}  → ${entry.year}  (${entry.note})`
      );
      updated++;
      continue;
    }
    await db.update(programs).set({ launchYear: entry.year }).where(eq(programs.id, row.id));
    console.log(`  SET        ${entry.countryIso}  ${entry.name}  → ${entry.year}`);
    updated++;
  }
  console.log(
    `\n[seed-launch-years] ${execute ? 'updated' : 'would update'}=${updated}, skipped (existing)=${skippedExisting}, not_found=${notFound}, total_curated=${LAUNCH_YEARS.length}`
  );
  if (!execute) {
    console.log('Pass --execute to apply.');
  }
  process.exit(0);
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
