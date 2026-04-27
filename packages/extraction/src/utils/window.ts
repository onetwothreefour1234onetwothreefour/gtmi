/**
 * Field-aware content windowing.
 *
 * Government immigration pages routinely run >30K characters. The extraction
 * model has a finite token budget per call, so we have to choose which slice
 * of the document to send. The naive approach (`content.slice(0, 30000)`) loses
 * the answer whenever the relevant section appears later in the document — and
 * `scripts/diag-empty-fields.ts` showed this is the root cause for the bulk of
 * Wave 1 fields that returned no value on the AUS canary.
 *
 * Strategy:
 *   1. Split the doc into fixed-size chunks (with small overlap so a phrase
 *      crossing a boundary is still found).
 *   2. Score each chunk by counting whole-word matches of the field-derived
 *      keywords. All fields share one window per LLM call (batch path), so we
 *      sum scores across all input fields.
 *   3. Always seed the selection with a baseline prefix and suffix so the
 *      doc's own context (TOC, section headers, footer disclaimers) survives.
 *   4. Greedily add the highest-scoring remaining chunks until the budget is
 *      hit, then re-emit them in original document order separated by a
 *      `\n[...]\n` ellipsis marker.
 *
 * If the document already fits the budget, we return it unchanged — preserving
 * exact behavior for short pages and avoiding any cache-key churn.
 *
 * IMPORTANT: changing this function changes what the LLM sees for the same
 * (contentHash, fieldKey, prompt) tuple. Bump WINDOW_VERSION in extract.ts
 * whenever you change selection logic so cached results don't go stale.
 */

const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'a',
  'an',
  'of',
  'for',
  'in',
  'on',
  'to',
  'by',
  'as',
  'at',
  'with',
  'from',
  'vs',
  'per',
  'no',
  'not',
]);

export function extractKeywords(label: string): string[] {
  const tokens = label
    .toLowerCase()
    .split(/[\s/(),\-–]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return [...new Set(tokens)].slice(0, 4);
}

export interface WindowField {
  key: string;
  label: string;
}

interface Chunk {
  index: number;
  start: number;
  end: number;
  text: string;
  textLower: string;
  score: number;
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const BASELINE_PREFIX = 1500;
const BASELINE_SUFFIX = 800;
const SEPARATOR = '\n[...]\n';

function buildChunks(content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const stride = CHUNK_SIZE - CHUNK_OVERLAP;
  let start = 0;
  let index = 0;
  while (start < content.length) {
    const end = Math.min(start + CHUNK_SIZE, content.length);
    const text = content.slice(start, end);
    chunks.push({
      index: index++,
      start,
      end,
      text,
      textLower: text.toLowerCase(),
      score: 0,
    });
    if (end === content.length) break;
    start += stride;
  }
  return chunks;
}

function scoreChunks(chunks: Chunk[], keywords: string[]): void {
  if (keywords.length === 0) return;
  const patterns = keywords.map((k) => new RegExp(`\\b${escapeRegex(k)}\\b`, 'g'));
  for (const chunk of chunks) {
    let score = 0;
    for (const re of patterns) {
      const matches = chunk.textLower.match(re);
      if (matches) score += matches.length;
    }
    chunk.score = score;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Select up to `maxChars` of `content` that is most likely to contain answers
 * for any of the given fields. Returns the original `content` unchanged when
 * it already fits.
 */
export function selectContentWindow(
  content: string,
  fields: ReadonlyArray<WindowField>,
  maxChars: number
): string {
  if (content.length <= maxChars) return content;

  const keywords = new Set<string>();
  for (const f of fields) {
    for (const kw of extractKeywords(f.label)) keywords.add(kw);
  }
  const keywordList = [...keywords];

  // No keywords means we cannot rank chunks — fall back to the historical
  // behaviour (head slice) so we never produce *less* signal than the previous
  // implementation. Callers that omit labels deliberately get this fallback.
  if (keywordList.length === 0) return content.slice(0, maxChars);

  const chunks = buildChunks(content);
  scoreChunks(chunks, keywordList);

  const selected = new Set<number>();

  // Always include baseline prefix + suffix so doc structure (headings, footer)
  // is preserved even when the highest-scoring chunks are deep in the body.
  const prefixEnd = Math.min(BASELINE_PREFIX, content.length);
  const suffixStart = Math.max(content.length - BASELINE_SUFFIX, 0);
  for (const c of chunks) {
    if (c.start < prefixEnd) selected.add(c.index);
    if (c.end > suffixStart) selected.add(c.index);
  }

  // Greedily add highest-scoring chunks until budget is exceeded.
  const ranked = [...chunks].sort((a, b) => b.score - a.score || a.index - b.index);
  for (const chunk of ranked) {
    if (selected.has(chunk.index)) continue;
    if (chunk.score === 0) break;
    const projected = projectedLength(selected, chunks, chunk.index);
    if (projected > maxChars) continue;
    selected.add(chunk.index);
  }

  // Emit selected chunks in document order. Merge contiguous chunks (deduping
  // overlap) so the output reads naturally; insert ellipsis between gaps.
  const orderedIndices = [...selected].sort((a, b) => a - b);
  const pieces: string[] = [];
  let lastEnd = -1;
  for (const idx of orderedIndices) {
    const chunk = chunks[idx]!;
    if (lastEnd === -1) {
      pieces.push(chunk.text);
    } else if (chunk.start <= lastEnd) {
      // contiguous (overlap region) — append only the new tail
      const tailStart = lastEnd - chunk.start;
      pieces.push(chunk.text.slice(Math.max(0, tailStart)));
    } else {
      pieces.push(SEPARATOR);
      pieces.push(chunk.text);
    }
    lastEnd = chunk.end;
  }

  const result = pieces.join('');
  // Final safety: if join ended up over budget (shouldn't happen given the
  // projection check), hard-truncate at maxChars to keep the contract.
  return result.length > maxChars ? result.slice(0, maxChars) : result;
}

function projectedLength(selected: Set<number>, chunks: Chunk[], candidateIdx: number): number {
  const trial = new Set(selected);
  trial.add(candidateIdx);
  const ordered = [...trial].sort((a, b) => a - b);
  let total = 0;
  let lastEnd = -1;
  for (const idx of ordered) {
    const chunk = chunks[idx]!;
    if (lastEnd === -1) {
      total += chunk.text.length;
    } else if (chunk.start <= lastEnd) {
      const tailStart = lastEnd - chunk.start;
      total += chunk.text.length - Math.max(0, tailStart);
    } else {
      total += SEPARATOR.length + chunk.text.length;
    }
    lastEnd = chunk.end;
  }
  return total;
}
