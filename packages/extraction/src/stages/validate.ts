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
  const actualPos = contentMarkdown.indexOf(extraction.sourceSentence);
  const contextStart = actualPos !== -1 ? Math.max(0, actualPos - CONTEXT_WINDOW) : 0;
  const contextEnd =
    actualPos !== -1
      ? Math.min(
          contentMarkdown.length,
          actualPos + extraction.sourceSentence.length + CONTEXT_WINDOW
        )
      : Math.min(contentMarkdown.length, 400);
  const offsetContext = contentMarkdown.slice(contextStart, contextEnd);
  console.log(
    `  [${extraction.fieldDefinitionKey}] Source sentence ${actualPos !== -1 ? `found at position ${actualPos}` : 'NOT FOUND in content — using fallback context'}`
  );

  return (
    `Verify the following extraction:\n\n` +
    `Extracted value: ${extraction.valueRaw}\n` +
    `Source sentence: ${extraction.sourceSentence}\n` +
    `Source sentence position in content: ${actualPos !== -1 ? `found at char ${actualPos}` : 'not found by exact match'}\n\n` +
    `Content around source sentence (±${CONTEXT_WINDOW} chars):\n---\n${offsetContext}\n---\n\n` +
    `Full content for complete verification:\n---\n${contentMarkdown.slice(0, 30000)}\n---\n\n` +
    `Answer both questions:\n` +
    `(1) Does the source sentence appear verbatim in the full content?\n` +
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

    const actualPos = scrape.contentMarkdown.indexOf(extraction.sourceSentence);
    if (actualPos !== -1 && actualPos !== extraction.characterOffsets.start) {
      console.warn(
        `[${extraction.fieldDefinitionKey}] Offset mismatch: ` +
          `claimed start=${extraction.characterOffsets.start}, ` +
          `end=${extraction.characterOffsets.end}, ` +
          `actual position=${actualPos}`
      );
    }

    return {
      isValid: validated.isValid,
      validationConfidence: validated.validationConfidence,
      validationModel: MODEL_VALIDATION,
      notes: validated.notes,
    };
  }
}
