import { describe, expect, it } from 'vitest';
import { ExtractStageImpl } from '../src/stages/extract';
import type { ExtractionOutput, FieldSpec, ScrapeResult } from '../src/types/extraction';

// Phase 3.5 / Phase 3-recanary-prep — Tier-2 fallback uses
// `executeAllFields(scrapes, fields, ..., { confidenceCap: 0.85 })`.
// The cap MUST clip both auto-approved-eligible (≥0.85) and high-confidence
// (>0.85) results so every Tier-2 row routes to /review per ADR-013.

class StubExtract extends ExtractStageImpl {
  constructor(private readonly stub: Map<string, ExtractionOutput>) {
    super(new Map());
  }
  async executeBatch(
    _scrape: ScrapeResult,
    _fields: ReadonlyArray<FieldSpec>,
    _programId: string,
    _programName: string,
    _countryIso: string
  ): Promise<Map<string, ExtractionOutput>> {
    return new Map(this.stub);
  }
}

function makeOutput(fieldKey: string, confidence: number, programId: string): ExtractionOutput {
  return {
    fieldDefinitionKey: fieldKey,
    programId,
    valueRaw: 'sample',
    sourceSentence: 'a verbatim sentence about sample.',
    characterOffsets: { start: 0, end: 0 },
    extractionModel: 'claude-sonnet-4-6',
    extractionConfidence: confidence,
    extractedAt: new Date('2026-04-27T00:00:00Z'),
  };
}

const PROGRAM_ID = '00000000-0000-0000-0000-000000000001';
const SCRAPE: ScrapeResult = {
  url: 'https://fragomen.example.com/aus-482-guide',
  contentMarkdown: 'sample content',
  contentHash: 'abc123',
  httpStatus: 200,
  scrapedAt: new Date('2026-04-27T00:00:00Z'),
};

describe('executeAllFields confidenceCap option (Phase 3-recanary-prep)', () => {
  it('without cap, returns the original confidence', async () => {
    const stub = new Map([
      ['B.3.3', makeOutput('B.3.3', 0.92, PROGRAM_ID)],
      ['C.2.4', makeOutput('C.2.4', 0.78, PROGRAM_ID)],
    ]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [
        { key: 'B.3.3', label: 'Appeal', promptMd: 'p1' },
        { key: 'C.2.4', label: 'Same-sex', promptMd: 'p2' },
      ],
      PROGRAM_ID,
      'Test program',
      'AUS'
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.92);
    expect(out.get('C.2.4')!.output.extractionConfidence).toBe(0.78);
  });

  it('cap=0.85 clips a 0.92 result down to 0.85', async () => {
    const stub = new Map([['B.3.3', makeOutput('B.3.3', 0.92, PROGRAM_ID)]]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [{ key: 'B.3.3', label: 'Appeal', promptMd: 'p1' }],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: 0.85 }
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.85);
  });

  it('cap=0.85 leaves a 0.50 result UNCHANGED (below cap)', async () => {
    const stub = new Map([['B.3.3', makeOutput('B.3.3', 0.5, PROGRAM_ID)]]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [{ key: 'B.3.3', label: 'Appeal', promptMd: 'p1' }],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: 0.85 }
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.5);
  });

  it('cap=0.85 with mixed confidences caps only those above the cap', async () => {
    const stub = new Map([
      ['B.3.3', makeOutput('B.3.3', 0.95, PROGRAM_ID)],
      ['C.2.4', makeOutput('C.2.4', 0.82, PROGRAM_ID)],
      ['D.2.3', makeOutput('D.2.3', 0.85, PROGRAM_ID)], // exactly at cap; not capped
    ]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [
        { key: 'B.3.3', label: 'a', promptMd: 'p1' },
        { key: 'C.2.4', label: 'b', promptMd: 'p2' },
        { key: 'D.2.3', label: 'c', promptMd: 'p3' },
      ],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: 0.85 }
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.85); // capped
    expect(out.get('C.2.4')!.output.extractionConfidence).toBe(0.82); // unchanged
    expect(out.get('D.2.3')!.output.extractionConfidence).toBe(0.85); // unchanged (=cap)
  });

  it('preserves other fields on the output (only confidence is capped)', async () => {
    const original = makeOutput('B.3.3', 0.95, PROGRAM_ID);
    const stub = new Map([['B.3.3', original]]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [{ key: 'B.3.3', label: 'a', promptMd: 'p1' }],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: 0.85 }
    );
    const capped = out.get('B.3.3')!.output;
    expect(capped.valueRaw).toBe(original.valueRaw);
    expect(capped.sourceSentence).toBe(original.sourceSentence);
    expect(capped.fieldDefinitionKey).toBe(original.fieldDefinitionKey);
    expect(capped.extractionModel).toBe(original.extractionModel);
  });

  it('invalid cap (negative) is ignored (treated as no cap)', async () => {
    const stub = new Map([['B.3.3', makeOutput('B.3.3', 0.92, PROGRAM_ID)]]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [{ key: 'B.3.3', label: 'a', promptMd: 'p1' }],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: -0.5 }
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.92);
  });

  it('invalid cap (>1) is ignored', async () => {
    const stub = new Map([['B.3.3', makeOutput('B.3.3', 0.92, PROGRAM_ID)]]);
    const ext = new StubExtract(stub);
    const out = await ext.executeAllFields(
      [SCRAPE],
      [{ key: 'B.3.3', label: 'a', promptMd: 'p1' }],
      PROGRAM_ID,
      'Test program',
      'AUS',
      { confidenceCap: 1.5 }
    );
    expect(out.get('B.3.3')!.output.extractionConfidence).toBe(0.92);
  });
});
