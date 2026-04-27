import * as React from 'react';
import type { Metadata } from 'next';
import {
  ScoreBar,
  PreCalibrationChip,
  CoverageChip,
  CompositeScoreDisplay,
  PillarMiniBars,
  PillarRadar,
  MethodologyBar,
  ProvenanceTrigger,
  ProvenanceHighlight,
  PolicyTimeline,
  EmptyState,
  DirectionArrow,
  SectionHeader,
  DataTableNote,
  type PolicyTimelineEvent,
} from '@/components/gtmi';
import { ThemeToggle } from '@/components/theme-toggle';
import { DEFAULT_PILLAR_WEIGHTS } from '@/lib/advisor-mode';
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
      <header className="sticky top-0 z-30 border-b border-border bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-page-wide items-center justify-between px-6">
          <p className="font-serif text-data-lg">GTMI primitives — internal preview</p>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-page-wide flex-col gap-12 px-6 py-10">
        <SectionHeader
          eyebrow="Phase 4.1"
          title="Component gallery"
          dek="Every primitive in components/gtmi rendered in its supported states. This route is robots-disallowed and not linked from the public site."
        />

        <Block title="Typography">
          <div className="flex flex-col gap-2">
            <p className="font-serif text-display-xl">Display XL — serif</p>
            <p className="font-serif text-display-lg">Display LG — serif</p>
            <p className="font-serif text-display-md">Display MD — serif</p>
            <p className="text-dek">
              Dek paragraph — Inter, used for the longer-form copy below display headlines on
              landing pages and section openers.
            </p>
            <p className="text-body">Body — 16px Inter, line-height 1.6.</p>
            <p className="font-mono text-data-md tnum">
              Data — 14px JetBrains Mono with tabular numerals: 73,150 / 22.53 / 16.36
            </p>
          </div>
        </Block>

        <Block title="Sequential color scale">
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
              <p className="mb-1 text-data-sm text-muted-foreground">phase2Placeholder = true</p>
              <ScoreBar value={16.36} phase2Placeholder />
            </div>
            <div>
              <p className="mb-1 text-data-sm text-muted-foreground">phase2Placeholder = false</p>
              <ScoreBar value={16.36} />
            </div>
            <div>
              <p className="mb-1 text-data-sm text-muted-foreground">unscored — flag ignored</p>
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
          </div>
        </Block>

        <Block title="PillarMiniBars">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="mb-2 text-data-sm text-muted-foreground">
                AUS Skills in Demand 482 — Core
              </p>
              <PillarMiniBars scores={PILLAR_SCORES_AUS} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-muted-foreground">SGP S Pass</p>
              <PillarMiniBars scores={PILLAR_SCORES_SGP} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-muted-foreground">Unscored</p>
              <PillarMiniBars scores={null} />
            </div>
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

        <Block title="MethodologyBar">
          <MethodologyBar
            cmePaqSplit={{ cme: 0.3, paq: 0.7 }}
            pillarWeights={DEFAULT_PILLAR_WEIGHTS}
          />
        </Block>

        <Block title="WeightSlider (interactive — proportional rebalance)">
          <PreviewWeightSliderHarness />
        </Block>

        <Block title="ProvenanceTrigger states">
          <div className="flex flex-col gap-6">
            <Row label="Pending review (13 core keys)">
              <span className="font-mono text-data-md">AUD 73,150</span>
              <ProvenanceTrigger
                provenance={PROVENANCE_OK}
                status="pending_review"
                valueRaw="AUD 73,150"
              />
            </Row>
            <Row label="Approved (13 + 3 review keys)">
              <span className="font-mono text-data-md">AUD 73,150</span>
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
              <p className="mb-2 text-data-sm text-muted-foreground">With mocked events</p>
              <PolicyTimeline events={POLICY_EVENTS_MOCK} />
            </div>
            <div>
              <p className="mb-2 text-data-sm text-muted-foreground">Phase 4 reality (empty)</p>
              <PolicyTimeline events={[]} />
            </div>
          </div>
        </Block>

        <Block title="EmptyState">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              title="Awaiting Phase 3 scoring"
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
            <span className="inline-flex items-center gap-1 font-mono text-data-md">
              Score 78 <DirectionArrow direction="higher_is_better" />
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-data-md">
              Days 90 <DirectionArrow direction="lower_is_better" />
            </span>
          </div>
        </Block>

        <Block title="DataTableNote">
          <DataTableNote>
            Composite = 30% CME + 70% PAQ. CME comes from IMD&rsquo;s Appeal factor re-normalized
            across our 30-country cohort. PAQ is GTMI&rsquo;s 48-indicator program-architecture
            score.
          </DataTableNote>
        </Block>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h3 className="font-serif text-data-lg text-ink">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-border bg-paper px-4 py-3">
      <p className="text-data-sm text-muted-foreground">{label}</p>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}
