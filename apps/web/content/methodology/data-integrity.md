### Three source tiers

**Tier&nbsp;1.** Official government sources at any geographic level — global,
continental, national, regional. Immigration authority, statistics bureau,
official gazette, ministry pages. Every Pillar A–E indicator is populated
exclusively from Tier&nbsp;1 under methodology v6.0.0 (the Pillar E
external-index path through World Bank WGI and V-Dem was retired in
ADR-032).

**Tier&nbsp;2.** Law-firm, immigration-consultant, and policy-tracker
commentary (Fragomen, KPMG, Baker McKenzie, Migration Policy Institute,
OECD Migration Outlook, IMD World Talent Ranking). Used for cross-check
on auto-approve candidates and as supplementary recall hints for E.2.1
(severity-weighted policy-change counts). Never populates a published
scoring value on its own.

**Tier&nbsp;3.** News and policy-monitoring sources (IMI Daily, Henley
newsroom, Expatica, general news). Used for early-warning policy-change
signals. Never populates a scoring value.

### Seven-stage verification

Every approved field value moves through a deterministic pipeline:

0. **Discover.** Perplexity API (`sonar` model) finds up to ten URLs per
   programme via live web search, classified by tier and geographic level.
1. **Scrape.** Custom Python/Playwright service renders the page and
   records a SHA-256 content hash.
2. **Extract.** Claude pulls the value, the exact source sentence,
   character offsets, and a self-assessed confidence score. A single
   batch call extracts all active fields per scrape.
3. **Derive (where applicable).** Twelve indicators are computed
   deterministically from extracted inputs and country lookup tables —
   no LLM is invoked. Every derived value is below the auto-approve
   threshold by construction and routes to human review.
4. **Validate.** A separate Claude call verifies the extracted value
   reflects the source sentence with an independent confidence score.
5. **Cross-check.** For values that would otherwise auto-approve, a
   single Tier&nbsp;2 source is checked. Disagreements veto auto-approval
   and route the row to human review with the disagreement recorded.
6. **Human review.** Values below 0.85 confidence on extraction or
   validation, cross-check disagreements, and any PAQ delta above five
   points enter the review queue. Approved values land in `field_values`
   with the full provenance chain.

### Provenance chain

Every published value carries: source URL, geographic level, source tier,
scrape timestamp, content hash, exact source sentence, character offsets,
extraction model, extraction confidence, validation model, validation
confidence, cross-check result, reviewer, review timestamp, methodology
version. Monetary fields additionally carry the original ISO&nbsp;4217
currency code in `provenance.valueCurrency` so the numeric normalised
value can be FX-converted at scoring time without losing the source unit.

### Currency preservation

Raw extracted strings like `AUD&nbsp;73,150` have the currency prefix
stripped before numeric normalisation. The ISO&nbsp;4217 code is preserved
in the provenance JSONB so it can be displayed beside the raw value and
used for FX conversion in scoring. The currency utility recognises 19 ISO
codes and the common symbols.

### Missing data and edge cases

Missing indicators are never imputed. The sub-factor weight redistributes
across the present indicators and a square-root penalty applies. The
&ldquo;Insufficient disclosure&rdquo; flag fires at any pillar with under
70% coverage; flagged programmes are withheld from the public ranking.
