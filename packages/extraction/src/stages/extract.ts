import { createAnthropicClient, MODEL_EXTRACTION } from '../clients/anthropic';
import type { ExtractionOutput, ScrapeResult } from '../types/extraction';
import type { ExtractStage } from '../types/pipeline';

const SYSTEM_PROMPT =
  'You are a precise data extraction agent for immigration program research. Extract ' +
  'specific field values from official immigration program documentation. Return only ' +
  'valid JSON — no markdown, no explanation. Do not infer, extrapolate, or use general ' +
  'knowledge. Only extract values explicitly stated in the provided content.\n\n' +
  'Government pages commonly present eligibility data in these formats — treat all of ' +
  'them as explicit statements:\n' +
  '- Bullet point eligibility lists ("You must...", "You need to...", "Applicants must...")\n' +
  '- Condition blocks ("To be eligible you must meet all of the following:")\n' +
  '- Numbered requirement lists\n' +
  '- Table rows with criteria or threshold values\n\n' +
  'If the field value is presented as part of a condition or list rather than a standalone ' +
  'labelled value, extract the relevant condition text verbatim as the valueRaw. ' +
  'Do not summarise or paraphrase — copy the text exactly as it appears on the page. ' +
  'Only return an empty valueRaw if the information is genuinely absent from the content.';

function buildUserMessage(
  fieldKey: string,
  extractionPromptMd: string,
  contentMarkdown: string
): string {
  return (
    `Field to extract: ${fieldKey}\n\n` +
    `Instructions:\n${extractionPromptMd}\n\n` +
    `No-inference directive: If the value is not explicitly stated in the content below, ` +
    `return valueRaw as an empty string and extractionConfidence as 0.\n\n` +
    `Content to extract from:\n---\n${contentMarkdown}\n---\n\n` +
    `Return your answer as a valid JSON object with exactly this structure:\n` +
    `{\n` +
    `  "valueRaw": string,\n` +
    `  "sourceSentence": string,\n` +
    `  "characterOffsets": { "start": number, "end": number },\n` +
    `  "extractionConfidence": number\n` +
    `}\n\n` +
    `Rules:\n` +
    `- valueRaw: The extracted value exactly as stated in the content, or "" if not found.\n` +
    `- sourceSentence: The exact sentence from the content containing the value, or "" if not found.\n` +
    `- characterOffsets: start and end character index of sourceSentence within the content. Set both to 0 if not found.\n` +
    `- extractionConfidence: A number from 0.0 to 1.0. Use 0.0 if the value was not found.`
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
  valueRaw: string;
  sourceSentence: string;
  characterOffsets: { start: number; end: number };
  extractionConfidence: number;
}

function assertLlmResponse(parsed: unknown, fieldKey: string): RawLlmResponse {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Extraction response is not an object for field ${fieldKey}`);
  }
  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['valueRaw'] !== 'string') errors.push('valueRaw must be a string');
  if (typeof obj['sourceSentence'] !== 'string') errors.push('sourceSentence must be a string');

  const offsets = obj['characterOffsets'];
  if (typeof offsets !== 'object' || offsets === null) {
    errors.push('characterOffsets must be an object');
  } else {
    const o = offsets as Record<string, unknown>;
    if (typeof o['start'] !== 'number' || !isFinite(o['start']) || o['start'] < 0)
      errors.push('characterOffsets.start must be a finite number >= 0');
    if (typeof o['end'] !== 'number' || !isFinite(o['end']) || o['end'] < 0)
      errors.push('characterOffsets.end must be a finite number >= 0');
  }

  const conf = obj['extractionConfidence'];
  if (typeof conf !== 'number' || !isFinite(conf) || conf < 0 || conf > 1)
    errors.push('extractionConfidence must be a number between 0 and 1');

  if (errors.length > 0) {
    throw new Error(`Extraction response invalid for field ${fieldKey}: ${errors.join('; ')}`);
  }

  const o = offsets as Record<string, unknown>;
  return {
    valueRaw: obj['valueRaw'] as string,
    sourceSentence: obj['sourceSentence'] as string,
    characterOffsets: { start: o['start'] as number, end: o['end'] as number },
    extractionConfidence: conf as number,
  };
}

export class ExtractStageImpl implements ExtractStage {
  private readonly fieldPrompts: ReadonlyMap<string, string>;

  constructor(fieldPrompts: ReadonlyMap<string, string>) {
    this.fieldPrompts = fieldPrompts;
  }

  async execute(
    scrape: ScrapeResult,
    fieldKey: string,
    programId: string
  ): Promise<ExtractionOutput> {
    const extractionPromptMd = this.fieldPrompts.get(fieldKey);
    if (extractionPromptMd === undefined) {
      throw new Error(`No extraction prompt found for field ${fieldKey}`);
    }

    const client = createAnthropicClient();

    const MAX_CONTENT_CHARS = 30000;
    if (scrape.contentMarkdown.length > MAX_CONTENT_CHARS) {
      console.log(
        `  ↳ [${fieldKey}] Content truncated from ${scrape.contentMarkdown.length} to ${MAX_CONTENT_CHARS} chars`
      );
    }
    const truncatedContent = scrape.contentMarkdown.slice(0, MAX_CONTENT_CHARS);

    const response = await client.messages
      .create({
        model: MODEL_EXTRACTION,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserMessage(fieldKey, extractionPromptMd, truncatedContent),
          },
        ],
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Extraction API call failed for field ${fieldKey} / program ${programId}: ${msg}`
        );
      });

    type ContentItem = (typeof response.content)[number];
    const lastTextBlock = response.content
      .filter((block): block is Extract<ContentItem, { type: 'text' }> => block.type === 'text')
      .at(-1);

    if (!lastTextBlock) {
      throw new Error(
        `Extraction returned no text content for field ${fieldKey} / program ${programId}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(lastTextBlock.text));
    } catch {
      throw new Error(
        `Extraction response was not valid JSON for field ${fieldKey} / program ${programId}: ${lastTextBlock.text}`
      );
    }

    const validated = assertLlmResponse(parsed, fieldKey);

    return {
      programId,
      fieldDefinitionKey: fieldKey,
      valueRaw: validated.valueRaw,
      sourceSentence: validated.sourceSentence,
      characterOffsets: validated.characterOffsets,
      extractionConfidence: validated.extractionConfidence,
      extractionModel: MODEL_EXTRACTION,
      extractedAt: new Date(),
    };
  }

  async executeMulti(
    scrapes: ScrapeResult[],
    fieldKey: string,
    programId: string
  ): Promise<{ output: ExtractionOutput; sourceUrl: string }> {
    if (scrapes.length === 0) {
      throw new Error(`No scrape results provided for field ${fieldKey} / program ${programId}`);
    }

    const candidates: { output: ExtractionOutput; sourceUrl: string }[] = [];
    for (let i = 0; i < scrapes.length; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
      candidates.push({
        output: await this.execute(scrapes[i]!, fieldKey, programId),
        sourceUrl: scrapes[i]!.url,
      });
    }

    return candidates.reduce((best, current) =>
      current.output.extractionConfidence > best.output.extractionConfidence ? current : best
    );
  }
}
