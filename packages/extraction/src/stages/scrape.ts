import type { DiscoveredUrl, ScrapeResult } from '../types/extraction';
import type { ScrapeStage } from '../types/pipeline';

interface ScrapeStageOptions {
  delayMs?: number;
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
    const SCRAPER_URL = process.env['SCRAPER_URL'] ?? 'http://localhost:8765';

    try {
      const health = await fetch(`${SCRAPER_URL}/health`);
      if (!health.ok) throw new Error('unhealthy');
    } catch {
      throw new Error(
        'Python scraper service is not running. ' +
          'Start it with: uvicorn main:app --host 0.0.0.0 --port 8765 ' +
          'from the scraper/ directory.'
      );
    }

    const results: ScrapeResult[] = [];
    let first = true;

    for (const discovered of discoveredUrls) {
      if (!first) await sleep(this.delayMs);
      first = false;
      results.push(await this.scrapeOne(discovered, SCRAPER_URL));
    }

    return results;
  }

  private async scrapeOne(discovered: DiscoveredUrl, scraperUrl: string): Promise<ScrapeResult> {
    const response = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: discovered.url,
        only_main_content: true,
      }),
      signal: AbortSignal.timeout(45000),
    }).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      const wrapped = new Error(`Scraper service unreachable for ${discovered.url}: ${msg}`);
      if (discovered.tier === 1) throw wrapped;
      console.error(wrapped.message);
      return null;
    });

    // TODO: archive source page to Wayback Machine Save Page Now API (Phase 5 scope)

    if (response === null) {
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: '',
        scrapedAt: new Date(),
        httpStatus: 0,
      };
    }

    if (!response.ok) {
      const msg = `Scraper service error for ${discovered.url}: HTTP ${response.status}`;
      if (discovered.tier === 1) throw new Error(msg);
      console.error(msg);
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: '',
        scrapedAt: new Date(),
        httpStatus: response.status,
      };
    }

    const data = (await response.json()) as {
      content_markdown: string;
      http_status: number;
      scraped_at: string;
      content_hash: string;
      error?: string | null;
    };

    if (data.error) {
      if (discovered.tier === 1) {
        throw new Error(`Scraper threw for ${discovered.url}: ${data.error}`);
      }
      console.error(`Scraper threw for ${discovered.url}: ${data.error}`);
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: '',
        scrapedAt: new Date(),
        httpStatus: 0,
      };
    }

    const content =
      data.content_markdown.length > 30000
        ? data.content_markdown.slice(0, 30000)
        : data.content_markdown;

    return {
      url: discovered.url,
      contentMarkdown: content,
      httpStatus: data.http_status,
      scrapedAt: new Date(data.scraped_at),
      contentHash: data.content_hash,
    };
  }
}
