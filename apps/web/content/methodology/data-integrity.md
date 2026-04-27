### Three source tiers

**Tier&nbsp;1.** Official government sources at any geographic level — global,
continental, national, regional. Immigration authority, tax authority,
ministry of finance, official gazette, statistics bureau. All Pillar A–D
indicators and Pillar&nbsp;E sub-factors E.1 and E.2 are populated exclusively
from Tier&nbsp;1.

**Tier&nbsp;2.** Law-firm and immigration-consultant commentary (Fragomen,
KPMG, Envoy, Baker McKenzie, equivalents). Used for cross-check and program
narrative context. Never populates a published value on its own.

**Tier&nbsp;3.** News and policy-monitoring sources (IMI Daily, Henley
newsroom, Expatica, Nomad Gate, general news). Used for Phase&nbsp;5
early-warning policy-change signals. Never populates a scoring value.

### Five-stage verification

Every approved field value goes through a deterministic pipeline:

1. **Discover.** Perplexity API (`sonar` model) finds up to 10 URLs per
   programme via live web search, classified by tier and geographic level.
2. **Scrape.** Custom Python/Playwright service renders the page and records
   a SHA-256 content hash.
3. **Extract.** Claude pulls the value, the exact source sentence, character
   offsets, and a self-assessed confidence score.
4. **Validate.** A separate Claude call verifies the extracted value reflects
   the source sentence — independent confidence score.
5. **Cross-check.** Tier&nbsp;2 source comparison; disagreements queued for
   human review.
6. **Human review.** Values below 0.85 confidence on either stage,
   cross-check disagreements, or PAQ deltas above 5 points enter the review
   queue. Approved values land in `field_values` with the full provenance
   chain.

### Provenance chain

Every published value carries: source URL, geographic level, source tier,
scrape timestamp, content hash, exact source sentence, character offsets,
extraction model, extraction confidence, validation model, validation
confidence, cross-check result, reviewer, review timestamp, methodology
version. Monetary fields additionally carry the original ISO&nbsp;4217
currency code in `provenance.valueCurrency` so the numeric normalised value
can be FX-converted at scoring time without losing the source unit.

### Currency preservation

Raw extracted strings like `AUD&nbsp;73,150` have the currency prefix
stripped before numeric normalisation. The ISO&nbsp;4217 code is preserved
in the provenance JSONB so it can be displayed beside the raw value and used
for FX conversion in scoring. The currency utility recognises 19 ISO codes
and the common symbols.

### Missing data and edge cases

Missing indicators are never imputed. The sub-factor weight redistributes
across the present indicators and a square-root penalty applies. The
&ldquo;Insufficient disclosure&rdquo; flag fires at any pillar with under
70% coverage. The Stability edge case (E.1.1) substitutes the within-country
cohort mean for programmes younger than three years; the substitution is
recorded in provenance.
