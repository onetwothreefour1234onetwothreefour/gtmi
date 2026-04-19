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

export class DiscoverStageImpl implements DiscoverStage {
  async execute(programId: string, programName: string, country: string): Promise<DiscoveryResult> {
    const client = createAnthropicClient();

    const discoveryTools: Parameters<typeof client.messages.create>[0]['tools'] = [
      // @ts-expect-error: web_search_20250305 is a valid API tool not yet typed in SDK 0.39.0
      { type: 'web_search_20250305', name: 'web_search' },
    ];

    const response = await client.messages
      .create({
        model: MODEL_DISCOVERY,
        max_tokens: 2000,
        tools: discoveryTools,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(programName, country) }],
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Discovery failed for program ${programId}: ${msg}`);
      });

    const content = response.content;
    type ContentItem = (typeof content)[number];
    const lastTextBlock = content
      .filter((block): block is Extract<ContentItem, { type: 'text' }> => block.type === 'text')
      .at(-1);

    if (!lastTextBlock) {
      throw new Error(`Discovery returned no text content for program ${programId}`);
    }

    const raw = lastTextBlock.text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Discovery response was not valid JSON for program ${programId}: ${raw}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`Discovery response was not valid JSON for program ${programId}: ${raw}`);
    }

    const discoveredUrls = (parsed as DiscoveredUrl[]).slice(0, 5);

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
