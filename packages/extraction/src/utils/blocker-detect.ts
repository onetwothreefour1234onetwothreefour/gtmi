// Phase 3.9 / W15 — country-agnostic anti-bot blocker detection.
//
// Three OR'd signals over the per-run scrape history of a single
// domain. Any one fires → mark the domain as blocked, write to the
// blocker_domains table, and route subsequent same-domain URLs to the
// Wayback layer (W16).
//
// Signal 1 (hash_equality):
//   ≥2 distinct paths from one domain returning identical content_hash.
//   Catches ISA-class blockers where every path serves the same
//   anti-bot interstitial.
//
// Signal 2 (thin_fanout):
//   ≥2 distinct paths from one domain ALL returning thin content
//   (<MIN_VISIBLE_TEXT_LENGTH chars) when the response was 200 OK.
//   Catches IND-class SPA-shell blockers where each path renders a
//   different but uniformly empty body.
//
// Signal 3 (challenge_fanout):
//   ≥2 distinct paths from one domain ALL hitting the existing
//   is_challenge_body / SCRAPE_THIN_CONTENT marker. Catches
//   Cloudflare-style cohort blockers.
//
// All three signals share the SAME mechanism — they're just different
// observable manifestations of "this domain is hostile to headless
// scraping." Country-agnostic by construction: the domain name and
// path-count are the only inputs; no per-country data.

import { db, blockerDomains } from '@gtmi/db';
import { sql } from 'drizzle-orm';
import type { ScrapeResult } from '../types/extraction';
import { MIN_VISIBLE_TEXT_LENGTH } from '../scrape-guards';

export type BlockerSignal = 'hash_equality' | 'thin_fanout' | 'challenge_fanout';

interface PerDomainState {
  /** Distinct paths seen this run. */
  paths: Set<string>;
  /** content_hash counts; used for the hash_equality signal. */
  hashes: Map<string, number>;
  /** Count of paths that returned thin content. */
  thinCount: number;
  /** Count of paths that returned an is_challenge_body=true response. */
  challengeCount: number;
  /** Whether we've already flagged + persisted this domain. */
  flagged: boolean;
}

/**
 * Per-canary, per-domain observation tracker. Reset across canary
 * runs (each canary builds its own RunBlockerState). NOT a global
 * singleton — that would leak state across runs of different programs.
 */
export class RunBlockerState {
  private byDomain = new Map<string, PerDomainState>();

  /**
   * Cached set of already-known blocker domains for this run.
   * Loaded once on first lookup; survives the run.
   */
  private knownBlockers: Set<string> | null = null;

  static domainOf(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  /** True when the domain is in the persisted blocker_domains registry. */
  async isKnownBlocker(url: string): Promise<boolean> {
    if (this.knownBlockers === null) {
      try {
        const rows = await db.select({ domain: blockerDomains.domain }).from(blockerDomains);
        this.knownBlockers = new Set(rows.map((r) => r.domain.toLowerCase()));
      } catch {
        this.knownBlockers = new Set();
      }
    }
    const d = RunBlockerState.domainOf(url);
    return d !== '' && this.knownBlockers.has(d);
  }

  /**
   * Record an observation for the given URL + scrape result. Returns
   * the signal name when this observation crossed the detection
   * threshold (2nd path matching the same pattern); null otherwise.
   *
   * Caller is expected to write to blocker_domains AND switch the
   * remaining same-domain URLs to Wayback when this returns non-null.
   */
  observe(args: {
    url: string;
    result: ScrapeResult;
    /** True when the scrape's content_markdown is non-empty AND below MIN_VISIBLE_TEXT_LENGTH. */
    wasThin: boolean;
    /** True when the scraper's challenge marker fired (currently driven by SCRAPE_THIN_CONTENT log path). */
    wasChallenge: boolean;
  }): BlockerSignal | null {
    const domain = RunBlockerState.domainOf(args.url);
    if (domain === '') return null;
    let state = this.byDomain.get(domain);
    if (!state) {
      state = {
        paths: new Set(),
        hashes: new Map(),
        thinCount: 0,
        challengeCount: 0,
        flagged: false,
      };
      this.byDomain.set(domain, state);
    }

    if (state.flagged) return null; // already detected this run

    state.paths.add(args.url);

    if (args.result.contentHash && args.result.contentHash !== '') {
      const prev = state.hashes.get(args.result.contentHash) ?? 0;
      state.hashes.set(args.result.contentHash, prev + 1);
    }
    if (args.wasThin) state.thinCount++;
    if (args.wasChallenge) state.challengeCount++;

    if (state.paths.size < 2) return null;

    // Signal 1: same content_hash returned for ≥2 distinct paths.
    for (const count of state.hashes.values()) {
      if (count >= 2) {
        state.flagged = true;
        return 'hash_equality';
      }
    }
    // Signal 2: ≥2 paths returned thin content.
    if (state.thinCount >= 2) {
      state.flagged = true;
      return 'thin_fanout';
    }
    // Signal 3: ≥2 paths hit the challenge marker.
    if (state.challengeCount >= 2) {
      state.flagged = true;
      return 'challenge_fanout';
    }
    return null;
  }
}

export const BLOCKER_THIN_THRESHOLD = MIN_VISIBLE_TEXT_LENGTH;

/**
 * Best-effort write to the blocker_domains registry. Idempotent:
 * uses ON CONFLICT to bump last_seen_at + accept the latest signal
 * type. Failures are non-fatal (the per-run cache still lets us
 * route the rest of this canary).
 */
export async function recordBlockerDomain(args: {
  domain: string;
  signal: BlockerSignal;
  programId?: string;
  notes?: Record<string, unknown>;
}): Promise<void> {
  if (!args.domain) return;
  try {
    await db
      .insert(blockerDomains)
      .values({
        domain: args.domain.toLowerCase(),
        detectionSignal: args.signal,
        detectedForProgramId: args.programId ?? null,
        notes: args.notes ?? null,
      })
      .onConflictDoUpdate({
        target: blockerDomains.domain,
        set: {
          lastSeenAt: sql`now()`,
          detectionSignal: args.signal,
        },
      });
    console.log(
      `[blocker-detect] domain=${args.domain} signal=${args.signal} — persisted to blocker_domains`
    );
    // Phase 3.10 — structured single-line JSON marker for Cloud
    // Logging metric extraction. Cloud Logging parses single-line
    // JSON into jsonPayload; a log-based metric filters on
    // jsonPayload.event="blocker_detected" to count daily
    // registrations and alert when the count exceeds threshold
    // (suggesting a cohort-wide regression rather than a per-domain
    // failure).
    console.log(
      JSON.stringify({
        event: 'blocker_detected',
        domain: args.domain.toLowerCase(),
        signal: args.signal,
        programId: args.programId ?? null,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[blocker-detect] persist failed for ${args.domain}: ${msg}`);
  }
}

/**
 * Test seam: clear the per-domain state. Used by unit tests to
 * isolate observations between cases.
 */
export function clearBlockerStateForTest(state: RunBlockerState): void {
  // @ts-expect-error — intentional access to private for testing
  state.byDomain.clear();
  // @ts-expect-error — intentional access to private for testing
  state.knownBlockers = null;
}
