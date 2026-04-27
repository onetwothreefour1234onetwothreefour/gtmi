Indicator values arrive as heterogeneous raw data — salaries, day counts,
categorical labels, booleans, percentages — and must be projected onto a
shared 0–100 scale so they can be combined across pillars. GTMI uses three
deterministic schemes; the choice per indicator is documented in
`field_definitions.normalization_fn`.

### Min-max (bounded continuous numerics)

```
indicator_score = 100 × (x − x_min) / (x_max − x_min)
```

Inverted for &ldquo;lower is better&rdquo; indicators. `x_min` and `x_max` are
across all 85 programs in the scoring set. Phase 2 uses engineer-chosen
ranges; Phase 3 calibration replaces them with cohort percentiles once five
or more programs are scored — at which point the `phase2Placeholder` flag
clears.

Worked example. Indicator B.1.1 (Published SLA processing time, days). On a
cohort with `x_min = 14` and `x_max = 365`, an inverted min-max score for a
program with a 90-day SLA is `100 × (365 − 90) / (365 − 14) ≈ 78.4`.

### Z-score standardisation (skewed distributions)

```
z = (x − μ) / σ
indicator_score = 100 × Φ(z)
```

Used where min-max would distort because of outliers. The choice between
min-max and z-score per indicator is determined statistically using a
Shapiro-Wilk normality test on the cohort distribution.

### Categorical and ordinal scoring

A published ordinal rubric per categorical indicator. The LLM extracts the
value verbatim; the scoring engine deterministically maps it to the rubric
score. Booleans are 0 or 100 with the direction specified per indicator.

Missing data is never imputed. An absent indicator is excluded from its
sub-factor calculation and a square-root penalty applies at the sub-factor
level — programmes below 70% data coverage on any pillar are flagged
&ldquo;insufficient disclosure&rdquo; and withheld from the public ranking.
