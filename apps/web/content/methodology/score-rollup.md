A composite score is a weighted arithmetic mean computed in five steps,
each on the same 0–100 scale. The hierarchy is bottom-up:

1. **Indicator score (0–100).** A raw value (a salary in USD, a number
   of days, a category label) is normalised onto 0–100 using the
   indicator&rsquo;s normalisation function — min-max, z-score, or a
   categorical rubric — fixed in the methodology version.
2. **Sub-factor score (0–100).** Weighted mean of the sub-factor&rsquo;s
   indicator scores, using the indicator weights from the methodology.
   Missing indicators are excluded and the remaining weights renormalise
   across the present indicators, with a square-root coverage penalty
   applied so high coverage outscores low coverage at the same nominal
   value.
3. **Pillar score (0–100).** Weighted mean of the pillar&rsquo;s
   sub-factor scores.
4. **PAQ score (0–100).** Weighted mean of the five pillar scores using
   the published pillar weights (28 / 15 / 20 / 22 / 15).
5. **Composite score (0–100).** 0.30 × CME + 0.70 × PAQ.

Aggregation is weighted arithmetic mean throughout, which means strong
pillars can compensate for weak ones. This compensability is by design,
disclosed, and tested in the sensitivity run that swaps in a geometric
mean to confirm the top-ten ranking is robust.
