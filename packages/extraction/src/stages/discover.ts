import type { DiscoveredUrl, DiscoveryResult } from '../types/extraction';
import type { DiscoverStage } from '../types/pipeline';

const SYSTEM_PROMPT =
  'You are a specialist immigration research agent. Your job is to find the most ' +
  'authoritative web sources for a given visa or residency program that contain ' +
  'structured, field-level eligibility and criteria data — such as salary thresholds, ' +
  'occupation lists, fees, processing times, and family or pathway entitlements. You must ' +
  'always prioritise official government sources. You classify each source by its geographic ' +
  'level: global (UN, World Bank, ILO), continental (EU, ASEAN, OECD regional), national ' +
  '(country-level government), or regional (province, state, canton, emirate-level ' +
  'government). You never fabricate URLs.';

function buildUserMessage(programName: string, country: string): string {
  return (
    `Find up to 10 of the most relevant and authoritative web pages for this program: ` +
    `${programName} in ${country}. Only include URLs that genuinely add value — do not ` +
    `pad to reach 10. Return your answer as a valid JSON array with exactly this structure ` +
    `— no markdown, no explanation, just the JSON array: ` +
    `[{"url": string, "tier": 1|2|3, "geographicLevel": "global"|"continental"|"national"|"regional", ` +
    `"reason": string, "isOfficial": boolean}]. ` +
    `Your first priority is to find the OFFICIAL GOVERNMENT VISA LISTING PAGE for this specific ` +
    `program. This is the page on the immigration authority's website that is dedicated ` +
    `specifically to this visa subclass or program — not the general immigration homepage, not a ` +
    `news article, not a summary page. ` +
    `For Australian visas, this is typically at: immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/[visa-name-and-subclass]/[stream-name]. ` +
    `For UK visas: gov.uk/[visa-name]. ` +
    `For Canadian visas: canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/[program]. ` +
    `For Singapore: mom.gov.sg/passes-and-permits/[pass-name]. ` +
    `For Hong Kong: immd.gov.hk. ` +
    `Search specifically for "${programName} ${country} official visa page" and the visa subclass number ` +
    `with country and "immigration" to find the exact listing page. ` +
    `This official listing page MUST be your first result. Only then find additional supplementary pages. ` +
    `PRIORITISE urls that are most likely to contain structured eligibility and program criteria data, ` +
    `specifically: salary or income thresholds, educational qualification requirements, work experience ` +
    `requirements, occupation or skills lists, visa processing times, government fees, family member ` +
    `inclusion rights, permanent residency and citizenship pathways, and policy stability or review history. ` +
    `DEPRIORITISE or EXCLUDE urls that are primarily about: employer sponsorship processes, English language ` +
    `test provider lists, generic visa landing pages with no field-level criteria data, immigration ` +
    `consultation or agent services, and news or media articles. ` +
    `SOURCE MIX REQUIREMENT: Your 10 URLs must represent a genuine mix of the following five ` +
    `source categories. Official government sources may account for up to 5 of the 10 URLs. ` +
    `The remaining URLs must be drawn from the non-government categories below, selected and ` +
    `ranked strictly by their relevance and suitability for the specific field-level data this ` +
    `program requires — not by convenience or domain familiarity. If a non-government source ` +
    `covers multiple relevant fields (salary thresholds, fees, family rights, pathway timelines) ` +
    `it should be ranked higher than a source covering only one. ` +
    `Category 1 — Official government and intergovernmental sources (up to 5 URLs, Tier 1): ` +
    `The primary official source for this visa or program — typically the national immigration ` +
    `authority, ministry of manpower, or home affairs department. Include the main program page ` +
    `plus additional official pages covering fees, occupation lists, processing times, or ` +
    `eligibility criteria. Also include relevant legislation or gazette instruments if they ` +
    `contain specific thresholds or eligibility rules. These must be direct government domain ` +
    `URLs — not third-party summaries of government content. ` +
    `Category 2 — Global and regional institutional sources (Tier 1, counted within the 5 ` +
    `official URLs if intergovernmental): Authoritative international bodies that publish ` +
    `country-level data relevant to the program's context — such as organisations that track ` +
    `talent mobility, governance quality, labour market conditions, or migration policy trends ` +
    `across countries. Prefer sources that publish structured, annually-updated country ` +
    `comparisons rather than single-country reports. ` +
    `Category 3 — Established immigration law and advisory firms (Tier 2, prioritised by ` +
    `field coverage depth): Reputable professional services firms that publish detailed, ` +
    `regularly-updated visa guides as part of their advisory practice. These guides should ` +
    `cover eligibility criteria, salary thresholds, application procedures, dependent rights, ` +
    `and pathway options in depth. Prefer firms with a recognised international practice and ` +
    `a track record of publishing accurate, jurisdiction-specific guidance. Prioritise guides ` +
    `that cover the broadest range of field-level data for this specific program. Avoid ` +
    `lead-generation pages, contact forms, or pages that exist solely to capture client enquiries. ` +
    `Category 4 — Independent visa and residency research publishers (Tier 2, prioritised by ` +
    `field coverage depth): Organisations or publications that independently research and compare ` +
    `visa and residency programs across multiple countries — such as global mobility indices, ` +
    `residency-by-investment research platforms, or comparative immigration databases. These ` +
    `sources add value by contextualising a program within the broader global landscape and often ` +
    `surface data points (minimum stay requirements, renewal conditions, pathway timelines) not ` +
    `prominently featured on official pages. Prioritise sources that include quantitative program ` +
    `comparisons over narrative-only summaries. ` +
    `Category 5 — Specialist immigration news and professional intelligence sources (Tier 2, ` +
    `prioritised by recency and policy-change coverage): Professional publications or newsletters ` +
    `that cover immigration policy changes, regulatory updates, and program amendments for a ` +
    `practitioner audience. These sources are particularly valuable for fields related to policy ` +
    `stability, recent changes, and forward-looking indicators. Prefer sources that cite primary ` +
    `government sources and provide analysis rather than republishing press releases. Prioritise ` +
    `the most recent publications covering this specific program. ` +
    `EXCLUSIONS — never return: pages that require login, registration, or payment to view; ` +
    `generic immigration homepages without program-specific content; pages whose primary purpose ` +
    `is to sell visa services or capture client leads; news articles about unrelated immigration ` +
    `topics that merely mention the program in passing; social media pages, forum threads, or ` +
    `user-generated content; pages in a language other than English unless no English equivalent exists. ` +
    `Return urls ranked by relevance — most relevant first (after the mandatory official listing page) — ` +
    `weighted by how much structured field-level criteria data each page is expected to contain. ` +
    `Rules: (1) The first entry must always be the official national government page. ` +
    `(2) Remaining entries may include: additional government pages (regional, state, federal ` +
    `agency), official continental sources (e.g. EU directives), supplementary official pages ` +
    `(fees, processing times, forms), and Tier 2 law firm sources for cross-check purposes. ` +
    `(3) Classify each URL by geographic level: global (UN, World Bank, ILO), continental ` +
    `(EU, ASEAN, OECD regional), national (country-level government), or regional (province, ` +
    `state, canton, emirate-level government). ` +
    `(4) tier must be 1 for official government, intergovernmental, and national legislative ` +
    `sources; 2 for professional advisory firms, independent research publishers, and specialist ` +
    `immigration intelligence sources; 3 for all other sources. ` +
    `(5) isOfficial must be true for any government or intergovernmental source. ` +
    `(6) reason must be one sentence explaining what specific field-level data (e.g. salary thresholds, ` +
    `occupation lists, fees, processing times) this page is expected to contain. ` +
    `(7) Do not include duplicate URLs, redirects, or pages that do not contain ` +
    `program-specific information.`
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

async function verifyUrls(urls: DiscoveredUrl[]): Promise<DiscoveredUrl[]> {
  const results = await Promise.all(
    urls.map(async (discovered) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(discovered.url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        if (res.status === 404 || res.status === 410) {
          console.warn(
            `[Discovery] Discarded unreachable URL: ${discovered.url} (status: ${res.status})`
          );
          return null;
        }
        return discovered;
      } catch {
        console.warn(
          `[Discovery] Discarded unreachable URL: ${discovered.url} (status: connection error)`
        );
        return null;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return results.filter((u): u is DiscoveredUrl => u !== null);
}

export class DiscoverStageImpl implements DiscoverStage {
  async execute(programId: string, programName: string, country: string): Promise<DiscoveryResult> {
    const PERPLEXITY_API_KEY = process.env['PERPLEXITY_API_KEY'];
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not set in environment');
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(programName, country) },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    }).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Discovery API call failed for program ${programId}: ${msg}`);
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: HTTP ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new Error(`Discovery returned no text content for program ${programId}`);
    }

    const parsedUrls = parseDiscoveredUrls(content, programId).slice(0, 10);
    const discoveredUrls = await verifyUrls(parsedUrls);

    if (discoveredUrls.length === 0) {
      throw new Error(`Discovery produced no reachable URLs for program ${programId}`);
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
