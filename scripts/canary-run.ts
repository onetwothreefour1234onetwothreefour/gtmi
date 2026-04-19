import {
  CrossCheckStageImpl,
  DiscoverStageImpl,
  ExtractStageImpl,
  HumanReviewStageImpl,
  PublishStageImpl,
  ScrapeStageImpl,
  ValidateStageImpl,
} from '@gtmi/extraction';
import type {
  CrossCheckOutcome,
  CrossCheckResult,
  DiscoveredUrl,
  ProvenanceRecord,
  ScrapeResult,
} from '@gtmi/extraction';
import { db, fieldDefinitions, programs } from '@gtmi/db';
import { and, eq, ilike } from 'drizzle-orm';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

async function main() {
  // Find target program
  const rows = await db
    .select()
    .from(programs)
    .where(and(eq(programs.countryIso, 'AUS'), ilike(programs.name, '%Skills in Demand%')));

  if (rows.length === 0) {
    const ausRows = await db.select().from(programs).where(eq(programs.countryIso, 'AUS'));
    const names = ausRows.map((r) => `  - ${r.name}`).join('\n');
    throw new Error(
      `No AUS program matching "%Skills in Demand%" found.\nExisting AUS programs:\n${names}`
    );
  }

  const program = rows[0];
  const { id: programId, name: programName, countryIso } = program;
  console.log(`Target: [${programId}] ${programName} (${countryIso})`);

  // Stage 0: Discover
  const discover = new DiscoverStageImpl();
  const discoveryResult = await discover.execute(programId, programName, countryIso);
  console.log(`Stage 0 complete: ${discoveryResult.discoveredUrls.length} URLs discovered`);

  // Stage 1: Scrape
  const scrape = new ScrapeStageImpl();
  const scrapeResults = await scrape.execute(discoveryResult.discoveredUrls);
  console.log(`Stage 1 complete: ${scrapeResults.length} URLs scraped`);

  const scrapeByUrl = new Map<string, ScrapeResult>();
  for (const sr of scrapeResults) scrapeByUrl.set(sr.url, sr);

  const discoveredByUrl = new Map<string, DiscoveredUrl>();
  for (const du of discoveryResult.discoveredUrls) discoveredByUrl.set(du.url, du);

  const tier1Scrapes = scrapeResults.filter((sr) => discoveredByUrl.get(sr.url)?.tier === 1);

  const tier2DiscoveredUrl = discoveryResult.discoveredUrls.find((u) => u.tier === 2);
  const tier2Scrape: ScrapeResult | null = tier2DiscoveredUrl
    ? (scrapeByUrl.get(tier2DiscoveredUrl.url) ?? null)
    : null;

  // A discovered-but-failed scrape (httpStatus 0, empty content) is treated as not-checked,
  // not as a disagreement — same outcome as no Tier 2 URL being discovered.
  const effectiveTier2Scrape: ScrapeResult | null =
    tier2Scrape !== null && tier2Scrape.httpStatus !== 0 && tier2Scrape.contentMarkdown !== ''
      ? tier2Scrape
      : null;

  // Pre-loop: load field definitions
  const allFieldDefs = await db.select().from(fieldDefinitions);
  const fieldPrompts = new Map<string, string>();
  for (const def of allFieldDefs) fieldPrompts.set(def.key, def.extractionPromptMd);
  console.log(`Pre-loop: ${allFieldDefs.length} field definitions loaded`);

  const extract = new ExtractStageImpl(fieldPrompts);
  const validate = new ValidateStageImpl();
  const crossCheckStage = new CrossCheckStageImpl();
  const humanReview = new HumanReviewStageImpl();
  const publish = new PublishStageImpl();

  let fieldsExtracted = 0;
  let fieldsAutoApproved = 0;
  let fieldsQueued = 0;

  // Per-field pipeline loop
  for (const def of allFieldDefs) {
    const { output: extraction, sourceUrl } = await extract.executeMulti(
      tier1Scrapes,
      def.key,
      programId
    );

    if (extraction.valueRaw === '') continue;
    fieldsExtracted++;

    const winningScrape = scrapeByUrl.get(sourceUrl);
    if (!winningScrape) {
      throw new Error(
        `No scrape result found for source URL "${sourceUrl}" on field "${def.key}" — this is a bug`
      );
    }
    const winningDiscovered = discoveredByUrl.get(sourceUrl);
    if (!winningDiscovered) {
      throw new Error(
        `No discovered URL entry found for source URL "${sourceUrl}" on field "${def.key}" — this is a bug`
      );
    }

    const validation = await validate.execute(extraction, winningScrape);

    let crossCheck: CrossCheckResult;
    let crossCheckOutcome: CrossCheckOutcome;

    if (effectiveTier2Scrape !== null) {
      crossCheck = await crossCheckStage.execute(extraction, effectiveTier2Scrape);
      crossCheckOutcome = crossCheck.agrees ? 'agree' : 'disagree';
    } else {
      crossCheck = { agrees: true, tier2Url: '', notes: 'No Tier 2 source discovered' };
      crossCheckOutcome = 'not_checked';
    }

    const isAutoApproved =
      extraction.extractionConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
      validation.isValid &&
      validation.validationConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
      (crossCheck.agrees || crossCheckOutcome === 'not_checked');

    if (!isAutoApproved) {
      await humanReview.enqueue(extraction, validation, crossCheck);
      fieldsQueued++;
      continue;
    }

    const provenance: ProvenanceRecord = {
      sourceUrl,
      geographicLevel: winningDiscovered.geographicLevel,
      sourceTier: winningDiscovered.tier,
      scrapeTimestamp: winningScrape.scrapedAt.toISOString(),
      contentHash: winningScrape.contentHash,
      sourceSentence: extraction.sourceSentence,
      characterOffsets: extraction.characterOffsets,
      extractionModel: extraction.extractionModel,
      extractionConfidence: extraction.extractionConfidence,
      validationModel: validation.validationModel,
      validationConfidence: validation.validationConfidence,
      crossCheckResult: crossCheckOutcome,
      crossCheckUrl: effectiveTier2Scrape?.url ?? null,
      reviewedBy: 'auto',
      reviewedAt: new Date(),
      methodologyVersion: METHODOLOGY_VERSION,
      reviewDecision: 'approve',
    };

    await publish.execute(extraction, validation, provenance);
    fieldsAutoApproved++;
    console.log(`  Published field "${def.key}"`);
  }

  console.log('\n--- Canary Run Summary ---');
  console.table({
    'URLs discovered': discoveryResult.discoveredUrls.length,
    'URLs scraped': scrapeResults.length,
    'Fields extracted': fieldsExtracted,
    'Fields auto-approved': fieldsAutoApproved,
    'Fields queued for review': fieldsQueued,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
