import { createHash } from 'crypto';
import { db, validationCache } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { createAnthropicClient, MODEL_VALIDATION } from '../clients/anthropic';
import type { ExtractionOutput, ScrapeResult } from '../types/extraction';
import type { ValidationResult } from '../types/extraction';
import type { ValidateStage } from '../types/pipeline';

const SYSTEM_PROMPT =
  'You are an independent verification agent for immigration data extraction. Your sole job ' +
  'is to check whether a claimed extraction is supported by evidence in a source document. ' +
  'You do not re-extract data. You only verify. Be strict: if the source sentence does not ' +
  'clearly and directly support the extracted value, mark isValid as false.';

const CONTEXT_WINDOW = 200;

function buildUserMessage(
  extraction: ExtractionOutput,
  offsetContext: string,
  actualPos: number
): string {
  return (
    `Verify the following extraction:\n\n` +
    `Extracted value: ${extraction.valueRaw}\n` +
    `Source sentence: ${extraction.sourceSentence}\n` +
    `Source sentence confirmed present in content at char ${actualPos}.\n\n` +
    `Context around source sentence (±${CONTEXT_WINDOW} chars):\n---\n${offsetContext}\n---\n\n` +
    `Does the source sentence clearly and directly support the extracted value?\n\n` +
    `Return your answer as a valid JSON object with exactly this structure — no markdown, no explanation:\n` +
    `{\n` +
    `  "isValid": boolean,\n` +
    `  "validationConfidence": number,\n` +
    `  "notes": string | null\n` +
    `}\n\n` +
    `Rules:\n` +
    `- isValid: true only if the source sentence clearly and directly supports the value.\n` +
    `- validationConfidence: 0.0 to 1.0.\n` +
    `- notes: A single sentence explaining your reasoning, or null if isValid is true and confidence is 1.0.`
  );
}

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

interface RawLlmResponse {
  isValid: boolean;
  validationConfidence: number;
  notes: string | null;
}

function assertLlmResponse(parsed: unknown, fieldKey: string): RawLlmResponse {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Validation response is not an object for field ${fieldKey}`);
  }
  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['isValid'] !== 'boolean') errors.push('isValid must be a boolean');

  const conf = obj['validationConfidence'];
  if (typeof conf !== 'number' || !isFinite(conf) || conf < 0 || conf > 1)
    errors.push('validationConfidence must be a finite number between 0 and 1');

  if (obj['notes'] !== null && typeof obj['notes'] !== 'string')
    errors.push('notes must be a string or null');

  if (errors.length > 0) {
    throw new Error(`Validation response invalid for field ${fieldKey}: ${errors.join('; ')}`);
  }

  return {
    isValid: obj['isValid'] as boolean,
    validationConfidence: conf as number,
    notes: obj['notes'] as string | null,
  };
}

function makeCacheKey(extraction: ExtractionOutput): string {
  const promptHash = createHash('sha256').update(SYSTEM_PROMPT, 'utf8').digest('hex');
  const sentenceHash = createHash('sha256').update(extraction.sourceSentence, 'utf8').digest('hex');
  const raw = [extraction.valueRaw, sentenceHash, extraction.fieldDefinitionKey, promptHash].join(
    '::'
  );
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

async function readCache(cacheKey: string): Promise<ValidationResult | null> {
  try {
    const rows = await db
      .select()
      .from(validationCache)
      .where(eq(validationCache.cacheKey, cacheKey))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0]!.resultJsonb as ValidationResult;
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string, result: ValidationResult): Promise<void> {
  try {
    await db
      .insert(validationCache)
      .values({ cacheKey, model: result.validationModel, resultJsonb: result })
      .onConflictDoNothing();
  } catch {
    // cache write failure is non-fatal
  }
}

export class ValidateStageImpl implements ValidateStage {
  async execute(extraction: ExtractionOutput, scrape: ScrapeResult): Promise<ValidationResult> {
    if (extraction.valueRaw === '') {
      return {
        isValid: false,
        validationConfidence: 1.0,
        validationModel: MODEL_VALIDATION,
        notes: 'No value was extracted; validation skipped.',
      };
    }

    // Verify presence deterministically before spending an LLM call
    const actualPos = scrape.contentMarkdown.indexOf(extraction.sourceSentence);
    if (actualPos === -1) {
      console.log(
        `  [${extraction.fieldDefinitionKey}] Source sentence NOT FOUND in content — isValid: false (no LLM call)`
      );
      return {
        isValid: false,
        validationConfidence: 1.0,
        validationModel: MODEL_VALIDATION,
        notes: 'Source sentence not found verbatim in scraped content.',
      };
    }
    console.log(
      `  [${extraction.fieldDefinitionKey}] Source sentence found at position ${actualPos}`
    );

    const cacheKey = makeCacheKey(extraction);
    const cached = await readCache(cacheKey);
    if (cached) {
      console.log(`  [${extraction.fieldDefinitionKey}] Validation cache hit`);
      return cached;
    }

    const contextStart = Math.max(0, actualPos - CONTEXT_WINDOW);
    const contextEnd = Math.min(
      scrape.contentMarkdown.length,
      actualPos + extraction.sourceSentence.length + CONTEXT_WINDOW
    );
    const offsetContext = scrape.contentMarkdown.slice(contextStart, contextEnd);

    const client = createAnthropicClient();

    const response = await client.messages
      .create({
        model: MODEL_VALIDATION,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserMessage(extraction, offsetContext, actualPos),
          },
        ],
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Validation API call failed for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}: ${msg}`
        );
      });

    type ContentItem = (typeof response.content)[number];
    const lastTextBlock = response.content
      .filter((block): block is Extract<ContentItem, { type: 'text' }> => block.type === 'text')
      .at(-1);

    if (!lastTextBlock) {
      console.warn(
        `Validation returned no text content for field ${extraction.fieldDefinitionKey} / program ${extraction.programId} — skipping validation`
      );
      return {
        isValid: false,
        validationConfidence: 0,
        validationModel: MODEL_VALIDATION,
        notes: 'Validation returned no text content from LLM.',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(lastTextBlock.text));
    } catch {
      throw new Error(
        `Validation response was not valid JSON for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}: ${lastTextBlock.text}`
      );
    }

    const validated = assertLlmResponse(parsed, extraction.fieldDefinitionKey);

    const result: ValidationResult = {
      isValid: validated.isValid,
      validationConfidence: validated.validationConfidence,
      validationModel: MODEL_VALIDATION,
      notes: validated.notes,
    };

    await writeCache(cacheKey, result);
    return result;
  }
}
