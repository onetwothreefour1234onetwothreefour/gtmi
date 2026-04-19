import { createAnthropicClient, MODEL_DISCOVERY } from '../clients/anthropic';
import type { DiscoveredUrl, DiscoveryResult } from '../types/extraction';
import type { DiscoverStage } from '../types/pipeline';

const SYSTEM_PROMPT =
  'You are a specialist immigration research agent. Your job is to find the most ' +
  'authoritative and useful web sources for a given visa or residency program. You must ' +
  'always prioritise official government sources. You classify each source by its geographic ' +
  'level: global (UN, World Bank, ILO), continental (EU, ASEAN, OECD regional), national ' +
  '(country-level government), or regional (province, state, canton, emirate-level ' +
  'government). You never fabricate URLs.';

function buildUserMessage(programName: string, country: string): string {
  return (
    `Find the top 5 most relevant and authoritative web pages for this program: ` +
    `${programName} in ${country}. Return your answer as a valid JSON array with exactly ` +
    `this structure — no markdown, no explanation, just the JSON array: ` +
    `[{"url": string, "tier": 1|2|3, "geographicLevel": "global"|"continental"|"national"|"regional", ` +
    `"reason": string, "isOfficial": boolean}]. ` +
    `Rules: (1) The first entry must always be the official national government page. ` +
    `(2) tier must be 1, 2, or 3. ` +
    `(3) geographicLevel must be one of: global, continental, national, regional. ` +
    `(4) isOfficial must be true for any government or intergovernmental source. ` +
    `(5) reason must be one sentence. ` +
    `(6) Do not include duplicate URLs.`
  );
}

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced?.[1]?.trim() ?? text.trim();
}

const VALID_TIERS = new Set([1, 2, 3]);
const VALID_GEO_LEVELS = new Set(['global', 'continental', 'national', 'regional']);

function assertDiscoveredUrl(item: unknown, index: number, programId: string): DiscoveredUrl {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`Discovery item ${index} is not an object for program ${programId}`);
  }
  const obj = item as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof obj['url'] !== 'string') missing.push('url');
  if (!VALID_TIERS.has(obj['tier'] as number)) missing.push('tier');
  if (!VALID_GEO_LEVELS.has(obj['geographicLevel'] as string)) missing.push('geographicLevel');
  if (typeof obj['reason'] !== 'string') missing.push('reason');
  if (typeof obj['isOfficial'] !== 'boolean') missing.push('isOfficial');
  if (missing.length > 0) {
    throw new Error(
      `Discovery item ${index} is missing or invalid fields [${missing.join(', ')}] for program ${programId}`
    );
  }
  return obj as unknown as DiscoveredUrl;
}

function parseDiscoveredUrls(raw: string, programId: string): DiscoveredUrl[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    throw new Error(`Discovery response was not valid JSON for program ${programId}: ${raw}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Discovery response was not an array for program ${programId}: ${raw}`);
  }
  return parsed.map((item, i) => assertDiscoveredUrl(item, i, programId));
}

export class DiscoverStageImpl implements DiscoverStage {
  async execute(programId: string, programName: string, country: string): Promise<DiscoveryResult> {
    const client = createAnthropicClient();

    const response = await client.messages
      .create({
        model: MODEL_DISCOVERY,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(programName, country) }],
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Discovery API call failed for program ${programId}: ${msg}`);
      });

    type ContentItem = (typeof response.content)[number];
    const lastTextBlock = response.content
      .filter((block): block is Extract<ContentItem, { type: 'text' }> => block.type === 'text')
      .at(-1);

    if (!lastTextBlock) {
      throw new Error(`Discovery returned no text content for program ${programId}`);
    }

    const discoveredUrls = parseDiscoveredUrls(lastTextBlock.text, programId).slice(0, 5);

    if (discoveredUrls.length === 0) {
      throw new Error(`Discovery returned zero URLs for program ${programId}`);
    }

    return {
      programId,
      programName,
      country,
      discoveredUrls,
      discoveredAt: new Date(),
    };
  }
}
