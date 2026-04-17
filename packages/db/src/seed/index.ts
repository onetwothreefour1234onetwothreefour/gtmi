import { db, client } from '../client';
import {
  countries,
  programs,
  sources,
  fieldDefinitions,
  methodologyVersions,
  newsSources,
} from '../schema';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { eq, and } from 'drizzle-orm';
import { methodologyV1 } from './methodology-v1';

async function seed() {
  console.log('Starting database seed...');

  // 1. Countries
  const countriesPath = path.join(__dirname, '../../../../docs/existing-assets/countries.csv');
  if (!fs.existsSync(countriesPath)) {
    throw new Error(`Critical seed file missing: ${countriesPath}`);
  }
  console.log('Seeding countries...');
  const countriesCsv = fs.readFileSync(countriesPath, 'utf8');
  const countryRows: Record<string, string>[] = parse(countriesCsv, {
    columns: true,
  });

  for (const record of countryRows) {
    const isoCode = record['Country ISO'] || record['ISO'];
    if (!isoCode)
      throw new Error(
        `Malformed row in countries.csv: missing ISO code for ${record['Country Name'] || record['Country']}`
      );

    const imdRank = parseInt(record['IMD Rank']) || null;
    const imdAppealScore = parseFloat(record['IMD Appeal Score']) || null;

    await db
      .insert(countries)
      .values({
        isoCode: isoCode,
        name: record['Country Name'] || record['Country'] || 'Unknown',
        region: record['Region'] || 'Unknown',
        imdRank: imdRank,
        imdAppealScore: imdAppealScore?.toString(),
        imdAppealScoreCmeNormalized: null,
        govPortalUrl: null,
        taxAuthorityUrl: null,
        lastImdRefresh: new Date(),
      })
      .onConflictDoUpdate({
        target: countries.isoCode,
        set: {
          name: record['Country Name'] || record['Country'] || 'Unknown',
          region: record['Region'] || 'Unknown',
        },
      });
  }

  // 2. Programs and Sources
  const programsPath = path.join(
    __dirname,
    '../../../../docs/existing-assets/programs_and_sources.csv'
  );
  if (!fs.existsSync(programsPath)) {
    throw new Error(`Critical seed file missing: ${programsPath}`);
  }
  console.log('Seeding programs and sources...');
  const programsCsv = fs.readFileSync(programsPath, 'utf8');
  const programRows: Record<string, string>[] = parse(programsCsv, {
    columns: true,
  });

  for (const record of programRows) {
    const countryIso = record['Country ISO'] || record['ISO'];
    const programName = record['Program Name'] || record['Program'];
    const officialUrl = record['Official URL'] || record['URL'];

    if (!countryIso || !programName) {
      throw new Error(`Malformed row in programs_and_sources.csv: missing ISO or program name`);
    }

    // Query first since no unique constraint on (countryIso, name)
    const programRecords = await db
      .select()
      .from(programs)
      .where(and(eq(programs.countryIso, countryIso), eq(programs.name, programName)))
      .limit(1);

    let programId: string;

    if (programRecords.length === 0) {
      const inserted = await db
        .insert(programs)
        .values({
          countryIso,
          name: programName,
          category: 'general',
          status: 'active',
        })
        .returning({ id: programs.id });
      programId = inserted[0].id;
    } else {
      programId = programRecords[0].id;
    }

    // Upsert Source
    if (officialUrl) {
      await db
        .insert(sources)
        .values({
          programId,
          url: officialUrl,
          tier: 1,
          sourceCategory: 'government',
          isPrimary: true,
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: {
            tier: 1,
            isPrimary: true,
          },
        });
    }
  }
  // 3. News Sources
  const newsSourcesPath = path.join(__dirname, '../../../../docs/existing-assets/news_sources.csv');
  if (!fs.existsSync(newsSourcesPath)) {
    throw new Error(`Critical seed file missing: ${newsSourcesPath}`);
  }
  console.log('Seeding news sources...');
  const newsSourcesCsv = fs.readFileSync(newsSourcesPath, 'utf8');
  const newsSourceRows: Record<string, string>[] = parse(newsSourcesCsv, {
    columns: true,
  });

  for (const record of newsSourceRows) {
    const url =
      record['URL'] || record['Official URL'] || record['Base URL'] || record['Section URL'];
    const publication =
      record['Publication Name'] ||
      record['Publication'] ||
      record['Website / Publication'] ||
      'Unknown';

    if (!url) throw new Error(`Malformed row in news_sources.csv: missing URL for ${publication}`);

    await db
      .insert(newsSources)
      .values({
        url,
        publication,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: newsSources.url,
        set: {
          publication,
        },
      });
  }

  // 4. Field Definitions
  console.log('Seeding field definitions...');
  for (const ind of methodologyV1.indicators) {
    await db
      .insert(fieldDefinitions)
      .values({
        key: ind.key,
        label: ind.label,
        dataType: ind.dataType,
        pillar: ind.pillar,
        subFactor: ind.subFactor,
        weightWithinSubFactor: String(ind.weightWithinSubFactor),
        extractionPromptMd: ind.extractionPromptMd,
        scoringRubricJsonb: ind.scoringRubricJsonb,
        normalizationFn: ind.normalizationFn,
        direction: ind.direction,
        sourceTierRequired: ind.sourceTierRequired,
        versionIntroduced: methodologyV1.version_tag,
      })
      .onConflictDoUpdate({
        target: fieldDefinitions.key,
        set: {
          label: ind.label,
          dataType: ind.dataType,
          pillar: ind.pillar,
          subFactor: ind.subFactor,
          weightWithinSubFactor: String(ind.weightWithinSubFactor),
          extractionPromptMd: ind.extractionPromptMd,
          scoringRubricJsonb: ind.scoringRubricJsonb,
          normalizationFn: ind.normalizationFn,
          direction: ind.direction,
          sourceTierRequired: ind.sourceTierRequired,
          versionIntroduced: methodologyV1.version_tag,
        },
      });
  }

  // 5. Methodology Versions
  console.log('Seeding methodology versions...');
  const v1Exists = await db
    .select()
    .from(methodologyVersions)
    .where(eq(methodologyVersions.versionTag, methodologyV1.version_tag))
    .limit(1);

  if (v1Exists.length === 0) {
    await db.insert(methodologyVersions).values({
      versionTag: methodologyV1.version_tag,
      changeNotes: 'Initial methodology V1 derived from docs/METHODOLOGY.md',
      frameworkStructure: methodologyV1.framework_structure,
      pillarWeights: methodologyV1.pillar_weights,
      subFactorWeights: methodologyV1.sub_factor_weights,
      indicatorWeights: methodologyV1.indicator_weights,
      normalizationChoices: methodologyV1.normalization_choices,
      rubricVersions: {},
      cmePaqSplit: methodologyV1.cme_paq_split,
      publishedAt: new Date(),
    });
  } else {
    await db
      .update(methodologyVersions)
      .set({
        frameworkStructure: methodologyV1.framework_structure,
        pillarWeights: methodologyV1.pillar_weights,
        subFactorWeights: methodologyV1.sub_factor_weights,
        indicatorWeights: methodologyV1.indicator_weights,
        normalizationChoices: methodologyV1.normalization_choices,
        cmePaqSplit: methodologyV1.cme_paq_split,
      })
      .where(eq(methodologyVersions.versionTag, methodologyV1.version_tag));
  }

  console.log('Seeding completed successfully.');
  await client.end();
}

seed().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
