import { createHash } from 'crypto';
import { db, extractionCache } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import { createAnthropicClient, MODEL_EXTRACTION } from '../clients/anthropic';
import type { ExtractionOutput, FieldSpec, ScrapeResult } from '../types/extraction';
import type { ExtractStage } from '../types/pipeline';
import { selectContentWindow } from '../utils/window';

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
  'When extracting valueRaw, apply the following rules based on the type of value:\n\n' +
  'For numeric fields (salary thresholds, fees, years, counts, ages, processing times): ' +
  'return only the base numeric value with its currency symbol or unit if present — nothing else. ' +
  'Do not include explanatory text, conditions, or ranges. ' +
  "For example: '$3,300' not 'minimum of $3,300 per month for applicants under 45'. " +
  'If a range exists, return the minimum value only.\n\n' +
  'For categorical fields (yes/no, required/not required, open list/restricted list, automatic/by permit): ' +
  'return a concise standardised label — one to five words maximum. ' +
  "For example: 'required', 'not required', 'open list', 'restricted list', 'automatic', 'by permit'.\n\n" +
  'For text fields (eligibility conditions, requirements, inclusion options): ' +
  'return a single clean sentence of no more than 20 words that captures the core requirement. ' +
  'Do not copy verbatim fragments. Summarise the key condition in plain English. ' +
  "For example: 'Minimum 1 year relevant work experience in nominated occupation' not " +
  "'at least 1 year relevant work experience in your nominated occupation or a related field as assessed by the department'.\n\n" +
  'For count fields (number of steps, number of changes): return only the integer count. ' +
  "For example: '4' not 'Step 1 Before you apply, Step 2 Apply online, Step 3 Wait for decision, Step 4 Receive outcome'.\n\n" +
  'The sourceSentence field must still contain the exact verbatim text from the source that supports the extracted value — ' +
  'this is for provenance only and is separate from valueRaw.\n\n' +
  'Only return an empty valueRaw if the information is genuinely absent from the content.';

const MAX_CONTENT_CHARS = 30000;
const EARLY_EXIT_CONFIDENCE = 0.9;
const INTER_BATCH_DELAY_MS = 30000;

// Bump when the windowing or system prompt logic changes in a way that would
// invalidate previously-cached extractions for the same (content, field, prompt)
// tuple. Cache rows under an old WINDOW_VERSION are silently bypassed.
const WINDOW_VERSION = 1;

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function makeCacheKey(contentHash: string, fieldKey: string, promptMd: string): string {
  const promptHash = sha256(SYSTEM_PROMPT + '::' + promptMd);
  return sha256([contentHash, fieldKey, promptHash, `wv${WINDOW_VERSION}`].join('::'));
}

/**
 * Phase 3.3 helper: recompute the cache key the way `extract.ts` does, so a
 * one-off invalidation script can DELETE specific rows. Exported for tooling
 * only — runtime extraction does not call this.
 */
export function computeExtractionCacheKey(
  contentHash: string,
  fieldKey: string,
  promptMd: string
): string {
  return makeCacheKey(contentHash, fieldKey, promptMd);
}

async function readExtractionCache(cacheKey: string): Promise<ExtractionOutput | null> {
  try {
    const rows = await db
      .select()
      .from(extractionCache)
      .where(eq(extractionCache.cacheKey, cacheKey))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0]!.resultJsonb as ExtractionOutput;
  } catch {
    return null;
  }
}

async function writeExtractionCache(cacheKey: string, result: ExtractionOutput): Promise<void> {
  try {
    await db
      .insert(extractionCache)
      .values({ cacheKey, model: result.extractionModel, resultJsonb: result })
      .onConflictDoNothing();
  } catch {
    // cache write failure is non-fatal
  }
}

function resolvePrompt(promptMd: string, programName: string, countryIso: string): string {
  return promptMd
    .replace(/\{program_name\}/g, programName)
    .replace(/\{program_country\}/g, countryIso);
}

function buildSingleUserMessage(
  fieldKey: string,
  extractionPromptMd: string,
  programName: string,
  countryIso: string,
  contentMarkdown: string
): string {
  const resolvedPrompt = resolvePrompt(extractionPromptMd, programName, countryIso);
  return (
    `Field to extract: ${fieldKey}\n\n` +
    `Instructions:\n${resolvedPrompt}\n\n` +
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
    `- valueRaw: The clean extracted value formatted per the field-type rules in the system prompt, or "" if not found.\n` +
    `- sourceSentence: The exact sentence from the content containing the value, or "" if not found.\n` +
    `- characterOffsets: start and end character index of sourceSentence within the content. Set both to 0 if not found.\n` +
    `- extractionConfidence: A number from 0.0 to 1.0. Use 0.0 if the value was not found.`
  );
}

function buildBatchUserMessage(
  fields: ReadonlyArray<FieldSpec>,
  programName: string,
  countryIso: string,
  contentMarkdown: string
): string {
  const fieldList = fields
    .map((f) => `[${f.key}]\n${resolvePrompt(f.promptMd, programName, countryIso)}`)
    .join('\n---\n');

  return (
    `Extract values for the following ${fields.length} fields from the content provided. ` +
    `Return ALL fields — use empty string and 0.0 confidence for fields not found.\n\n` +
    `Fields to extract:\n${fieldList}\n\n` +
    `No-inference directive: If a value is not explicitly stated in the content, ` +
    `return valueRaw as an empty string and extractionConfidence as 0.\n\n` +
    `Content to extract from:\n---\n${contentMarkdown}\n---\n\n` +
    `Return your answer as a valid JSON array with exactly ${fields.length} objects — one per field, in the same order:\n` +
    `[\n` +
    `  {\n` +
    `    "fieldKey": string,\n` +
    `    "valueRaw": string,\n` +
    `    "sourceSentence": string,\n` +
    `    "characterOffsets": { "start": number, "end": number },\n` +
    `    "extractionConfidence": number\n` +
    `  }\n` +
    `]\n\n` +
    `Rules:\n` +
    `- Include ALL ${fields.length} fields in the response, in the order listed above.\n` +
    `- fieldKey: must exactly match the key shown in [brackets] above.\n` +
    `- valueRaw: formatted per the field-type rules in the system prompt, or "" if not found.\n` +
    `- sourceSentence: exact verbatim text from content supporting the value, or "" if not found.\n` +
    `- characterOffsets: start and end character index of sourceSentence. Set both to 0 if not found.\n` +
    `- extractionConfidence: 0.0 to 1.0. Use 0.0 if the value was not found.`
  );
}

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

interface RawLlmSingle {
  valueRaw: string;
  sourceSentence: string;
  characterOffsets: { start: number; end: number };
  extractionConfidence: number;
}

export function assertSingleResponse(parsed: unknown, fieldKey: string): RawLlmSingle {
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error(`Extraction response is not an object for field ${fieldKey}`);
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

  // Phase 3.8 / P2.5 — provenance binding. If the model returned a
  // non-empty valueRaw with a non-zero confidence, it MUST be backed by
  // a non-empty sourceSentence and a non-degenerate offset span.
  // Empty valueRaw + zero confidence is the legitimate "not found"
  // response and is left untouched.
  if (
    typeof obj['valueRaw'] === 'string' &&
    obj['valueRaw'].trim() !== '' &&
    typeof conf === 'number' &&
    conf > 0
  ) {
    if (typeof obj['sourceSentence'] !== 'string' || obj['sourceSentence'].trim() === '') {
      errors.push('non-empty valueRaw requires a non-empty sourceSentence (provenance binding)');
    }
    if (offsets && typeof offsets === 'object') {
      const o = offsets as Record<string, unknown>;
      if (
        typeof o['start'] === 'number' &&
        typeof o['end'] === 'number' &&
        o['start'] === 0 &&
        o['end'] === 0
      ) {
        errors.push('non-empty valueRaw requires non-zero characterOffsets (provenance binding)');
      }
      if (
        typeof o['start'] === 'number' &&
        typeof o['end'] === 'number' &&
        (o['end'] as number) < (o['start'] as number)
      ) {
        errors.push('characterOffsets.end must be >= characterOffsets.start');
      }
    }
  }

  if (errors.length > 0)
    throw new Error(`Extraction response invalid for field ${fieldKey}: ${errors.join('; ')}`);
  const o = offsets as Record<string, unknown>;
  return {
    valueRaw: obj['valueRaw'] as string,
    sourceSentence: obj['sourceSentence'] as string,
    characterOffsets: { start: o['start'] as number, end: o['end'] as number },
    extractionConfidence: conf as number,
  };
}

function assertBatchResponse(parsed: unknown, expectedKeys: string[]): Map<string, RawLlmSingle> {
  if (!Array.isArray(parsed)) throw new Error('Batch extraction response is not an array');
  const result = new Map<string, RawLlmSingle>();
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const fieldKey = obj['fieldKey'];
    if (typeof fieldKey !== 'string' || !expectedKeys.includes(fieldKey)) continue;
    try {
      result.set(fieldKey, assertSingleResponse(obj, fieldKey));
    } catch {
      // skip malformed individual items — other fields still usable
    }
  }
  return result;
}

function makeOutput(raw: RawLlmSingle, fieldKey: string, programId: string): ExtractionOutput {
  return {
    programId,
    fieldDefinitionKey: fieldKey,
    valueRaw: raw.valueRaw,
    sourceSentence: raw.sourceSentence,
    characterOffsets: raw.characterOffsets,
    extractionConfidence: raw.extractionConfidence,
    extractionModel: MODEL_EXTRACTION,
    extractedAt: new Date(),
  };
}

export class ExtractStageImpl implements ExtractStage {
  private readonly fieldPrompts: ReadonlyMap<string, string>;

  constructor(fieldPrompts: ReadonlyMap<string, string>) {
    this.fieldPrompts = fieldPrompts;
  }

  // ── Single-field extraction (kept for backwards compatibility) ──────────
  async execute(
    scrape: ScrapeResult,
    fieldKey: string,
    programId: string,
    programName: string,
    countryIso: string
  ): Promise<ExtractionOutput> {
    const extractionPromptMd = this.fieldPrompts.get(fieldKey);
    if (extractionPromptMd === undefined)
      throw new Error(`No extraction prompt found for field ${fieldKey}`);

    const cacheKey = makeCacheKey(scrape.contentHash, fieldKey, extractionPromptMd);
    const cached = await readExtractionCache(cacheKey);
    if (cached) {
      console.log(`  [${fieldKey}] Extraction cache hit`);
      return { ...cached, programId, extractedAt: new Date() };
    }

    const client = createAnthropicClient();
    // Single-field path has no field label available (legacy interface). Fall
    // back to head slice — `selectContentWindow` honours this when called with
    // an empty-label spec. Production extraction goes through the batch path
    // which passes real labels.
    const content = selectContentWindow(
      scrape.contentMarkdown,
      [{ key: fieldKey, label: '' }],
      MAX_CONTENT_CHARS
    );
    if (scrape.contentMarkdown.length > MAX_CONTENT_CHARS)
      console.log(
        `  ↳ [${fieldKey}] Content windowed: ${scrape.contentMarkdown.length} → ${content.length} chars`
      );

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 60000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.messages.create({
          model: MODEL_EXTRACTION,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: buildSingleUserMessage(
                fieldKey,
                extractionPromptMd,
                programName,
                countryIso,
                content
              ),
            },
          ],
        });

        type ContentItem = (typeof response.content)[number];
        const lastTextBlock = response.content
          .filter((b): b is Extract<ContentItem, { type: 'text' }> => b.type === 'text')
          .at(-1);
        if (!lastTextBlock)
          throw new Error(`Extraction returned no text content for field ${fieldKey}`);

        const parsed = JSON.parse(stripJsonFences(lastTextBlock.text));
        const validated = assertSingleResponse(parsed, fieldKey);
        const output = makeOutput(validated, fieldKey, programId);
        await writeExtractionCache(cacheKey, output);
        return output;
      } catch (err) {
        const isRateLimit =
          err instanceof Error &&
          (err.message.includes('429') ||
            err.message.includes('rate_limit') ||
            err.message.toLowerCase().includes('rate limit'));
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * attempt;
          console.warn(
            `  [${fieldKey}] Rate limit (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delay / 1000}s`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        break;
      }
    }

    throw (
      lastError ?? new Error(`Extraction failed after ${MAX_RETRIES} retries for field ${fieldKey}`)
    );
  }

  // ── Batch extraction: all fields from one scrape in a single LLM call ──
  async executeBatch(
    scrape: ScrapeResult,
    fields: ReadonlyArray<FieldSpec>,
    programId: string,
    programName: string,
    countryIso: string
  ): Promise<Map<string, ExtractionOutput>> {
    // Split into cached vs uncached
    const cached = new Map<string, ExtractionOutput>();
    const uncached: FieldSpec[] = [];

    for (const field of fields) {
      const cacheKey = makeCacheKey(scrape.contentHash, field.key, field.promptMd);
      const hit = await readExtractionCache(cacheKey);
      if (hit) {
        console.log(`  [${field.key}] Extraction cache hit`);
        cached.set(field.key, { ...hit, programId, extractedAt: new Date() });
      } else {
        uncached.push(field);
      }
    }

    if (uncached.length === 0) return cached;

    const content = selectContentWindow(
      scrape.contentMarkdown,
      uncached.map((f) => ({ key: f.key, label: f.label ?? '' })),
      MAX_CONTENT_CHARS
    );
    if (scrape.contentMarkdown.length > MAX_CONTENT_CHARS)
      console.log(
        `  ↳ [Batch] Content windowed: ${scrape.contentMarkdown.length} → ${content.length} chars (across ${uncached.length} fields)`
      );

    console.log(
      `  [Batch] Calling extraction model for ${uncached.length} uncached fields on ${scrape.url}`
    );

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 60000;
    let llmResults = new Map<string, RawLlmSingle>();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const client = createAnthropicClient();
        const response = await client.messages.create({
          model: MODEL_EXTRACTION,
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: buildBatchUserMessage(uncached, programName, countryIso, content),
            },
          ],
        });

        type ContentItem = (typeof response.content)[number];
        const lastTextBlock = response.content
          .filter((b): b is Extract<ContentItem, { type: 'text' }> => b.type === 'text')
          .at(-1);
        if (!lastTextBlock) throw new Error(`Batch extraction returned no text content`);

        const parsed = JSON.parse(stripJsonFences(lastTextBlock.text));
        llmResults = assertBatchResponse(
          parsed,
          uncached.map((f) => f.key)
        );
        lastError = null;
        break;
      } catch (err) {
        const isRateLimit =
          err instanceof Error &&
          (err.message.includes('429') ||
            err.message.includes('rate_limit') ||
            err.message.toLowerCase().includes('rate limit'));
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * attempt;
          console.warn(
            `  [Batch] Rate limit (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delay / 1000}s`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        break;
      }
    }

    if (lastError) {
      console.warn(
        `  [Batch] Batch LLM call failed — ${lastError.message}. Returning cached results only.`
      );
      return cached;
    }

    // Build outputs and write to cache
    const outputs = new Map<string, ExtractionOutput>();
    for (const field of uncached) {
      const raw = llmResults.get(field.key);
      if (!raw) {
        console.warn(`  [${field.key}] Missing from batch response — treated as not found`);
        continue;
      }
      const output = makeOutput(raw, field.key, programId);
      const cacheKey = makeCacheKey(scrape.contentHash, field.key, field.promptMd);
      await writeExtractionCache(cacheKey, output);
      outputs.set(field.key, output);
    }

    return new Map([...cached, ...outputs]);
  }

  // ── All-fields across multiple scrapes: batch per URL, merge by confidence ──
  // Phase 3.5: optional `confidenceCap` argument lowers any output's
  // `extractionConfidence` to `min(actual, cap)`. Used by the Tier 2 fallback
  // pass to enforce the ADR-013 0.85 ceiling so Tier 2 rows always route to
  // human review (never auto-approve).
  async executeAllFields(
    scrapes: ScrapeResult[],
    fields: ReadonlyArray<FieldSpec>,
    programId: string,
    programName: string,
    countryIso: string,
    options: { confidenceCap?: number } = {}
  ): Promise<Map<string, { output: ExtractionOutput; sourceUrl: string }>> {
    if (scrapes.length === 0)
      throw new Error(`No scrape results provided for program ${programId}`);

    const best = new Map<string, { output: ExtractionOutput; sourceUrl: string }>();
    const cap =
      typeof options.confidenceCap === 'number' &&
      options.confidenceCap >= 0 &&
      options.confidenceCap <= 1
        ? options.confidenceCap
        : null;

    for (let i = 0; i < scrapes.length; i++) {
      if (i > 0) {
        console.log(`  [Batch] Waiting ${INTER_BATCH_DELAY_MS / 1000}s before next URL batch...`);
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
      }

      const scrape = scrapes[i]!;
      const batchOutput = await this.executeBatch(
        scrape,
        fields,
        programId,
        programName,
        countryIso
      );

      for (const [fieldKey, output] of batchOutput) {
        if (output.valueRaw === '') continue;
        const capped =
          cap !== null && output.extractionConfidence > cap
            ? { ...output, extractionConfidence: cap }
            : output;
        const existing = best.get(fieldKey);
        if (!existing || capped.extractionConfidence > existing.output.extractionConfidence) {
          best.set(fieldKey, { output: capped, sourceUrl: scrape.url });
        }
      }

      // Early exit: stop trying more URLs if all fields have high-confidence results
      const stillNeeded = fields.filter((f) => {
        const r = best.get(f.key);
        return !r || r.output.extractionConfidence < EARLY_EXIT_CONFIDENCE;
      });
      if (stillNeeded.length === 0) {
        console.log(
          `  [Batch] All fields at confidence ≥${EARLY_EXIT_CONFIDENCE} — early exit after ${i + 1}/${scrapes.length} URLs`
        );
        break;
      }
    }

    return best;
  }
}
