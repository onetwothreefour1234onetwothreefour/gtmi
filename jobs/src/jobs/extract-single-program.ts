import { task } from '@trigger.dev/sdk/v3';
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
import { db, fieldDefinitions } from '@gtmi/db';

const METHODOLOGY_VERSION = '1.0.0';
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

interface PipelineResult {
  programId: string;
  urlsDiscovered: number;
  urlsScraped: number;
  fieldsExtracted: number;
  fieldsAutoApproved: number;
  fieldsQueued: number;
}

export const extractSingleProgram = task({
  id: 'extract-single-program',
  run: async (payload: {
    programId: string;
    programName: string;
    country: string;
  }): Promise<PipelineResult> => {
    const { programId, programName, country } = payload;

    // --- Stage 0: Discover ---
    const discover = new DiscoverStageImpl();
    const discoveryResult = await discover.execute(programId, programName, country);
    console.log(
      `Stage 0 complete for ${programId}: ${discoveryResult.discoveredUrls.length} URLs discovered`
    );

    // --- Stage 1: Scrape all discovered URLs ---
    const scrape = new ScrapeStageImpl();
    const scrapeResults = await scrape.execute(discoveryResult.discoveredUrls);
    console.log(`Stage 1 complete for ${programId}: ${scrapeResults.length} URLs scraped`);

    // Build lookup maps keyed by URL for O(1) access later
    const scrapeByUrl = new Map<string, ScrapeResult>();
    for (const sr of scrapeResults) {
      scrapeByUrl.set(sr.url, sr);
    }
    const discoveredByUrl = new Map<string, DiscoveredUrl>();
    for (const du of discoveryResult.discoveredUrls) {
      discoveredByUrl.set(du.url, du);
    }

    // Partition scrape results: tier-1 for extraction, first tier-2 for cross-check
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

    // --- Pre-loop: Load all field definitions from DB ---
    const allFieldDefs = await db.select().from(fieldDefinitions);

    const fieldPrompts = new Map<string, string>();
    for (const def of allFieldDefs) {
      fieldPrompts.set(def.key, def.extractionPromptMd);
    }

    // Instantiate remaining stages
    const extract = new ExtractStageImpl(fieldPrompts);
    const validate = new ValidateStageImpl();
    const crossCheckStage = new CrossCheckStageImpl();
    const humanReview = new HumanReviewStageImpl();
    const publish = new PublishStageImpl();

    let fieldsExtracted = 0;
    let fieldsAutoApproved = 0;
    let fieldsQueued = 0;

    // --- Per-field pipeline loop ---
    for (const def of allFieldDefs) {
      // Stage 2: Extract — pick the best result across all tier-1 scrapes
      const { output: extraction, sourceUrl } = await extract.executeMulti(
        tier1Scrapes,
        def.key,
        programId
      );

      // Nothing was found in any tier-1 source for this field — skip silently
      if (extraction.valueRaw === '') continue;

      fieldsExtracted++;

      // Resolve the winning scrape and its discovery metadata for provenance
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

      // Stage 3: Validate against the winning scrape's content
      const validation = await validate.execute(extraction, winningScrape);

      // Stage 4: Cross-check against tier-2 source, or synthesise a no-op result
      let crossCheck: CrossCheckResult;
      let crossCheckOutcome: CrossCheckOutcome;

      if (effectiveTier2Scrape !== null) {
        crossCheck = await crossCheckStage.execute(extraction, effectiveTier2Scrape);
        crossCheckOutcome = crossCheck.agrees ? 'agree' : 'disagree';
      } else {
        crossCheck = { agrees: true, tier2Url: '', notes: 'No Tier 2 source discovered' };
        crossCheckOutcome = 'not_checked';
      }

      // Auto-approval gate — four explicit conditions per canary run spec
      const isAutoApproved =
        extraction.extractionConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        validation.isValid &&
        validation.validationConfidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD &&
        (crossCheck.agrees || crossCheckOutcome === 'not_checked');

      // Stage 5: Human review — enqueue only; awaitDecision is Phase 4 scope
      if (!isAutoApproved) {
        await humanReview.enqueue(extraction, validation, crossCheck);
        fieldsQueued++;
        continue;
      }

      // Stage 6: Publish auto-approved value with full provenance
      const provenance: ProvenanceRecord = {
        sourceUrl,
        geographicLevel: winningDiscovered.geographicLevel,
        sourceTier: winningDiscovered.tier,
        scrapeTimestamp: winningScrape.scrapedAt,
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
      console.log(`Published field "${def.key}" for program ${programId}`);
    }

    console.log(
      `Pipeline complete for ${programId}: ` +
        `${fieldsExtracted} extracted, ` +
        `${fieldsAutoApproved} auto-approved, ` +
        `${fieldsQueued} queued for review`
    );

    return {
      programId,
      urlsDiscovered: discoveryResult.discoveredUrls.length,
      urlsScraped: scrapeResults.length,
      fieldsExtracted,
      fieldsAutoApproved,
      fieldsQueued,
    };
  },
});
