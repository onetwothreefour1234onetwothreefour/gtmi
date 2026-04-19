import { createHash } from 'node:crypto';
import type FirecrawlApp from '@mendable/firecrawl-js';
import { createFirecrawlClient } from '../clients/firecrawl';
import type { DiscoveredUrl, ScrapeResult } from '../types/extraction';
import type { ScrapeStage } from '../types/pipeline';

interface ScrapeStageOptions {
  delayMs?: number;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScrapeStageImpl implements ScrapeStage {
  private readonly delayMs: number;

  constructor(options: ScrapeStageOptions = {}) {
    this.delayMs = options.delayMs ?? 1000;
  }

  async execute(discoveredUrls: DiscoveredUrl[]): Promise<ScrapeResult[]> {
    const client = createFirecrawlClient();
    const results: ScrapeResult[] = [];
    let first = true;

    for (const discovered of discoveredUrls) {
      if (!first) await sleep(this.delayMs);
      first = false;
      results.push(await this.scrapeOne(client, discovered));
    }

    return results;
  }

  private async scrapeOne(client: FirecrawlApp, discovered: DiscoveredUrl): Promise<ScrapeResult> {
    const response = await client
      .scrapeUrl(discovered.url, { formats: ['markdown'] })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        const wrapped = new Error(`Firecrawl threw for ${discovered.url}: ${msg}`);
        if (discovered.tier === 1) throw wrapped;
        console.error(wrapped.message);
        return null;
      });

    // TODO: archive source page to Wayback Machine Save Page Now API (Phase 5 scope)

    if (response === null) {
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: sha256(''),
        scrapedAt: new Date(),
        httpStatus: 0,
      };
    }

    if (!response.success) {
      const msg = `Scrape failed for ${discovered.url}: ${response.error}`;
      if (discovered.tier === 1) throw new Error(msg);
      console.error(msg);
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: sha256(''),
        scrapedAt: new Date(),
        httpStatus: 0,
      };
    }

    const contentMarkdown = response.markdown ?? '';
    const httpStatus = response.metadata?.statusCode ?? 200;

    return {
      url: discovered.url,
      contentMarkdown,
      contentHash: sha256(contentMarkdown),
      scrapedAt: new Date(),
      httpStatus,
    };
  }
}
