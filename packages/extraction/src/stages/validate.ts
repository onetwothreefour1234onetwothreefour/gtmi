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

function buildUserMessage(extraction: ExtractionOutput, contentMarkdown: string): string {
  const { start, end } = extraction.characterOffsets;
  const contextStart = Math.max(0, start - CONTEXT_WINDOW);
  const contextEnd = Math.min(contentMarkdown.length, end + CONTEXT_WINDOW);
  const offsetContext = contentMarkdown.slice(contextStart, contextEnd);

  return (
    `Verify the following extraction:\n\n` +
    `Extracted value: ${extraction.valueRaw}\n` +
    `Source sentence: ${extraction.sourceSentence}\n` +
    `Claimed character offsets in content: start=${start}, end=${end}\n\n` +
    `Content around the claimed offsets (±${CONTEXT_WINDOW} chars):\n---\n${offsetContext}\n---\n\n` +
    `Full content for complete verification:\n---\n${contentMarkdown}\n---\n\n` +
    `Answer both questions:\n` +
    `(1) Does the source sentence appear in the full content at or near the stated offsets?\n` +
    `(2) Does the source sentence clearly and directly support the extracted value?\n\n` +
    `Return your answer as a valid JSON object with exactly this structure — no markdown, no explanation:\n` +
    `{\n` +
    `  "isValid": boolean,\n` +
    `  "validationConfidence": number,\n` +
    `  "notes": string | null\n` +
    `}\n\n` +
    `Rules:\n` +
    `- isValid: true only if both (1) and (2) are satisfied.\n` +
    `- validationConfidence: 0.0 to 1.0, your confidence in the isValid determination.\n` +
    `- notes: A single sentence explaining your reasoning, or null if isValid is true and confidence is 1.0.`
  );
}

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced?.[1]?.trim() ?? text.trim();
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

    const client = createAnthropicClient();

    const response = await client.messages
      .create({
        model: MODEL_VALIDATION,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserMessage(extraction, scrape.contentMarkdown),
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
      throw new Error(
        `Validation returned no text content for field ${extraction.fieldDefinitionKey} / program ${extraction.programId}`
      );
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

    return {
      isValid: validated.isValid,
      validationConfidence: validated.validationConfidence,
      validationModel: MODEL_VALIDATION,
      notes: validated.notes,
    };
  }
}
