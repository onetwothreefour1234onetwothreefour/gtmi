# ADR-013 — Tier 2 backfill for an allowlisted set of indicators

**Status:** Proposed (Phase 3.4)
**Date:** 2026-04-27
**Authors:** Szabi (drafted via Phase 3.4); awaiting Ayush co-sign.

## Context

The GTMI methodology has, since v1, restricted Pillars A–D and E.1/E.2 to
**Tier 1 government sources**. Tier 2 (immigration law and corporate-
advisory firms — Fragomen, KPMG Global Mobility, EY, Baker McKenzie,
Envoy) is reserved for cross-check and program-narrative context. This was
a deliberate credibility decision, not an oversight.

The Phase 3 baseline gap register (`docs/phase-3/baseline-gaps.csv`)
surfaces a recurring pattern that the Tier-1-only rule alone cannot
close:

- A small set of indicators is **structurally absent** from the
  immigration authority's pages because the relevant rule lives in a
  different legal instrument or different department's mandate. These
  fields show up as `ABSENT` in the gap register (keyword not found in
  any cached scrape) — not because the page is thin, and not because
  Stage 0 missed an obvious sibling page, but because the data is not
  routinely published on the same authority's site.
- For exactly these indicators, Tier 2 advisories (Fragomen jurisdiction
  guides, KPMG Global Mobility country reports, EY Worldwide Personal
  Tax & Immigration Guides) consistently cover the gap with explicit,
  jurisdiction-specific answers — because their entire commercial
  product is to compile the cross-departmental answer for corporate
  clients.

Phase 3.2 (department-aware discovery v2) and Phase 3.3 (prompt sweep)
take Tier-1-only coverage as far as it can defensibly go without
compromising the source-tier discipline. Pillar D.3 (tax) is largely
closed by routing discovery to the tax authority. C.3.x (public services)
is closed by routing to the health and education authorities. The
indicators below remain the residual gap.

## Decision

### Allowlist scope

Permit Tier 2 sources to populate `field_values` for **the following
indicators only**, as a backfill of last resort after Tier 1 fails:

| Field | Indicator                          | Why Tier 1 is structurally silent                                                                                                           |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| B.3.3 | Appeal and refusal process clarity | Appeal procedures live in tribunal/court rules, not on the visa-listing page. Some jurisdictions publish them sparingly.                    |
| C.2.4 | Same-sex partner recognition       | Family-status definitions live in citizenship/family law and are rarely restated on each visa page. AUS is silent on the 482 listing today. |
| D.2.3 | Dual citizenship permitted         | Dual-citizenship rules sit in citizenship law and are not republished on the immigration page. AUS, SGP both silent today.                  |

**Allowlist size: 3 indicators. All three are outside the scoring
core — none are in Pillars A.1, A.2, A.3, B.1, B.2, D.1, D.2.1, D.2.2,
D.3, or any of E. Pillar weights are unchanged.**

### Excluded from the allowlist (cross-check note)

The Phase 3.4 plan originally proposed including **C.2.3 (parent /
extended family inclusion)** alongside the three above. The Phase 3
gap register cross-check confirmed C.2.3 is **POPULATED in all three
canary programmes (AUS / SGP / CAN)** — there is no coverage gap to fill,
so C.2.3 is not on the allowlist. If C.2.3 turns out to be ABSENT for a
new country joining the cohort, this ADR can be re-opened.

### What stays Tier-1-only (no change)

- Pillar A — Access (all 9 indicators).
- Pillar B.1 — Time to decision; B.2 — Direct cost (all of B.1, B.2).
- Pillar D.1 — PR pathway (all 4 indicators); D.2.1 (PR provision);
  D.2.2 (years to citizenship); D.3 (all tax indicators).
- Pillar E.2 — Transparency (all 3 indicators).
- Pillar E.3 — Institutional quality (covered by V-Dem and World Bank
  WGI direct-API integrations; not Tier 2 firms).

### Provenance discipline

Tier 2 backfilled values:

1. **Confidence cap at 0.85.** Tier 2 extractions cannot auto-approve.
   Every Tier 2 row enters `/review` for analyst sign-off.
2. **Visible "Tier 2 source" badge in the dashboard.** The
   `<ProvenanceTrigger>` popover renders a clearly distinguishable
   badge whenever `provenance.sourceTier === 2`, with a one-sentence
   explanation: "This value was sourced from a law firm or advisory
   publication, not a government source directly." Phase 3.4 ships
   this badge with one Vitest test.
3. **Provenance fields unchanged.** `sourceTier=2`, `geographicLevel=
global` (or whatever the Tier 2 source declares), `extractionModel`
   matches the standard pipeline. No new schema, no special-case
   branching at scoring time.
4. **Allowlist enforcement.** Database column
   `field_definitions.tier2_allowed BOOLEAN NOT NULL DEFAULT false`
   (migration 00008) gates which fields can ever accept a Tier 2 row.
   The extraction stage's Tier 2 fallback path (wired in a later
   commit at re-canary time, NOT in this ADR commit) reads this column
   before falling through to Tier 2 sources.

## Consequences

### Positive

- 3 additional fields per programme become reachable. With three
  canary programmes that's up to 9 additional `field_values` rows
  visible to scoring once /review approves them — a 6%-pt improvement
  toward the 42–44/48 ceiling on this lever alone.
- Reader sees the credibility tradeoff explicitly via the badge. We
  don't silently pretend a Fragomen guide is a government source.
- Allowlist is small enough that the next reviewer of methodology v2
  (Phase 3.5 / ADR-014) can sanity-check every entry.

### Negative

- Tier 2 sources can disagree, lag, or be wrong. The 0.85 confidence
  cap and mandatory /review step are the mitigation; if Tier 2 quality
  proves unreliable in Phase 5, this ADR can revoke individual
  allowlist entries.
- Adds a discipline-cost: the discovery prompt (Phase 3.2 v2) already
  surfaces Tier 2 URLs; the extraction stage now needs an explicit
  fallback policy that respects the allowlist. (Implementation
  scheduled separately at re-canary time, not in this commit.)

### Neutral

- No methodology weight change. No `methodology_versions` row added.
  V1 scores remain comparable.

## Remediation if Tier 2 quality proves unreliable

If Phase 5 review surfaces systematic disagreement between Tier 2 and
later-discovered Tier 1 sources for any allowlisted indicator:

1. Set `tier2_allowed = false` on that field via a one-line
   migration / seed update.
2. Re-run discovery for the affected programmes; the existing Tier 1
   pass must now cover or the field stays empty.
3. Existing `field_values` rows with `sourceTier=2` for that field
   stay in the table as historical record; new rows cannot be written.
4. Document the revocation in a follow-up ADR.

## Implementation in this commit (Phase 3.4)

- **Schema (migration 00008_tier2_allowed):**
  `ALTER TABLE field_definitions ADD COLUMN tier2_allowed BOOLEAN NOT NULL DEFAULT false;`
  Default false → no existing field is affected. Migration applied via
  `scripts/apply-migration.ts`.
- **Seed (methodology-v2 indicators map):**
  `tier2_allowed: true` set for B.3.3, C.2.4, D.2.3. All other indicators
  remain `false`.
- **Dashboard:** `<ProvenanceTrigger>` renders the Tier 2 badge plus
  one-sentence explanation when `sourceTier === 2`. Vitest covers the
  positive case (renders) and negative case (does not render for
  Tier 1).

## NOT in this commit

- The extraction-stage fallback that actually invokes Tier 2 backfill
  is **NOT wired here.** This ADR establishes the rule and the schema +
  UI scaffolding. The pipeline change happens at re-canary prep time
  in a separate small commit, so we can review the Tier 2 prompt
  template independently.

---

## Amendment v2 — Phase 3.6 (Migration 00010)

Three additional fields meet the ADR-013 criteria and are added to the
allowlist via `supabase/migrations/00010_self_improving_sources_and_methodology_v2_reconciliation.sql`:

- **B.2.3** — Employer-borne levies & skill charges. Now
  `boolean_with_annotation` per ADR-014; Tier 1 silent on the visa
  page; KPMG / EY publish global levy roundups.
- **B.2.4** — Mandatory non-government costs. Now
  `boolean_with_annotation`; advisory firms publish jurisdiction-
  specific non-gov-cost guides.
- **D.2.4** — Civic / language / integration test burden. Citizenship
  test details live in citizenship authority pages (not the visa
  listing); cross-departmental gap.

C.2.1 (spouse inclusion) was considered for this expansion and
**excluded** per analyst Q2 decision: scoring-core Pillar C carve-out
from the original ADR stands. Re-evaluate only if 5-country pilot data
shows C.2.1 cohort coverage <50%.

---

## Amendment v3 — Phase 3.6.1 (Migration 00011)

Three further fields are added to the allowlist via
`supabase/migrations/00011_tier2_allowed_expansion_2.sql`:

- **C.2.2** — Dependent child age cap and inclusion terms. Tier 1
  immigration authority page often JS-gates or fragments the family-
  member rules across multiple sub-pages; advisory firms publish a
  consolidated answer per jurisdiction.
- **D.1.3** — Physical presence requirement during PR accrual.
  Tier 1 silent on the temporary visa page; PR accrual rules live in
  the PR authority's separate listing, which discovery doesn't always
  reach. Advisory guides reliably cover this.
- **D.1.4** — PR retention rules (days/yr). Same cross-page issue —
  retention rules live with the PR authority, not the visa listing.

D.1.3 and D.1.4 are technically in the scoring core (Pillar D.1).
Including them is a deliberate exception justified by:

1. The 0.85 confidence cap on every Tier 2 row forces /review,
   so analysts approve each row before it influences a public score.
2. The Tier 2 badge in `<ProvenanceTrigger>` (already shipped in
   Amendment v2) surfaces the credibility tradeoff to readers.
3. The alternative is permanent ABSENT status across the cohort
   for these indicators — most countries' PR rules are NOT on the
   original temporary visa page that Stage 0 discovers first.
4. Phase 3.6's self-improving sources registry (ADR-015) plus the
   extended discovery prompt (Phase 3.6.1 / FIX 4) targeting "PR
   pathway authority" should reduce reliance on Tier 2 for these
   indicators over time. Tier 2 is the safety net while Tier 1
   discovery breadth catches up.

Allowlist size after amendment v3: **9 indicators** (B.3.3, C.2.4,
D.2.3 from v1; B.2.3, B.2.4, D.2.4 from v2; C.2.2, D.1.3, D.1.4 from v3).
