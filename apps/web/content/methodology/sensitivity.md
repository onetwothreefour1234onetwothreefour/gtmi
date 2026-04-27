Six analyses are published with every release. Phase&nbsp;3 produces the
first run; the `sensitivity_runs` table is empty in this preview and the
section below describes what each analysis tests so the reader knows what
is coming and what it means.

1. **Weight sensitivity (Monte Carlo).** 1,000 random weight vectors drawn
   from a Dirichlet distribution with ±20% perturbation around the
   methodology defaults. Reports each programme&rsquo;s median rank, the
   5th–95th-percentile band, and Spearman&nbsp;ρ versus the baseline
   ranking. A programme whose rank is stable across the band has a robust
   relative position; one that moves more than ±5 ranks is flagged for
   methodology review.

2. **Normalisation sensitivity.** Compares the published min-max + z-score
   mix against pure min-max, pure z-score, and a distance-to-frontier
   alternative. Reports Spearman&nbsp;ρ versus the baseline.

3. **Aggregation sensitivity.** Compares weighted arithmetic mean (the
   published rule) against geometric mean at the pillar level. Tests
   whether allowing or disallowing compensability between pillars changes
   the top-10.

4. **CME / PAQ split sensitivity.** Re-scores the cohort under 20/80,
   25/75, 35/65, 40/60, and 50/50 splits. Documents the top-10 shift —
   the published 30/70 split holds the top-10 stable to within two ranks
   under the 50/50 extreme.

5. **Indicator dropout test.** Drops one indicator at a time and re-scores.
   Flags any programme whose rank moves more than five positions on any
   single drop, which signals that the rank depends too heavily on a
   single number.

6. **Correlation and redundancy.** Pearson matrix across all 48 indicators.
   Within-sub-factor correlations above ρ&nbsp;=&nbsp;0.8 trigger a review:
   if two indicators are saying the same thing, one of them is redundant
   weight.

All results land in the `sensitivity_runs` table tagged with the
`methodology_version_id` of the run, so historical sensitivity reports
remain reproducible against the methodology version that generated them.
