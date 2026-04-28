/**
 * Phase 3 Pre-flight: rollup gap register across the canary cohort.
 *
 * Read-only. Writes nothing to the DB. Produces one CSV row per
 * (programme, field) for every field in ACTIVE_FIELD_CODES.
 *
 * Columns:
 *   country, programId, programName, fieldKey, fieldLabel, pillar, subFactor,
 *   status, classification, valueRawTrunc, sourceUrl, sourceTier,
 *   extractionConfidence, validationConfidence
 *
 * Classification (TRUNCATION | LLM_MISS | ABSENT | URL_MISSING | POPULATED):
 *   - POPULATED  — field_values row exists with a non-empty valueRaw
 *   - URL_MISSING — programme has zero scraped sources at all
 *   - TRUNCATION — field-label keyword found only in chars >30K of a scrape
 *   - LLM_MISS   — keyword found in first 30K but extraction empty
 *   - ABSENT     — keyword not found anywhere in any scrape
 *
 * Usage:
 *   npx tsx scripts/audit-empty-fields-rollup.ts \
 *     --countries AUS,SGP,CAN \
 *     --out docs/phase-3/baseline-gaps.csv
 *
 * Default countries: AUS,SGP,CAN
 * Default output: stdout (use --out to write a file)
 */

import {
  client,
  db,
  fieldDefinitions,
  fieldValues,
  programs,
  sources,
  scrapeCache,
} from '@gtmi/db';
import { and, inArray } from 'drizzle-orm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ACTIVE_FIELD_CODES } from './wave-config';

const MAX_CONTENT_CHARS = 30000;
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

type Classification = 'POPULATED' | 'TRUNCATION' | 'LLM_MISS' | 'ABSENT' | 'URL_MISSING';

interface Row {
  country: string;
  programId: string;
  programName: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: string;
  subFactor: string;
  status: string;
  classification: Classification;
  valueRawTrunc: string;
  sourceUrl: string;
  sourceTier: string;
  extractionConfidence: string;
  validationConfidence: string;
}

function extractKeywords(label: string): string[] {
  const tokens = label
    .toLowerCase()
    .split(/[\s/(),\-–]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return [...new Set(tokens)].slice(0, 4);
}

function classifyEmpty(
  keywords: string[],
  cachedContents: Array<{ content: string; isTruncated: boolean }>
): Classification {
  if (cachedContents.length === 0) return 'URL_MISSING';
  if (keywords.length === 0) return 'ABSENT';
  const patterns = keywords.map((k) => new RegExp(`\\b${k}\\b`, 'i'));
  let foundIn0to30k = false;
  let foundAfter30k = false;
  let anyTruncated = false;
  for (const c of cachedContents) {
    if (c.isTruncated) anyTruncated = true;
    const head = c.content.slice(0, MAX_CONTENT_CHARS);
    const tail = c.isTruncated ? c.content.slice(MAX_CONTENT_CHARS) : '';
    if (patterns.some((re) => re.test(head))) foundIn0to30k = true;
    if (patterns.some((re) => re.test(tail))) foundAfter30k = true;
  }
  if (foundAfter30k && !foundIn0to30k && anyTruncated) return 'TRUNCATION';
  if (foundIn0to30k) return 'LLM_MISS';
  return 'ABSENT';
}

function csvEscape(s: string): string {
  if (s == null) return '';
  // Replace newlines and CR with spaces; double-quote if it contains comma/quote/newline.
  const cleaned = String(s)
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (/[",]/.test(cleaned)) return `"${cleaned.replace(/"/g, '""')}"`;
  return cleaned;
}

function parseArgs(argv: string[]): {
  countries: string[];
  out?: string;
  onlyCanaried: boolean;
  programmeIds?: string[];
} {
  let countries = ['AUS', 'SGP', 'CAN'];
  let out: string | undefined;
  let onlyCanaried = false;
  let programmeIds: string[] | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--countries' && next) {
      countries = next
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i++;
    } else if (a === '--out' && next) {
      out = next;
      i++;
    } else if (a === '--only-canaried') {
      onlyCanaried = true;
    } else if (a === '--programme-ids' && next) {
      programmeIds = next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
    }
  }
  return { countries, out, onlyCanaried, programmeIds };
}

async function main() {
  const { countries, out, onlyCanaried, programmeIds } = parseArgs(process.argv.slice(2));

  // 1. Load all field definitions limited to ACTIVE_FIELD_CODES.
  const allDefs = await db.select().from(fieldDefinitions);
  const activeDefs = allDefs
    .filter((d) => ACTIVE_FIELD_CODES.includes(d.key))
    .sort((a, b) => a.key.localeCompare(b.key));

  // 2. Load programmes — by id list if --programme-ids given, otherwise by country.
  let programRows = programmeIds
    ? await db.select().from(programs).where(inArray(programs.id, programmeIds))
    : await db.select().from(programs).where(inArray(programs.countryIso, countries));
  if (programRows.length === 0) {
    console.error(
      `No programmes found for ${programmeIds ? `ids=${programmeIds.join(',')}` : `countries=${countries.join(',')}`}`
    );
    process.exit(2);
  }

  // 3. Load all field_values for these programmes (single round-trip).
  let programIds = programRows.map((p) => p.id);
  const fvRowsAll = await db
    .select()
    .from(fieldValues)
    .where(
      and(
        inArray(fieldValues.programId, programIds),
        inArray(
          fieldValues.fieldDefinitionId,
          activeDefs.map((d) => d.id)
        )
      )
    );

  // 3b. If --only-canaried, restrict to programmes with ≥1 field_values row.
  if (onlyCanaried) {
    const touched = new Set(fvRowsAll.map((fv) => fv.programId));
    programRows = programRows.filter((p) => touched.has(p.id));
    programIds = programRows.map((p) => p.id);
    process.stderr.write(
      `--only-canaried: restricted to ${programRows.length} programmes with ≥1 field_values row\n`
    );
  }
  const fvRows = fvRowsAll.filter((fv) => programIds.includes(fv.programId));

  // 4. Load all sources + scrape cache content.
  //    Include the entire scrape_cache (not just sources rows) so country-level
  //    scrapes from `country-sources.ts` count toward keyword presence.
  const sourceRows = await db.select().from(sources).where(inArray(sources.programId, programIds));
  const cacheRows = await db.select().from(scrapeCache);

  // 5. Index everything for fast lookup.
  const sourcesByProgramId = new Map<string, typeof sourceRows>();
  for (const s of sourceRows) {
    const list = sourcesByProgramId.get(s.programId) ?? [];
    list.push(s);
    sourcesByProgramId.set(s.programId, list);
  }
  const cacheByUrl = new Map<string, (typeof cacheRows)[number]>();
  for (const c of cacheRows) cacheByUrl.set(c.url, c);
  const fvByKey = new Map<string, (typeof fvRows)[number]>();
  for (const fv of fvRows) fvByKey.set(`${fv.programId}|${fv.fieldDefinitionId}`, fv);
  const sourceById = new Map(sourceRows.map((s) => [s.id, s]));

  // 6. Build the rows.
  // For keyword classification we use:
  //   - scrape_cache entries for the programme's own source URLs, AND
  //   - the entire scrape_cache (covers country-level scrapes used by the canary)
  // This matches `diag-empty-fields.ts` behaviour and avoids spurious URL_MISSING
  // when the data is actually on a global/country-level page.
  const allCachedContents = cacheRows.map((c) => ({
    content: c.contentMarkdown ?? '',
    isTruncated: (c.contentMarkdown ?? '').length > MAX_CONTENT_CHARS,
  }));
  const rows: Row[] = [];
  for (const program of programRows) {
    const progSources = sourcesByProgramId.get(program.id) ?? [];
    const progCachedContents = progSources
      .map((s) => cacheByUrl.get(s.url))
      .filter((c): c is (typeof cacheRows)[number] => Boolean(c))
      .map((c) => ({
        content: c.contentMarkdown ?? '',
        isTruncated: (c.contentMarkdown ?? '').length > MAX_CONTENT_CHARS,
      }));
    // URL_MISSING is now strictly: programme has zero source rows.
    const hasAnyUrl = progSources.length > 0;
    const cachedContents =
      progCachedContents.length > 0 ? progCachedContents : hasAnyUrl ? allCachedContents : [];

    // Phase 3.6.2 / ITEM 1 — synthetic provenance markers that legitimately
    // produce rows with null/empty value_raw. The audit rollup must classify
    // these as POPULATED, not ABSENT.
    const SYNTHETIC_MODELS = new Set([
      'country-substitute-regional',
      'derived-knowledge',
      'derived-computation',
      'v-dem-api-direct',
      'world-bank-api-direct',
    ]);
    for (const def of activeDefs) {
      const fv = fvByKey.get(`${program.id}|${def.id}`);
      const valueRaw = fv?.valueRaw?.trim() ?? '';
      const provenance = (fv?.provenance ?? null) as Record<string, unknown> | null;
      const hasIndicatorScore = fv?.valueIndicatorScore != null;
      const hasNormalizedValue = fv?.valueNormalized != null;
      const extractionModel =
        typeof provenance?.['extractionModel'] === 'string'
          ? (provenance['extractionModel'] as string)
          : '';
      const isSyntheticModel = SYNTHETIC_MODELS.has(extractionModel);
      let classification: Classification;
      if (
        fv &&
        (valueRaw !== '' || hasIndicatorScore || (hasNormalizedValue && isSyntheticModel))
      ) {
        classification = 'POPULATED';
      } else {
        classification = classifyEmpty(extractKeywords(def.label), cachedContents);
      }
      const src = fv?.sourceId ? sourceById.get(fv.sourceId) : undefined;
      rows.push({
        country: program.countryIso,
        programId: program.id,
        programName: program.name,
        fieldKey: def.key,
        fieldLabel: def.label,
        pillar: def.pillar,
        subFactor: def.subFactor,
        status: fv?.status ?? '',
        classification,
        valueRawTrunc: valueRaw.slice(0, 80),
        sourceUrl: (provenance?.sourceUrl as string | undefined) ?? src?.url ?? '',
        sourceTier:
          (provenance?.sourceTier as number | undefined)?.toString() ?? src?.tier?.toString() ?? '',
        extractionConfidence:
          (provenance?.extractionConfidence as number | undefined)?.toFixed(3) ?? '',
        validationConfidence:
          (provenance?.validationConfidence as number | undefined)?.toFixed(3) ?? '',
      });
    }
  }

  // 7. Render CSV.
  const header = [
    'country',
    'programId',
    'programName',
    'fieldKey',
    'fieldLabel',
    'pillar',
    'subFactor',
    'status',
    'classification',
    'valueRawTrunc',
    'sourceUrl',
    'sourceTier',
    'extractionConfidence',
    'validationConfidence',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.country,
        r.programId,
        r.programName,
        r.fieldKey,
        r.fieldLabel,
        r.pillar,
        r.subFactor,
        r.status,
        r.classification,
        r.valueRawTrunc,
        r.sourceUrl,
        r.sourceTier,
        r.extractionConfidence,
        r.validationConfidence,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  const csv = lines.join('\n') + '\n';

  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, csv, 'utf8');
  } else {
    process.stdout.write(csv);
  }

  // 8. Summary to stderr (so stdout stays pure CSV when --out is omitted).
  const counts: Record<Classification, number> = {
    POPULATED: 0,
    TRUNCATION: 0,
    LLM_MISS: 0,
    ABSENT: 0,
    URL_MISSING: 0,
  };
  for (const r of rows) counts[r.classification]++;

  const perProgramme = new Map<string, { populated: number; total: number; name: string }>();
  for (const r of rows) {
    const k = `${r.country}|${r.programId}`;
    const entry = perProgramme.get(k) ?? { populated: 0, total: 0, name: r.programName };
    entry.total++;
    if (r.classification === 'POPULATED') entry.populated++;
    perProgramme.set(k, entry);
  }

  process.stderr.write(`\nGap register written: ${rows.length} rows`);
  if (out) process.stderr.write(` → ${out}`);
  process.stderr.write(`\n\nClassification counts:\n`);
  for (const [k, v] of Object.entries(counts)) {
    process.stderr.write(`  ${k.padEnd(12)} ${v}\n`);
  }
  process.stderr.write(`\nCoverage per programme (POPULATED / 48):\n`);
  for (const [k, v] of [...perProgramme.entries()].sort()) {
    const [country] = k.split('|');
    const pct = ((v.populated / v.total) * 100).toFixed(1);
    process.stderr.write(`  ${country}  ${v.populated}/${v.total}  (${pct}%)  ${v.name}\n`);
  }
  process.stderr.write('\n');
}

main()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      // ignore
    }
    process.exit(1);
  });
