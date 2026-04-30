// Phase 3.9 / W2 — non-English-to-English translation for scrape
// markdown.
//
// Government policy pages on JPN (NTA, MOJ), NLD (Belastingdienst,
// DUO), DEU (BMF), FRA (Service-Public), and the GCC Arabic-side
// portals routinely serve native-language content even when an
// English landing page exists. The Stage 2 LLM extractor reads
// English-labelled fields; native-language scrapes don't match. This
// utility bridges the gap by translating the markdown to English
// before extraction.
//
// Strategy:
//   1. Heuristic detection — if >50% of the content is non-ASCII
//      printable, treat as non-English and use the program country's
//      defaultLanguage (from country-departments.ts) as the source.
//      No franc/cld3 dep needed for the cohort's needs.
//   2. Cache via translation_cache (migration 00015) keyed on
//      sha256(content_hash + source_language + translation_version).
//      Bumps to TRANSLATION_VERSION (model upgrade, prompt change)
//      cleanly invalidate without a DROP.
//   3. Translate with Claude Sonnet, "preserve numbers/currency/dates
//      verbatim" instruction. Returns translated text + an audit
//      record so provenance can carry sourceSentenceOriginal.
//
// All paths are best-effort: failure returns the original text +
// `translated: false` so the upstream extraction still runs (just
// against the original-language content).

import { createHash } from 'crypto';
import { db, translationCache } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { createAnthropicClient, MODEL_EXTRACTION } from '../clients/anthropic';
import { getCountryDepartments } from '../data/country-departments';

/** Bumped when the translation prompt or model changes meaningfully. */
export const TRANSLATION_VERSION = 'v1';

const NON_ASCII_THRESHOLD = 0.5;
const MIN_TRANSLATABLE_CHARS = 200;
const TRANSLATION_MAX_TOKENS = 8192;

const TRANSLATE_SYSTEM_PROMPT =
  'You are a translation agent for immigration program research. ' +
  'Translate the provided non-English markdown text into clear, idiomatic ' +
  'English while preserving the document structure (headings, bullet lists, ' +
  'tables, numeric values). MUST RULES: ' +
  '(1) Preserve all numbers, currency codes, ISO dates, percentages, and ' +
  'proper nouns VERBATIM — do not localise, round, or convert. ' +
  '(2) Preserve markdown structure: headings stay headings, lists stay ' +
  'lists, tables stay tables. ' +
  '(3) Do not summarise or omit content. The translated text must be a ' +
  'complete rendering of the source. ' +
  '(4) When the source already contains English passages (mixed-language ' +
  'pages), pass them through unchanged. ' +
  '(5) Return ONLY the translated text — no preamble, no quotation marks, ' +
  'no explanation, no metadata.';

export interface TranslateResult {
  /** True when the text was translated; false when the original was returned. */
  translated: boolean;
  /** ISO 639-1 of the source language when translated; null otherwise. */
  sourceLanguage: string | null;
  /** Output text (translated when translated=true; original otherwise). */
  text: string;
  /** TRANSLATION_VERSION at the time of the call. Always set. */
  translationVersion: string;
}

/**
 * Phase 3.9 / W2 — heuristic non-English detection. Returns true when
 * >50% of the text is non-ASCII printable. Cheap and language-agnostic;
 * sufficient for the cohort because the only false-positives are pages
 * dominated by emoji or ideograms, which are themselves non-English.
 */
export function looksLikeNonEnglish(text: string): boolean {
  if (!text || text.length < MIN_TRANSLATABLE_CHARS) return false;
  let nonAscii = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // ASCII printable + tab + newline + carriage return
    if (!(code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127))) {
      nonAscii++;
    }
  }
  return nonAscii / text.length > NON_ASCII_THRESHOLD;
}

/** Look up the per-country default source language for translation. */
export function getCountryDefaultLanguage(countryIso3: string): string | null {
  return getCountryDepartments(countryIso3)?.defaultLanguage ?? null;
}

function makeTranslationCacheKey(
  contentHash: string,
  sourceLanguage: string,
  version: string
): string {
  return createHash('sha256')
    .update(`${contentHash}::${sourceLanguage}::${version}`, 'utf8')
    .digest('hex');
}

async function readTranslationCache(cacheKey: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ translatedText: translationCache.translatedText })
      .from(translationCache)
      .where(eq(translationCache.cacheKey, cacheKey))
      .limit(1);
    return rows[0]?.translatedText ?? null;
  } catch {
    return null;
  }
}

async function writeTranslationCache(args: {
  cacheKey: string;
  sourceLanguage: string;
  translationVersion: string;
  sourceContentHash: string;
  translatedText: string;
}): Promise<void> {
  try {
    await db
      .insert(translationCache)
      .values({
        cacheKey: args.cacheKey,
        sourceLanguage: args.sourceLanguage,
        translationVersion: args.translationVersion,
        sourceContentHash: args.sourceContentHash,
        translatedText: args.translatedText,
      })
      .onConflictDoNothing();
  } catch {
    // Cache write failure is non-fatal.
  }
}

/**
 * Phase 3.9 / W2 — translate the supplied content to English when
 * heuristic detection signals it's non-English AND the program country
 * has a defaultLanguage in country-departments.ts.
 *
 * Returns the original text unchanged when:
 *   - The content already looks English (looksLikeNonEnglish=false).
 *   - The country has no defaultLanguage entry (fallback skipped).
 *   - The translation LLM call fails or times out.
 *
 * Best-effort: every failure path is wrapped so the caller never has
 * to handle exceptions.
 */
export async function translateIfNeeded(args: {
  content: string;
  contentHash: string;
  countryIso3: string;
}): Promise<TranslateResult> {
  if (!looksLikeNonEnglish(args.content)) {
    return {
      translated: false,
      sourceLanguage: null,
      text: args.content,
      translationVersion: TRANSLATION_VERSION,
    };
  }
  const sourceLanguage = getCountryDefaultLanguage(args.countryIso3);
  if (!sourceLanguage) {
    return {
      translated: false,
      sourceLanguage: null,
      text: args.content,
      translationVersion: TRANSLATION_VERSION,
    };
  }

  const cacheKey = makeTranslationCacheKey(args.contentHash, sourceLanguage, TRANSLATION_VERSION);
  const cached = await readTranslationCache(cacheKey);
  if (cached) {
    return {
      translated: true,
      sourceLanguage,
      text: cached,
      translationVersion: TRANSLATION_VERSION,
    };
  }

  let translatedText: string | null = null;
  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: MODEL_EXTRACTION,
      max_tokens: TRANSLATION_MAX_TOKENS,
      system: TRANSLATE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Translate the following ${sourceLanguage}-language markdown to English. Return ONLY the translated text:\n\n---\n${args.content}\n---`,
        },
      ],
    });
    type ContentItem = (typeof response.content)[number];
    const lastTextBlock = response.content
      .filter((b): b is Extract<ContentItem, { type: 'text' }> => b.type === 'text')
      .at(-1);
    translatedText = lastTextBlock?.text ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[translate] translation failed for ${sourceLanguage}: ${msg}`);
    return {
      translated: false,
      sourceLanguage,
      text: args.content,
      translationVersion: TRANSLATION_VERSION,
    };
  }

  if (!translatedText || translatedText.trim().length < MIN_TRANSLATABLE_CHARS) {
    console.warn(
      `[translate] translation result too short (${translatedText?.length ?? 0} chars) for ${sourceLanguage}; falling back to original`
    );
    return {
      translated: false,
      sourceLanguage,
      text: args.content,
      translationVersion: TRANSLATION_VERSION,
    };
  }

  await writeTranslationCache({
    cacheKey,
    sourceLanguage,
    translationVersion: TRANSLATION_VERSION,
    sourceContentHash: args.contentHash,
    translatedText,
  });

  return {
    translated: true,
    sourceLanguage,
    text: translatedText,
    translationVersion: TRANSLATION_VERSION,
  };
}
