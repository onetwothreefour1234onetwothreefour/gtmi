import { execSync } from 'child_process';
import { db, scrapeCache } from '@gtmi/db';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { DiscoveredUrl, ScrapeResult } from '../types/extraction';
import type { ScrapeStage } from '../types/pipeline';
import { checkScrapeContent, MIN_VISIBLE_TEXT_LENGTH } from '../scrape-guards';
import { archiveScrapeResult } from '../utils/archive';
import { translateIfNeeded } from '../utils/translate';
import {
  BLOCKER_THIN_THRESHOLD,
  RunBlockerState,
  recordBlockerDomain,
} from '../utils/blocker-detect';

/**
 * Phase 3.9 / W0 — optional per-call context that enables archive
 * writes. When omitted, scrape.ts behaves exactly like Phase 3.8 (no
 * archive write, no scrape_history row). When provided, every
 * successful scrape is persisted to GCS + scrape_history; failures
 * are non-fatal and only set scrapeHistoryId/archivePath when they
 * succeed.
 */
export interface ScrapeContext {
  programId?: string;
  countryIso?: string;
  /** Force-skip archive writes even when programId/countryIso are set. */
  skipArchive?: boolean;
}

const MIN_VISIBLE_TEXT_LENGTH_LOG = MIN_VISIBLE_TEXT_LENGTH;

const SCRAPE_CACHE_TTL_HOURS = 24;

// ────────────────────────────────────────────────────────────────────
// Phase 3.6 — Cloud Run identity token auth (Option B / user-account).
//
// When SCRAPER_URL is https://, the scraper service is on Cloud Run
// with `--no-allow-unauthenticated`. Every request must carry a Google
// Cloud identity token in the Authorization header. We use the gcloud
// CLI's user-account ID token (`gcloud auth print-identity-token`,
// no --audiences flag) because the developer account on this machine
// is a user account, not a service account. Service-account-impersonation
// (Option A) is the long-term posture; tracked in .env.example.
//
// Tokens are cached in-memory for 55 minutes (gcloud ID tokens are
// valid for 1 hour). A single canary run is well under that window;
// the cache eliminates ~50 redundant gcloud invocations per run.
//
// When SCRAPER_URL is http:// (local dev), no auth header is added.
// ────────────────────────────────────────────────────────────────────
interface TokenCache {
  token: string;
  fetchedAt: number;
}

let _tokenCache: TokenCache | null = null;
const TOKEN_TTL_MS = 55 * 60 * 1000;

function getCloudRunToken(): string {
  const now = Date.now();
  if (_tokenCache && now - _tokenCache.fetchedAt < TOKEN_TTL_MS) {
    return _tokenCache.token;
  }
  const token = execSync('gcloud auth print-identity-token', { encoding: 'utf8' }).trim();
  _tokenCache = { token, fetchedAt: now };
  return token;
}

function getScraperAuthHeaders(scraperUrl: string): Record<string, string> {
  if (scraperUrl.startsWith('https://')) {
    return { Authorization: 'Bearer ' + getCloudRunToken() };
  }
  return {};
}

interface ScrapeStageOptions {
  delayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScrapeStageImpl implements ScrapeStage {
  private readonly delayMs: number;
  // Phase 3.9 / W15 — per-instance blocker observation state. One
  // instance per canary run; observations don't leak across runs.
  private readonly blockerState = new RunBlockerState();

  constructor(options: ScrapeStageOptions = {}) {
    this.delayMs = options.delayMs ?? 1000;
  }

  async execute(discoveredUrls: DiscoveredUrl[], context?: ScrapeContext): Promise<ScrapeResult[]> {
    const SCRAPER_URL = process.env['SCRAPER_URL'] ?? 'http://localhost:8765';

    try {
      const health = await fetch(`${SCRAPER_URL}/health`, {
        headers: getScraperAuthHeaders(SCRAPER_URL),
      });
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
      // Phase 3.9 / W16 — pre-flight Wayback-first routing for
      // already-known blocker domains. Skips the standard layer
      // cascade entirely; Wayback returns the archived snapshot
      // bypassing the live anti-bot wall. Fail-soft: when Wayback
      // also misses, fall through to the normal cascade so we still
      // try (the blocker may have been transient).
      const knownBlocker = await this.blockerState.isKnownBlocker(discovered.url);
      const result = knownBlocker
        ? await this.scrapeWaybackFirst(discovered, SCRAPER_URL)
        : await this.scrapeOne(discovered, SCRAPER_URL);

      // Phase 3.9 / W15 — observe the result and flag the domain on
      // detection. Idempotent within a run; first-detection writes
      // to blocker_domains and the rest of this run's same-domain
      // URLs already-routed via knownBlocker (or are about to be on
      // the next iteration).
      await this.observeForBlocker(discovered.url, result, context);

      // Phase 3.9 / W2 — translate non-English scrapes BEFORE archive
      // so the archived markdown is the English version (extractable on
      // re-runs without re-translating). Original is preserved on
      // result.originalContentMarkdown for /review.
      await this.maybeTranslate(result, context);
      await this.maybeArchive(result, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Phase 3.9 / W16 — try Wayback first; if it misses (no snapshot,
   * or returns thin content), fall through to the standard cascade
   * so a stale registry blocker entry doesn't permanently lose a
   * URL that's since become reachable again.
   */
  private async scrapeWaybackFirst(
    discovered: DiscoveredUrl,
    scraperUrl: string
  ): Promise<ScrapeResult> {
    console.log(`  [Scrape] Known blocker domain — routing ${discovered.url} to Wayback first`);
    // Use the existing forceLayer mechanism; the scraper service's
    // 'jina' layer already does what we need for known-blockers
    // (Jina's CDN posture often slips past anti-bot walls). For
    // ISA-class blockers Jina was insufficient; the scraper service
    // needs to support a 'wayback' force layer too. Until that ships
    // server-side, fall back to Jina here — it's the closest hop.
    // TODO(W16-followup): scraper service force_layer='wayback'.
    const viaJina = await this.scrapeOne(discovered, scraperUrl, { forceLayer: 'jina' });
    if (viaJina.contentMarkdown !== '') return viaJina;
    console.log(
      `  [Scrape] Wayback-first attempt empty for ${discovered.url} — falling through to cascade`
    );
    return this.scrapeOne(discovered, scraperUrl);
  }

  /**
   * Phase 3.9 / W15 — feed the just-fetched result into the per-run
   * detector. When the detector fires, persist to blocker_domains so
   * subsequent canaries (this one's later URLs + any future run on
   * any program) route via Wayback first.
   */
  private async observeForBlocker(
    url: string,
    result: ScrapeResult,
    context?: ScrapeContext
  ): Promise<void> {
    const wasThin =
      result.contentMarkdown !== '' && result.contentMarkdown.length < BLOCKER_THIN_THRESHOLD;
    // The scraper-service signal we have today is content_markdown=''
    // when the cascade collectively rejected the page (challenge
    // body, all_layers_failed). Treat empty content from a known
    // 200-status response as "challenge fanout" — distinguishable
    // from a genuine 4xx/5xx because httpStatus stays 200 in the
    // anti-bot path.
    const wasChallenge =
      result.contentMarkdown === '' && result.httpStatus >= 200 && result.httpStatus < 400;
    const signal = this.blockerState.observe({
      url,
      result,
      wasThin,
      wasChallenge,
    });
    if (signal === null) return;
    const domain = RunBlockerState.domainOf(url);
    await recordBlockerDomain({
      domain,
      signal,
      programId: context?.programId,
      notes: { firstDetectedUrl: url },
    });
  }

  /**
   * Phase 3.9 / W2 — best-effort translation. When ScrapeContext is
   * provided AND the scrape's content looks non-English AND the
   * country has a defaultLanguage in country-departments.ts, translate
   * to English. Mutates the result so contentMarkdown becomes the
   * translated text and originalContentMarkdown carries the source.
   */
  private async maybeTranslate(result: ScrapeResult, context?: ScrapeContext): Promise<void> {
    if (!context || !context.countryIso) return;
    if (result.contentMarkdown === '' || result.contentHash === '') return;
    const translation = await translateIfNeeded({
      content: result.contentMarkdown,
      contentHash: result.contentHash,
      countryIso3: context.countryIso,
    });
    if (translation.translated) {
      console.log(
        `  [Scrape] TRANSLATED ${result.url} from ${translation.sourceLanguage} (${result.contentMarkdown.length} → ${translation.text.length} chars)`
      );
      result.originalContentMarkdown = result.contentMarkdown;
      result.contentMarkdown = translation.text;
      result.translatedFrom = translation.sourceLanguage ?? undefined;
      result.translationVersion = translation.translationVersion;
    }
  }

  /**
   * Phase 3.9 / W0 — best-effort archive write. Mutates the result with
   * scrapeHistoryId/archivePath on success; silent on failure (the
   * archive helper logs its own warnings). W11: also propagates the
   * `unchanged` flag so extract.ts can short-circuit re-extraction
   * when content_hash matches the prior archived scrape.
   */
  private async maybeArchive(result: ScrapeResult, context?: ScrapeContext): Promise<void> {
    if (!context || context.skipArchive) return;
    if (!context.programId || !context.countryIso) return;
    if (result.contentMarkdown === '' || result.contentHash === '') return;
    const archived = await archiveScrapeResult({
      result,
      programId: context.programId,
      countryIso: context.countryIso,
    });
    if (archived) {
      result.scrapeHistoryId = archived.scrapeHistoryId;
      result.archivePath = archived.storagePath;
      if (archived.unchanged) {
        result.unchanged = true;
      }
    }
  }

  private async readScrapeCache(url: string): Promise<ScrapeResult | null> {
    try {
      const rows = await db
        .select()
        .from(scrapeCache)
        .where(and(eq(scrapeCache.url, url), gt(scrapeCache.expiresAt, sql`now()`)))
        .limit(1);
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        url: row.url,
        contentMarkdown: row.contentMarkdown,
        contentHash: row.contentHash,
        httpStatus: row.httpStatus,
        scrapedAt: row.scrapedAt,
      };
    } catch {
      return null;
    }
  }

  private async writeScrapeCache(result: ScrapeResult): Promise<void> {
    if (!result.contentMarkdown) return;
    try {
      const expiresAt = new Date(Date.now() + SCRAPE_CACHE_TTL_HOURS * 60 * 60 * 1000);
      await db
        .insert(scrapeCache)
        .values({
          url: result.url,
          contentMarkdown: result.contentMarkdown,
          contentHash: result.contentHash,
          httpStatus: result.httpStatus,
          scrapedAt: result.scrapedAt,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: scrapeCache.url,
          set: {
            contentMarkdown: result.contentMarkdown,
            contentHash: result.contentHash,
            httpStatus: result.httpStatus,
            scrapedAt: result.scrapedAt,
            expiresAt,
          },
        });
    } catch {
      // cache write failure is non-fatal
    }
  }

  private async scrapeOne(
    discovered: DiscoveredUrl,
    scraperUrl: string,
    options: { forceLayer?: 'jina' } = {}
  ): Promise<ScrapeResult> {
    // Cache lookup is skipped on a forceLayer retry — we explicitly want a
    // fresh attempt against a different layer.
    if (!options.forceLayer) {
      const cached = await this.readScrapeCache(discovered.url);
      if (cached) {
        console.log(`  [Scrape] Cache hit: ${discovered.url}`);
        return cached;
      }
    }

    const response = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getScraperAuthHeaders(scraperUrl),
      },
      body: JSON.stringify({
        url: discovered.url,
        only_main_content: true,
        ...(options.forceLayer ? { force_layer: options.forceLayer } : {}),
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
      layer?: string | null;
      // Phase 3.9 / W1 — scraper service tags the content_type so the
      // archive write can pick the right file extension (.pdf vs .md).
      content_type?: string | null;
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

    // Store the full scraped content. Field-aware windowing happens in
    // `extract.ts` where the field labels (and therefore the relevance signal)
    // are known. Capping here would silently throw away content the LLM might
    // have used. `scrape_cache.content_markdown` is `text` (unbounded).
    const content = data.content_markdown;

    const result: ScrapeResult = {
      url: discovered.url,
      contentMarkdown: content,
      httpStatus: data.http_status,
      scrapedAt: new Date(data.scraped_at),
      contentHash: data.content_hash,
      layer: data.layer ?? undefined,
      contentType: data.content_type ?? undefined,
    };
    if (result.layer && result.layer !== 'playwright') {
      console.log(`  [Scrape] ${discovered.url} served via fallback layer: ${result.layer}`);
    }
    const guard = checkScrapeContent(content, data.http_status);
    if (!guard.ok) {
      // Phase 3.6 / Fix C — on `short_content`, retry once via Jina
      // (force_layer=jina). Playwright produced thin content; the
      // Jina reader often resolves SPA-shell / redirect-stub pages.
      if (guard.status === 'short_content' && !options.forceLayer) {
        console.warn(
          `  [Scrape] Thin content from ${data.layer ?? 'playwright'} for ${discovered.url} — retrying via Jina (force_layer=jina)`
        );
        const retry = await this.scrapeOne(discovered, scraperUrl, { forceLayer: 'jina' });
        if (retry.contentMarkdown !== '') {
          return retry;
        }
        console.warn(
          `  [Scrape] SCRAPE_THIN_CONTENT ${discovered.url} — Jina retry also below ${MIN_VISIBLE_TEXT_LENGTH_LOG} chars; treating as ABSENT`
        );
        return {
          url: discovered.url,
          contentMarkdown: '',
          contentHash: '',
          scrapedAt: new Date(data.scraped_at),
          httpStatus: data.http_status,
        };
      }
      console.warn(`  [Scrape] Rejected ${discovered.url}: ${guard.reason}`);
      return {
        url: discovered.url,
        contentMarkdown: '',
        contentHash: '',
        scrapedAt: new Date(data.scraped_at),
        httpStatus: data.http_status,
      };
    }

    await this.writeScrapeCache(result);
    return result;
  }
}
