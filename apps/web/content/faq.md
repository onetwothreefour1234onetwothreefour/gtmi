## What does the composite score mean?

A 0–100 ranking of the programme on its overall fitness as a talent
mobility instrument. 30% of the score reflects how attractive the host
country is in the IMD World Talent Ranking Appeal sub-index; 70%
reflects how well the visa programme itself is designed across product
design, process design, benefits, pathway, and performance outcomes.
A score of 80 is a top-decile programme; 50 is the cohort midpoint;
below 30 the programme has serious architectural problems, missing
data, or both.

## Why 30 / 70 between country and programme?

Because the user&rsquo;s real question is &ldquo;which visa do I
pursue?&rdquo; and that is answered by programme architecture, not
country reputation. A pure country score (50/50, or worse) would
collapse into the IMD ranking and add no value; a pure programme score
would let an over-engineered visa in a low-appeal country outrank a
well-designed visa in a top-appeal one, which would not be credible.
30 / 70 is high enough to be decisive when programmes are otherwise
close, low enough to let a well-designed programme in a mid-tier
country still outrank a poorly designed one in a top-tier country. The
split is tested in the sensitivity analysis under 20/80 through 50/50
alternatives.

## What does the &ldquo;Pre-calibration&rdquo; chip mean?

The min-max normalisation needs `x_min` and `x_max` per indicator.
Until the cohort is large enough to set those bounds from real
percentiles, they are engineer estimates. Scores produced under
engineer estimates carry a &ldquo;Pre-calibration&rdquo; chip. The
relative methodology application is correct &mdash; the score reflects
the methodology &mdash; but the absolute number will move when
calibration replaces the estimates with cohort percentiles. The change
is recorded explicitly in the changes log.

## Why is some data missing on a programme?

Some governments do not publish the underlying data, in which case the
indicator stays null. Coverage chips show how much of the
33-indicator framework is populated for a given programme. We never
impute or guess. Programmes below 70% coverage on any pillar are
withheld from the public ranking entirely.

## Why aren&rsquo;t taxes part of the methodology?

They were, in earlier versions. In methodology v5.0.0 we retired the
tax sub-factor: tax treatment is too jurisdiction-specific and too
volatile (regime overhauls, treaty changes) to be measured comparably
without expert local advice. For host-country tax treatment, candidates
should consult the country&rsquo;s tax authority directly. The pillar
that previously covered tax (Pillar D, Pathway) now measures only PR
and citizenship pathways.

## How often does the data refresh?

Tier&nbsp;1 government sources are re-scraped weekly. Detected revisions
appear on the [changes log](/changes) within 24 hours, classified
minor / material / breaking. The CME baseline is re-anchored annually,
within 30 days of each new IMD World Talent Ranking release.

## Can I use these scores in published research?

Yes &mdash; cite as `Global Talent Mobility Index (GTMI) v[version],
TTR Group, retrieved [date]. https://gtmi.example/`. The methodology
version stamp is on every score; running the scoring engine against
the same `methodology_version_id` and the same source values reproduces
the score byte-identically. The methodology, weights, and indicator
definitions are published openly. Field-value data is licensed for
non-commercial research use; commercial licensing is available from
TTR Group.
