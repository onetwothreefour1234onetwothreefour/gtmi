import * as React from 'react';
import type { Metadata } from 'next';
import {
  ScoreBar,
  PreCalibrationChip,
  CoverageChip,
  CompositeScoreDisplay,
  PillarMiniBars,
  PillarRadar,
  ProvenanceTrigger,
  ProvenanceHighlight,
  PolicyTimeline,
  EmptyState,
  DirectionArrow,
  SectionHeader,
  DataTableNote,
  Sparkline,
  deterministicTrend,
  SpecimenPlate,
  SectionPlate,
  MarginNote,
  SplitSpecimen,
  PillarsSpecimen,
  CountryFlag,
  type PolicyTimelineEvent,
} from '@/components/gtmi';
import type { Provenance } from '@/lib/provenance';
import { PreviewWeightSliderHarness } from './weight-slider-harness';

export const metadata: Metadata = {
  title: 'Primitives preview',
  robots: { index: false, follow: false },
};

const PROVENANCE_OK: Provenance = {
  sourceUrl: 'https://immi.homeaffairs.gov.au/visas/skills-in-demand-482',
  geographicLevel: 'national',
  sourceTier: 1,
  scrapedAt: '2026-04-21T10:00:00.000Z',
  contentHash: 'a3f0d6b201fce92a78451c0ee9d22a01',
  sourceSentence:
    'The minimum salary for the Core Skills Stream is AUD 73,150 per year for full-time work.',
  charOffsets: [42, 53],
  extractionModel: 'claude-sonnet-4-6',
  extractionConfidence: 0.92,
  validationModel: 'claude-sonnet-4-6',
  validationConfidence: 0.88,
  crossCheckResult: 'agrees',
  methodologyVersion: '1.0.0',
  valueCurrency: 'AUD',
};

const PROVENANCE_APPROVED: Provenance = {
  ...PROVENANCE_OK,
  reviewer: 'reviewer-uuid-123',
  reviewedAt: '2026-04-22T14:00:00.000Z',
  reviewerNotes: 'Verified against ATO supplementary fee table.',
};

const PROVENANCE_COUNTRY_SUBSTITUTE: Provenance = {
  ...PROVENANCE_OK,
  sourceUrl: 'https://www.education.gov.au/visa-holder-children-public-schools-overview',
  geographicLevel: 'global',
  sourceTier: 1,
  sourceSentence:
    'OECD high-income default: visa-holder dependants automatically eligible for public schooling.',
  charOffsets: [0, 86],
  extractionModel: 'country-substitute-regional',
  extractionConfidence: 1.0,
  validationModel: 'country-substitute-regional',
  validationConfidence: 1.0,
  crossCheckResult: 'not_checked',
  reviewer: 'auto',
  reviewedAt: '2026-04-27T00:00:00.000Z',
  reviewerNotes: 'Regional default applied; Phase 3.5 ADR-014.',
};

const PROVENANCE_INCOMPLETE = {
  // Deliberately missing contentHash, charOffsets, validationModel.
  sourceUrl: PROVENANCE_OK.sourceUrl,
  geographicLevel: PROVENANCE_OK.geographicLevel,
  sourceTier: PROVENANCE_OK.sourceTier,
  scrapedAt: PROVENANCE_OK.scrapedAt,
  sourceSentence: PROVENANCE_OK.sourceSentence,
  extractionModel: PROVENANCE_OK.extractionModel,
  extractionConfidence: PROVENANCE_OK.extractionConfidence,
  validationConfidence: PROVENANCE_OK.validationConfidence,
  crossCheckResult: PROVENANCE_OK.crossCheckResult,
  methodologyVersion: PROVENANCE_OK.methodologyVersion,
};

const POLICY_EVENTS_MOCK: PolicyTimelineEvent[] = [
  {
    id: 'evt-1',
    detectedAt: '2026-04-15T00:00:00.000Z',
    severity: 'material',
    fieldKey: 'A.1.1',
    fieldLabel: 'Minimum salary threshold',
    summary:
      'Department of Home Affairs raised the Core Skills Stream salary floor from AUD 70,000 to AUD 73,150.',
    paqDelta: -1.84,
  },
  {
    id: 'evt-2',
    detectedAt: '2026-03-02T00:00:00.000Z',
    severity: 'minor',
    fieldKey: 'B.1.1',
    fieldLabel: 'Published SLA processing time',
    summary: 'Processing-time guidance moved from 90 to 84 days median.',
    paqDelta: 0.42,
  },
];

const PILLAR_SCORES_AUS = { A: 18, B: 12, C: 16, D: 10, E: 14 };
const PILLAR_SCORES_SGP = { A: 24, B: 19, C: 17, D: 13, E: 16 };

export default function PrimitivesPreviewPage() {
  return (
    <div className="bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-page-wide items-center justify-between px-6">
          <p className="serif text-data-lg">GTMI primitives — internal preview</p>
          <span className="eyebrow">Phase 4-A · redesign</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-page-wide flex-col gap-12 px-6 py-10">
        <SectionHeader
          eyebrow="Phase 4-A"
          title="Component gallery"
          dek="Every primitive in components/gtmi rendered in its supported states. Editorial token system, light-only (dark mode dropped per Q2). This route is robots-disallowed and not linked from the public site."
        />

        <Block title="Typography">
          <div className="flex flex-col gap-3">
            <p
              className="serif"
              style={{ fontSize: 72, fontWeight: 400, lineHeight: 1.02, margin: 0 }}
            >
              Display 72px — Fraunces serif
            </p>
            <p className="serif" style={{ fontSize: 44, fontWeight: 400, margin: 0 }}>
              H1 44px — editorial headline
            </p>
            <p className="serif" style={{ fontSize: 28, fontWeight: 400, margin: 0 }}>
              H2 28px — section title
            </p>
            <p className="serif" style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
              H3 20px — block title
            </p>
            <p className="text-dek text-ink-3">
              Dek paragraph — Inter Tight, longer-form copy below display headlines.
            </p>
            <p className="text-body">Body — 16px Inter Tight, line-height 1.6.</p>
            <p className="num text-data-md">
              Data — 14px JetBrains Mono with tabular numerals: 73,150 / 22.53 / 16.36
            </p>
            <p className="eyebrow">Eyebrow — uppercase, tracked, 11px ink-3.</p>
          </div>
        </Block>

        <Block title="Editorial atoms — class rules from globals.css">
          <div className="flex flex-wrap gap-3">
            <span className="chip">default chip</span>
            <span className="chip chip-amber">amber</span>
            <span className="chip chip-accent">accent</span>
            <span className="chip chip-mute">mute</span>
            <span className="chip chip-ink">ink</span>
            <span className="chip chip-navy">navy</span>
            <span className="chip chip-navy-soft">navy-soft</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn">Primary button</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn-link">Link button</button>
          </div>
          <hr className="rule mt-6" />
          <hr className="rule-thick mt-3" />
          <hr className="rule-soft mt-3" />
          <hr className="rule-double mt-3" />
        </Block>

        <Block title="Pillar palette — design's warm-cool spectrum">
          <div className="grid grid-cols-5 gap-2">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((p) => (
              <div key={p} className="border border-rule bg-paper-2 p-3">
                <div
                  className="serif"
                  style={{
                    fontSize: 40,
                    color: `var(--pillar-${p.toLowerCase()})`,
                    lineHeight: 1,
                  }}
                >
                  {p}
                </div>
                <div className="num mt-2 text-data-sm text-ink-4">pillar-{p.toLowerCase()}</div>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Sequential color scale — ScoreBar">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ScoreBar value={9.4} />
            <ScoreBar value={28.2} />
            <ScoreBar value={48.7} />
            <ScoreBar value={66.1} />
            <ScoreBar value={89.3} />
            <ScoreBar value={null} />
          </div>
        </Block>

        <Block title="ScoreBar — phase2Placeholder + sizes">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-data-sm text-ink-4">phase2Placeholder = true</p>
              <ScoreBar value={16.36} phase2Placeholder />
            </div>
            <div>
              <p className="mb-1 text-data-sm text-ink-4">phase2Placeholder = false</p>
              <ScoreBar value={16.36} />
            </div>
            <div>
              <p className="mb-1 text-data-sm text-ink-4">unscored — flag ignored</p>
              <ScoreBar value={null} phase2Placeholder />
            </div>
            <ScoreBar value={64.2} width="sm" />
            <ScoreBar value={64.2} width="md" />
            <ScoreBar value={64.2} width="lg" />
          </div>
        </Block>

        <Block title="CompositeScoreDisplay">
          <div className="grid gap-10 md:grid-cols-2">
            <CompositeScoreDisplay
              composite={16.36}
              cme={22.53}
              paq={13.72}
              phase2Placeholder
              rank={1}
              scoredCount={2}
            />
            <CompositeScoreDisplay
              composite={null}
              cme={null}
              paq={null}
              rank={null}
              scoredCount={null}
            />
          </div>
        </Block>

        <Block title="PreCalibrationChip / CoverageChip">
          <div className="flex flex-wrap items-center gap-4">
            <PreCalibrationChip />
            <PreCalibrationChip size="md" />
            <CoverageChip populated={30} total={48} />
            <CoverageChip populated={34} total={48} />
            <CoverageChip populated={6} total={48} />
            <CoverageChip populated={0} total={48} />
            <CoverageChip populated={30} total={48} format="fraction" />
            <CoverageChip populated={6} total={48} format="fraction" />
          </div>
        </Block>

        <Block title="PillarMiniBars">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="mb-2 text-data-sm text-ink-4">AUS Skills in Demand 482 — Core</p>
              <PillarMiniBars scores={PILLAR_SCORES_AUS} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-ink-4">SGP S Pass</p>
              <PillarMiniBars scores={PILLAR_SCORES_SGP} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-ink-4">Unscored</p>
              <PillarMiniBars scores={null} />
            </div>
          </div>
        </Block>

        <Block title="Sparkline — deterministic trend (Q7 placeholder)">
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="mb-2 text-data-sm text-ink-4">Trend up · composite 78.4</p>
              <Sparkline values={deterministicTrend('CHE-L', 78.4)} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-ink-4">Trend down · composite 19.92</p>
              <Sparkline values={deterministicTrend('SGP-S', 19.92)} highlight="var(--accent)" />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-ink-4">Wider</p>
              <Sparkline values={deterministicTrend('AUS-CORE', 16.36)} width={120} height={28} />
            </div>
          </div>
        </Block>

        <Block title="CountryFlag — vendored SVG + ISO box fallback">
          <div className="flex flex-wrap items-center gap-4">
            <CountryFlag iso="AUS" countryName="Australia" size="sm" />
            <CountryFlag iso="AUS" countryName="Australia" size="md" />
            <CountryFlag iso="AUS" countryName="Australia" size="lg" />
            <CountryFlag iso="ZZZ" countryName="Unknown — falls back to ISO box" />
            <CountryFlag iso="XXX" />
          </div>
        </Block>

        <Block title="PillarRadar — overlay states">
          <div className="grid gap-8 md:grid-cols-2">
            <PillarRadar
              programLabel="AUS Core"
              program={PILLAR_SCORES_AUS}
              cohortMedian={{ A: 21, B: 15.5, C: 16.5, D: 11.5, E: 15 }}
              compareTo={{ label: 'SGP S Pass', scores: PILLAR_SCORES_SGP }}
              smallCohortNote
            />
            <PillarRadar programLabel="SGP S Pass" program={PILLAR_SCORES_SGP} />
          </div>
        </Block>

        <Block title="SplitSpecimen — composite 30/70 donut">
          <div className="flex justify-start gap-16 pl-12 pt-6">
            <SplitSpecimen />
          </div>
        </Block>

        <Block title="PillarsSpecimen — typographic poster (5 pillars)">
          <PillarsSpecimen />
        </Block>

        <Block title="WeightSlider (interactive — proportional rebalance)">
          <PreviewWeightSliderHarness />
        </Block>

        <Block title="ProvenanceTrigger states">
          <div className="flex flex-col gap-6">
            <Row label="Pending review (13 core keys)">
              <span className="num text-data-md">AUD 73,150</span>
              <ProvenanceTrigger
                provenance={PROVENANCE_OK}
                status="pending_review"
                valueRaw="AUD 73,150"
              />
            </Row>
            <Row label="Approved (13 + 3 review keys)">
              <span className="num text-data-md">AUD 73,150</span>
              <ProvenanceTrigger
                provenance={PROVENANCE_APPROVED}
                status="approved"
                valueRaw="AUD 73,150"
              />
            </Row>
            <Row label="Incomplete (missing contentHash, charOffsets, validationModel)">
              <ProvenanceTrigger
                provenance={PROVENANCE_INCOMPLETE}
                status="pending_review"
                valueRaw="AUD 73,150"
              />
            </Row>
            <Row label="Approved row missing reviewer keys (incomplete)">
              <ProvenanceTrigger
                provenance={PROVENANCE_OK}
                status="approved"
                valueRaw="AUD 73,150"
              />
            </Row>
            <Row label="Null provenance">
              <ProvenanceTrigger provenance={null} status="approved" />
            </Row>
            <Row label="Country-substitute (Phase 3.5 / ADR-014; C.3.2 OECD default)">
              <span className="num text-data-md">automatic</span>
              <ProvenanceTrigger
                provenance={PROVENANCE_COUNTRY_SUBSTITUTE}
                status="approved"
                valueRaw="automatic"
              />
            </Row>
          </div>
        </Block>

        <Block title="ProvenanceHighlight (charOffsets substring)">
          <ProvenanceHighlight
            sentence={PROVENANCE_OK.sourceSentence}
            charOffsets={PROVENANCE_OK.charOffsets}
          />
          <ProvenanceHighlight
            sentence="Out-of-bounds offsets — full sentence renders unhighlighted."
            charOffsets={[200, 300]}
          />
        </Block>

        <Block title="PolicyTimeline">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-data-sm text-ink-4">With mocked events</p>
              <PolicyTimeline events={POLICY_EVENTS_MOCK} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-ink-4">Phase 4 reality (empty)</p>
              <PolicyTimeline events={[]} />
            </div>
          </div>
        </Block>

        <Block title="EmptyState">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              title="Awaiting Phase 5 calibration"
              body="This program is seeded but has no field values or scores yet."
              ctaHref="/methodology"
              ctaLabel="See methodology"
            />
            <EmptyState
              title="Summary forthcoming"
              body="The editorial 'What this means' panel is being drafted."
            />
          </div>
        </Block>

        <Block title="DirectionArrow">
          <div className="flex items-center gap-6">
            <span className="num inline-flex items-center gap-1 text-data-md">
              Score 78 <DirectionArrow direction="higher_is_better" />
            </span>
            <span className="num inline-flex items-center gap-1 text-data-md">
              Days 90 <DirectionArrow direction="lower_is_better" />
            </span>
          </div>
        </Block>

        <Block title="DataTableNote">
          <DataTableNote>
            Composite = 30% CME + 70% PAQ. CME comes from IMD&rsquo;s Appeal factor re-normalized
            across the 30-country cohort. PAQ is GTMI&rsquo;s 48-indicator program-architecture
            score across five pillars: Access, Process, Rights, Pathway, Stability.
          </DataTableNote>
        </Block>

        <Block title="MarginNote — italic Fraunces gutter annotation">
          <div className="grid gap-6 md:grid-cols-2">
            <MarginNote>
              Peer-review note: cohort median assumes n≥5; today n=2, so the dashed overlay is a
              hint not an authority.
            </MarginNote>
            <MarginNote color="var(--accent)">
              Score change: A.03 raw value moved from 4-week to 14-day window on 2026-03-29; impact
              flagged on the changes timeline.
            </MarginNote>
          </div>
        </Block>
      </main>

      <SpecimenPlate
        plateNo="I"
        title="Specimen plate — full-bleed editorial divider"
        caption="Used between major regions on the landing page. Two-column grid: left holds the plate-number eyebrow + serif title + italic caption; right holds an artefact passed via children."
        tone="paper-3"
      >
        <PillarsSpecimen />
      </SpecimenPlate>

      <SectionPlate
        numeral="II"
        title="Section plate — chapter-style title"
        standfirst="Drops a large oxblood numeral in the gutter alongside a 56px Fraunces headline. This one is text-only; SpecimenPlate is the artefact-bearing sibling."
        tone="ink"
      />

      <SectionPlate
        numeral="III"
        title="Tone variant — paper-3"
        standfirst="The same plate on a warm paper surface, kept in the gallery so all three tones (ink, navy, paper-3) are visible together."
        tone="paper-3"
      />

      <SectionPlate
        numeral="IV"
        title="Tone variant — navy"
        standfirst="Used sparingly for peer-review / methodology framing."
        tone="navy"
      />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border border-rule bg-paper-2 p-6">
      <h3 className="serif text-data-lg text-ink" style={{ fontWeight: 500 }}>
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border border-dashed border-rule bg-paper px-4 py-3">
      <p className="text-data-sm text-ink-4">{label}</p>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}
