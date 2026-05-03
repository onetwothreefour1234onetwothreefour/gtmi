import { createHash } from 'crypto';
import { db, crosscheckCache } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { createAnthropicClient, MODEL_CROSSCHECK } from '../clients/anthropic';
import { recordLlmCall } from '../utils/llm-cost';
import type { CrossCheckResult, ExtractionOutput, ScrapeResult } from '../types/extraction';
import type { CrossCheckStage } from '../types/pipeline';

const SYSTEM_PROMPT =
  'You are an independent cross-check agent for immigration data extraction. Your job is to ' +
  'compare a value extracted from an official government source against a Tier 2 source ' +
  '(law firm commentary, advisory publication, or similar). You do not re-extract data. ' +
  'You only compare. Determine whether the Tier 2 source agrees with, disagrees with, or ' +
  'contains no relevant information about the claimed value.';

function buildUserMessage(extraction: ExtractionOutput, tier2ContentMarkdown: string): string {
  return (
    `Cross-check the following extraction against the Tier 2 source:\n\n` +
    `Extracted value (from Tier 1 government source): ${extraction.valueRaw}\n` +
    `Supporting sentence from Tier 1: ${extraction.sourceSentence}\n` +
    `Field: ${extraction.fieldDefinitionKey}\n\n` +
    `Tier 2 source content:\n---\n${tier2ContentMarkdown}\n---\n\n` +
    `Determine whether the Tier 2 source:\n` +
    `(a) Agrees with the extracted value\n` +
    `(b) Disagrees with the extracted value\n` +
    `(c) Contains no relevant information about this value\n\n` +
    `Return your answer as a valid JSON object with exactly this structure — no markdown, no explanation:\n` +
    `{\n` +
    `  "agrees": boolean,\n` +
    `  "notes": string | null\n` +
    `}\n\n` +
    `Rules:\n` +
    `- agrees: true only if the Tier 2 source explicitly corroborates the extracted value.\n` +
    `- agrees: false for both disagreement and no relevant information.\n` +
    `- notes: One sentence explaining your determination, or null if agrees is true and unambiguous.`
  );
}

function stripJsonFences(text: string): string {
  // Try markdown code fences first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  // If no fences, extract the JSON object from anywhere in the response
  // (models sometimes prepend explanatory text before the JSON)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();

  // Fallback: return as-is and let JSON.parse throw a clear error
  return text.trim();
}

interface RawLlmResponse {
  agrees: boolean;
  notes: string | null;
}

function assertLlmResponse(parsed: unknown, fieldKey: string): RawLlmResponse {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Cross-check response is not an object for field ${fieldKey}`);
  }
  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['agrees'] !== 'boolean') errors.push('agrees must be a boolean');
  if (obj['notes'] !== null && typeof obj['notes'] !== 'string')
    errors.push('notes must be a string or null');

  if (errors.length > 0) {
    throw new Error(`Cross-check response invalid for field ${fieldKey}: ${errors.join('; ')}`);
  }

  return {
    agrees: obj['agrees'] as boolean,
    notes: obj['notes'] as string | null,
  };
}

function makeCrossCheckCacheKey(extraction: ExtractionOutput, tier2ContentHash: string): string {
  const raw = [extraction.valueRaw, tier2ContentHash, extraction.fieldDefinitionKey].join('::');
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

async function readCrossCheckCache(cacheKey: string): Promise<CrossCheckResult | null> {
  try {
    const rows = await db
      .select()
      .from(crosscheckCache)
      .where(eq(crosscheckCache.cacheKey, cacheKey))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0]!.resultJsonb as CrossCheckResult;
  } catch {
    return null;
  }
}

async function writeCrossCheckCache(cacheKey: string, result: CrossCheckResult): Promise<void> {
  try {
    await db
      .insert(crosscheckCache)
      .values({ cacheKey, model: MODEL_CROSSCHECK, resultJsonb: result })
      .onConflictDoNothing();
  } catch {
    // cache write failure is non-fatal
  }
}

export class CrossCheckStageImpl implements CrossCheckStage {
  async execute(
    extraction: ExtractionOutput,
    tier2Scrape: ScrapeResult
  ): Promise<CrossCheckResult> {
    if (extraction.valueRaw === '') {
      return {
        agrees: false,
        tier2Url: tier2Scrape.url,
        notes: 'No Tier 1 value to cross-check.',
      };
    }

    const cacheKey = makeCrossCheckCacheKey(extraction, tier2Scrape.contentHash);
    const cached = await readCrossCheckCache(cacheKey);
    if (cached) {
      console.log(`  [${extraction.fieldDefinitionKey}] Cross-check cache hit`);
      return { ...cached, tier2Url: tier2Scrape.url };
    }

    const client = createAnthropicClient();

    const response = await client.messages
      .create({
        model: MODEL_CROSSCHECK,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserMessage(extraction, tier2Scrape.contentMarkdown),
          },
        ],
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Cross-check API call failed for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}: ${msg}`
        );
      });
    recordLlmCall({
      stage: 'cross-check',
      model: response.model,
      usage: response.usage,
      programId: extraction.programId,
      fieldKey: extraction.fieldDefinitionKey,
    });

    type ContentItem = (typeof response.content)[number];
    const lastTextBlock = response.content
      .filter((block): block is Extract<ContentItem, { type: 'text' }> => block.type === 'text')
      .at(-1);

    if (!lastTextBlock) {
      throw new Error(
        `Cross-check returned no text content for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(lastTextBlock.text));
    } catch {
      throw new Error(
        `Cross-check response was not valid JSON for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}: ${lastTextBlock.text}`
      );
    }

    const validated = assertLlmResponse(parsed, extraction.fieldDefinitionKey);

    if (!validated.agrees) {
      console.warn(
        `Cross-check disagreement — program: ${extraction.programId}, field: ${extraction.fieldDefinitionKey}, notes: ${validated.notes}`
      );
    }

    const result: CrossCheckResult = {
      agrees: validated.agrees,
      tier2Url: tier2Scrape.url,
      notes: validated.notes,
    };
    await writeCrossCheckCache(cacheKey, result);
    return result;
  }
}
