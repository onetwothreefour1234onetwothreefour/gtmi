'use client';

import * as React from 'react';
import { WeightSlider } from '@/components/gtmi';
import { DEFAULT_PILLAR_WEIGHTS, type PillarWeights } from '@/lib/advisor-mode';

/**
 * Tiny client harness so the (server) preview page can render an interactive
 * <WeightSlider> without becoming a client component itself.
 */
export function PreviewWeightSliderHarness() {
  const [weights, setWeights] = React.useState<PillarWeights>(DEFAULT_PILLAR_WEIGHTS);
  return <WeightSlider weights={weights} onChange={setWeights} />;
}
