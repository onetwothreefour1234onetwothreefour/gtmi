# GTMI Phase 4 Visual Redesign — Plan

**Status:** Draft. Awaiting analyst approval. No implementation has begun. No files in `apps/web/` or `docs/` have been touched.

**Scope:** Replace the Phase 4 visual layer entirely with the editorial design captured in [docs/design/](docs/design/). Keep the existing data layer (`apps/web/lib/queries/*`), routing, scoring, query shapes, and component logic intact. The redesign is a visual + composition rebuild, not a data rebuild.

**Source design assets read for this plan:**

- [docs/design/styles.css](docs/design/styles.css)
- [docs/design/primitives.jsx](docs/design/primitives.jsx)
- [docs/design/screen-rankings.jsx](docs/design/screen-rankings.jsx)
- [docs/design/screen-rankings-v2.jsx](docs/design/screen-rankings-v2.jsx)
- [docs/design/screen-program.jsx](docs/design/screen-program.jsx)
- [docs/design/screen-methodology.jsx](docs/design/screen-methodology.jsx)
- [docs/design/screen-country-changes.jsx](docs/design/screen-country-changes.jsx)
- [docs/design/screen-internal.jsx](docs/design/screen-internal.jsx)
- [docs/design/design-canvas.jsx](docs/design/design-canvas.jsx) — Figma-canvas wrapper, not part of the runtime; ignore for shipping work.

**Existing implementation read:** `apps/web/lib/theme.ts`, `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`, all of `apps/web/components/gtmi/`, every `(public)` route, the `(internal)/review` route, `apps/web/app/preview-gallery/page.tsx`, the full query layer in `apps/web/lib/queries/`, and the four canonical docs.

**Vocabulary alignment:** the design's pillar labels (Architecture / Process / Family / Recourse / Outcomes) DO NOT match the implementation's pillar labels (Access / Process / Rights / Pathway / Stability). The five pillar keys A–E and the methodology weights match; only the human labels differ. **See §7 Open question 1.**

---

## SECTION 1 — Token system reconciliation

### 1.1 What we have today

`apps/web/app/globals.css` defines shadcn-style HSL CSS variables (`--ink`, `--paper`, `--surface`, `--border`, `--accent`, `--muted`, `--popover`, `--card`, `--precalib-fg/bg`, `--ring`, `--destructive`, etc.) and a full `.dark` overrides block.

`apps/web/tailwind.config.ts` resolves those via `hsl(var(--…))` for utility classes, plus literal hex tokens for `pillar.{a..e}` and `score.{1..5}` and a typographic scale (`display-xl`, `display-lg`, `display-md`, `dek`, `body`, `data-lg/md/sm`) and editorial widths (`max-w-page`, `max-w-page-wide`, `max-w-editorial`, `max-w-prose`).

`apps/web/lib/theme.ts` is the JS-side mirror: `PILLAR_COLORS` (literal hex), `SCORE_SCALE`, `scoreColor()`, `scoreBucket()`, `ACCENT_DEEP_TEAL = '#0F4C5C'`, and `PRE_CALIBRATION` (light/dark fg/bg pair).

### 1.2 What the design uses

`docs/design/styles.css` defines a single light-theme flat palette: `--paper`, `--paper-2`, `--paper-3`, `--rule`, `--rule-soft`, `--ink`, `--ink-2..--ink-5`, `--accent` (oxblood `#B8412A`), `--accent-2`, `--accent-soft`, `--navy`, `--navy-2`, `--navy-soft`, `--positive`, `--warning`, `--negative`, `--pillar-a..--pillar-e` (warm-cool low-chroma spectrum, NOT the current cool blue-ish hex set), `--serif: Fraunces`, `--sans: Inter Tight`, `--mono: JetBrains Mono`, plus a 4px-base spacing scale and a fixed type scale (`--fs-display: 72px` … `--fs-micro: 11px`).

### 1.3 Mapping table — Phase 4 token → redesign token

| Current Phase 4 token                                               | Redesign token                                                                                                                                          | Action                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ink` (HSL `240 6% 5%`)                                           | `--ink: #1A1A1A`                                                                                                                                        | Replace value (still solid black-ish, but now hex; drop HSL indirection for the design tokens)                                                                        |
| `--paper` (HSL `50 23% 98%`)                                        | `--paper: #F7F4ED` (warmer cream)                                                                                                                       | Replace value                                                                                                                                                         |
| `--surface` (HSL `0 0% 100%`)                                       | No direct equivalent; design uses `--paper-2`/`--paper-3` for raised cards                                                                              | Re-purpose: keep `--surface` as alias of `--paper-2` (`#F2EEE3`) so existing `bg-surface` utility still works without rewriting every component                       |
| `--border` (HSL `50 11% 89%`)                                       | `--rule: #D9D2BE`                                                                                                                                       | Map; alias `--border` to `--rule`                                                                                                                                     |
| `--input`                                                           | (n/a)                                                                                                                                                   | Alias to `--rule`                                                                                                                                                     |
| `--ring` (deep teal)                                                | `--accent: #B8412A`                                                                                                                                     | Replace; focus ring becomes oxblood per design                                                                                                                        |
| `--accent` (deep teal `#0F4C5C`)                                    | `--accent: #B8412A` (oxblood)                                                                                                                           | Replace value                                                                                                                                                         |
| `--accent-foreground` (white)                                       | `--paper`                                                                                                                                               | Map                                                                                                                                                                   |
| `--muted` (HSL `50 11% 95%`)                                        | `--paper-2: #F2EEE3`                                                                                                                                    | Map; existing `bg-muted/40` "row hover" patterns map to `paper-2`                                                                                                     |
| `--muted-foreground`                                                | `--ink-3: #5C4A2E` (espresso) or `--ink-4: #8A7456` (taupe)                                                                                             | Map; pick `--ink-4` since current `muted-foreground` is body-secondary copy                                                                                           |
| `--foreground`                                                      | `--ink`                                                                                                                                                 | Map                                                                                                                                                                   |
| `--background`                                                      | `--paper`                                                                                                                                               | Map                                                                                                                                                                   |
| `--popover` (white)                                                 | `--paper`                                                                                                                                               | Map                                                                                                                                                                   |
| `--popover-foreground`                                              | `--ink`                                                                                                                                                 | Map                                                                                                                                                                   |
| `--card` (white)                                                    | `--paper-2`                                                                                                                                             | Map                                                                                                                                                                   |
| `--destructive`                                                     | `--negative: #8E2F1E`                                                                                                                                   | Map                                                                                                                                                                   |
| `--precalib-fg` `#A66A00`                                           | `--warning: #B8862A` (amber)                                                                                                                            | Map; pre-cal chip retains its visual identity but in design's amber                                                                                                   |
| `--precalib-bg` `#FFF6E6`                                           | `#FBF3DC` (literal hex from `chip-amber` rule)                                                                                                          | Map                                                                                                                                                                   |
| Tailwind `pillar.a..e` (cool teal-ish hex set)                      | `--pillar-a..--pillar-e` (warm-cool spectrum)                                                                                                           | **Replace** in both `tailwind.config.ts` and `lib/theme.ts`                                                                                                           |
| Tailwind `score.1..5` (sequential warm orange ramp)                 | Reuse from design's accent ramp; design effectively uses oxblood as the only warm accent. The 5-bucket warm orange scale stays useful for `<ScoreBar>`. | **Keep** as-is — design implies a single accent but does not provide a 5-step sequential ramp; the existing warm orange ramp is compatible with the editorial palette |
| `--font-serif` (currently undefined / Georgia fallback in tailwind) | `Fraunces`                                                                                                                                              | Replace via `next/font` loader in [apps/web/app/layout.tsx](apps/web/app/layout.tsx)                                                                                  |
| `--font-sans`                                                       | `Inter Tight`                                                                                                                                           | Replace                                                                                                                                                               |
| `--font-mono`                                                       | `JetBrains Mono`                                                                                                                                        | Replace                                                                                                                                                               |

### 1.4 Phase 4 tokens with NO direct equivalent — must keep for shadcn / Radix compatibility

These are Radix Popover, focus ring, framer-motion, Recharts contracts:

- `--card`, `--card-foreground` — Radix popover/card primitives expect this; alias to `--paper-2`/`--ink`.
- `--popover`, `--popover-foreground` — Radix Popover (provenance trigger, pre-cal chip) expects this; alias to `--paper`/`--ink`.
- `--ring` — `:focus-visible` global rule consumes this.
- `--destructive`, `--destructive-foreground` — used by `provenance-trigger` "Provenance incomplete" chip and by `policy-timeline` severity styling.
- `--input` — shadcn form primitives.

**Strategy:** keep ALL existing CSS variable names, change their underlying values, and add the new design tokens alongside. Nothing in `components/gtmi/` has to be rewritten just because the palette changed. Tailwind utility names (`bg-paper`, `text-ink`, `border-border`, `bg-muted`, `text-muted-foreground`, `text-accent`, etc.) all keep working.

### 1.5 Final token layer — proposal

In `apps/web/app/globals.css`, the `:root` block becomes a hybrid:

1. **Design tokens (flat hex)** as new CSS custom properties: `--paper`, `--paper-2`, `--paper-3`, `--rule`, `--rule-soft`, `--ink`, `--ink-2..--ink-5`, `--accent`, `--accent-2`, `--accent-soft`, `--navy`, `--navy-2`, `--navy-soft`, `--positive`, `--warning`, `--negative`, `--pillar-a..--pillar-e`, plus the typographic and spacing scales from `docs/design/styles.css`.

2. **Compatibility layer** for shadcn — keep the variable NAMES `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--muted-foreground`, `--accent` (this one collides — see below), `--accent-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--destructive`, `--ring`, `--border`, `--input`. **Switch them from HSL triplets to bare hex.** This requires a one-line change in `tailwind.config.ts` from `hsl(var(--…))` to `var(--…)`.

3. **Name collision:** the design uses `--accent` for oxblood; shadcn uses `--accent` for the interactive accent (currently teal). They map cleanly — both want a single accent — so the redesign keeps the name `--accent` and just changes its value. No utility rename needed.

### 1.6 Exact file changes needed

**[apps/web/app/globals.css](apps/web/app/globals.css)**

- Replace the entire `:root` color block. New values listed in §1.5.
- Add the new spacing/typography custom properties (`--fs-display`, `--space-1..--space-9`).
- Drop the `.dark` block — see §1.7.
- Add `@import` for the three Google Fonts via `next/font` instead (better performance + no FOUT).
- Add the design's `.serif`, `.serif-tight`, `.mono`, `.eyebrow`, `.rule`, `.rule-thick`, `.rule-soft`, `.dropcap`, `.peer-note`, `.btn`, `.btn-ghost`, `.btn-link`, `.chip` family, `.score-bar`, `.num`, `.num-l`, `.paper-grain`, `.hatch`, `table.gtmi` rules verbatim from `docs/design/styles.css` so the design's visual atoms work without re-implementing them in JSX.

**[apps/web/tailwind.config.ts](apps/web/tailwind.config.ts)**

- Replace `hsl(var(--…))` wrapper with bare `var(--…)` for the eight semantic tokens (`ink`, `paper`, `surface`, `border`, `input`, `ring`, `background`, `foreground`, `muted`, `accent`, `primary`, `secondary`, `destructive`, `popover`, `card`, `precalib`).
- Add design's pillar palette under `colors.pillar.a..e` replacing the current cool-blue hex set.
- Add `colors.navy.{DEFAULT,2,soft}`, `colors.ink.{2,3,4,5}`, `colors.paper.{DEFAULT,2,3}`, `colors.rule.{DEFAULT,soft}`, `colors.positive`, `colors.warning`, `colors.negative` so utility classes like `text-ink-3`, `border-rule-soft`, `bg-paper-2` work.
- Add `fontFamily.serif: ['var(--font-serif)', ...]` etc — the values already point to `--font-serif`; just make sure the `next/font` loader exports those variable names.
- Add `fontSize` keys matching the design scale: `fs-display: 72px`, `fs-h1: 44px`, `fs-h2: 28px`, `fs-h3: 20px`, `fs-body: 15px`, `fs-small: 13px`, `fs-micro: 11px`. Keep the existing `display-xl/lg/md`, `dek`, `body`, `data-*` keys for back-compat — components that still use them keep rendering; new components use the new keys.

**[apps/web/lib/theme.ts](apps/web/lib/theme.ts)**

- Replace `PILLAR_COLORS` hex values with the design's warm-cool spectrum: `A: '#5C4A2E', B: '#846A3F', C: '#4F6B3E', D: '#2C4159', E: '#6E3A2E'`.
- Replace `ACCENT_DEEP_TEAL = '#0F4C5C'` with `ACCENT_OXBLOOD = '#B8412A'` and update the export name. Search-and-replace use sites — currently used only in `tailwind.config.ts` (now via CSS var) and possibly OG-image generation. Audit before renaming.
- Update `PRE_CALIBRATION.light` to `{ fg: '#B8862A', bg: '#FBF3DC' }` to match design's amber chip.
- Keep `SCORE_SCALE` as-is (design did not provide a 5-bucket sequential ramp; the existing warm orange ramp reads as part of the editorial palette).
- Drop `PRE_CALIBRATION.dark`. See §1.7.

### 1.7 Dark mode decision

**Recommendation: drop dark mode.** Every screen in the design is light-only. The design's "dark" surfaces (`SectionPlate tone='ink'`, `EditorsQuote`, footer, `SplitVisual` CME column) are full-bleed dark sections inside a light page, not a UI-wide theme.

**Concrete changes:**

- Remove the `.dark { … }` block from [apps/web/app/globals.css](apps/web/app/globals.css).
- Remove `darkMode: ['class']` from [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts).
- Remove the `<ThemeToggle />` from [apps/web/app/(public)/layout.tsx](<apps/web/app/(public)/layout.tsx>) and from [apps/web/app/preview-gallery/page.tsx](apps/web/app/preview-gallery/page.tsx).
- Remove the `next-themes` provider (currently consumed via `apps/web/components/theme-toggle.tsx`).
- Remove `next-themes` dep from [apps/web/package.json](apps/web/package.json).
- Drop the `dark:…` Tailwind variants used in `provenance-trigger.tsx` (Tier 2 source badge, derived-inputs amber block, country-substitute purple block — all use `dark:bg-…/40 dark:text-…`).

**Risk:** none functionally. **Open question 2** below asks the analyst to confirm dark-mode is genuinely dropped, since a few internal users might rely on it.

---

## SECTION 2 — Component inventory delta

| Component                                                                                                     | Phase 4 status                                                              | Action needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScoreBar` ([score-bar.tsx](apps/web/components/gtmi/score-bar.tsx))                                          | Exists. 0–100 numeric label + sequential-color bar + optional pre-cal chip. | **Visual only.** Replace `bg-muted` track with `var(--rule-soft)` and the fill with the design's `var(--ink)` or `var(--accent)` per context. Drop `rounded-table`. Keep API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PreCalibrationChip` ([pre-calibration-chip.tsx](apps/web/components/gtmi/pre-calibration-chip.tsx))          | Exists. Radix popover, amber on cream.                                      | **Visual only.** Restyle to match design's `chip chip-amber` rule. Keep popover behaviour and the canonical copy. Rename label "Pre-calibration" → "Pre-cal" in dense contexts (tables); keep "Pre-calibration" on detail headers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `CoverageChip` ([coverage-chip.tsx](apps/web/components/gtmi/coverage-chip.tsx))                              | Exists. "30/48" mono.                                                       | **Visual only.** Restyle to match design's mute chip; the percent threshold (≥70%) and aria-label stay. Design renders coverage as a mono percent (e.g. `92%`) inside a chip — switch the rendered string from `${populated}/${total}` to `${(populated/total*100).toFixed(0)}%`. Keep the 30/48 absolute value as the title attribute.                                                                                                                                                                                                                                                                                                                                                                                         |
| `CompositeScoreDisplay` ([composite-score-display.tsx](apps/web/components/gtmi/composite-score-display.tsx)) | Exists. 96–120px mono headline.                                             | **Structural.** Design renders composite as a 36–72px Fraunces serif numeral inside a paper-2 plate (right column of program header), with PAQ + CME below a thin rule. Rebuild the layout while keeping the same props (`composite`, `cme`, `paq`, `phase2Placeholder`, `rank`, `scoredCount`).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PillarMiniBars` ([pillar-mini-bars.tsx](apps/web/components/gtmi/pillar-mini-bars.tsx))                      | Exists. 5×8×24 vertical bars.                                               | **Visual only.** Design's `PillarMini` is 5×6px wide bars on a 22px row, no track. Drop track, set width 6, remove `rounded-table`. API stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PillarRadar` ([pillar-radar.tsx](apps/web/components/gtmi/pillar-radar.tsx))                                 | Exists. Recharts radar with cohort overlay + compare.                       | **Visual only.** Restyle stroke/fill to use accent oxblood for the program polygon and `--ink-4` dashed for the benchmark; move axis tick fill to `--ink-3`. The screen-reader sr-only table stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `MethodologyBar` ([methodology-bar.tsx](apps/web/components/gtmi/methodology-bar.tsx))                        | Exists. 30/70 + 5-pillar inline diagram.                                    | **Structural.** Design has two distinct diagrams: `SplitSpecimen` (donut 30/70) and `PillarsSpecimen` (5-letter typographic poster). Phase A keeps the existing `MethodologyBar` for backward compatibility (used on `/` and `/methodology`) and adds two new components.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ProvenanceTrigger` ([provenance-trigger.tsx](apps/web/components/gtmi/provenance-trigger.tsx))               | Exists. Radix Popover.                                                      | **Structural — biggest change in this redesign.** Convert from Popover (small, side-anchored) to a right-side **drawer** matching the design's `ProvenanceDrawer`. Drawer is full-height, 540px wide, with header (eyebrow / id / title / raw / score / weight / sources strip), scrollable body listing each source as a paper-2 card with highlighted sentence + char offsets + page + sha256 + scrape time, plus a scoring rubric block. Reuse `ProvenanceHighlight` for the highlighted span. Keep the `readProvenance(provenance, status)` validation contract — drawer still renders the "Provenance incomplete" chip for malformed rows. **API stays:** `provenance`, `status`, `valueRaw`, `triggerLabel`, `className`. |
| `ProvenanceHighlight` ([provenance-highlight.tsx](apps/web/components/gtmi/provenance-highlight.tsx))         | Exists. char-offset substring rendering.                                    | **Visual only.** Restyle the `<mark>` element with the design's `background: #FBE5DC; border-bottom: 2px solid var(--accent)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PolicyTimeline` ([policy-timeline.tsx](apps/web/components/gtmi/policy-timeline.tsx))                        | Exists. Vertical list with severity chip.                                   | **Visual only** (Phase 4 — placeholder rendering). Once Phase 5 lights up `policy_changes`, the component will render real events with the design's `ChangesScreen` styling — see §3 Phase D.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `EmptyState` ([empty-state.tsx](apps/web/components/gtmi/empty-state.tsx))                                    | Exists. Title/body/CTA card.                                                | **Visual only.** Replace `bg-surface` with `bg-paper-2`, `border-border` with `border-rule`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `DirectionArrow` ([direction-arrow.tsx](apps/web/components/gtmi/direction-arrow.tsx))                        | Exists. ↑/↓ glyph.                                                          | **Keep as-is.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `SectionHeader` ([section-header.tsx](apps/web/components/gtmi/section-header.tsx))                           | Exists. eyebrow + display heading.                                          | **Visual only.** Use Fraunces serif and the design's `eyebrow` rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `DataTableNote` ([data-table-note.tsx](apps/web/components/gtmi/data-table-note.tsx))                         | Exists. small-print explainer below tables.                                 | **Visual only.** Italicise; align with design's footnote tone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `RankingsTable` ([rankings-table.tsx](apps/web/components/gtmi/rankings-table.tsx))                           | Exists. shadcn-style table, `framer-motion` row reorder for advisor mode.   | **Structural.** Design's table has different columns: rank with `00`-padding, country (flag + name), programme (Fraunces serif), category, composite (number + bar), PAQ, CME, Pillars (mini-bars), **Trend (12m sparkline)**, Coverage, Status (Pre-cal / Scored chip). Rebuild markup using `table.gtmi` styles; keep the FLIP layout for advisor reorder; add Sparkline column (see Phase B for data treatment).                                                                                                                                                                                                                                                                                                             |
| `RankingsFilters` ([rankings-filters.tsx](apps/web/components/gtmi/rankings-filters.tsx))                     | Exists. Multi-faceted filter UI.                                            | **Structural.** Design's `FilterBar` is a single horizontal chip strip ("All categories" + 5 category chips) with density toggle and Advisor-mode link. Existing component supports more facets (region, country, score range, search, scored-only). **Decision needed:** keep advanced filter affordances behind a "More filters" disclosure or drop them. **See §7 Open question 4.**                                                                                                                                                                                                                                                                                                                                         |
| `AdvisorModeToggle` ([advisor-mode-toggle.tsx](apps/web/components/gtmi/advisor-mode-toggle.tsx))             | Exists. Pillar-weight sliders for client-side recompute.                    | **Visual only.** Restyle entry-point (button) to design's `btn-link` style; the slider panel inside keeps its current shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `WeightSlider` ([weight-slider.tsx](apps/web/components/gtmi/weight-slider.tsx))                              | Exists. Range input with proportional rebalance.                            | **Visual only.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `RankingsExplorer` ([rankings-explorer.tsx](apps/web/components/gtmi/rankings-explorer.tsx))                  | Exists. Client orchestrator wiring filters/sort/advisor.                    | **Keep as-is** (composition only; no JSX in this file matters except `<RankingsFilters>`, `<AdvisorModeToggle>`, `<RankingsTable>` which are all individually addressed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `IndicatorRow` ([indicator-row.tsx](apps/web/components/gtmi/indicator-row.tsx))                              | Exists. One indicator inside the sub-factor accordion.                      | **Structural.** Design renders rows in a `table.gtmi` layout: ID (mono), Indicator (Fraunces serif), Weight (mono right-aligned), Raw value (mono), Score (mono + ScoreBar), Provenance (`N src ⛬` button — opens drawer), Status chip. The current grid-based row keeps its data plumbing but the visual gets a full rebuild.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SubFactorAccordion` ([sub-factor-accordion.tsx](apps/web/components/gtmi/sub-factor-accordion.tsx))          | Exists. 15 sub-factors as expandable disclosures.                           | **Structural.** Design uses an `IndicatorTable` per pillar (not per sub-factor); tab-strip across pillars selects which pillar's full indicator list to show. **However**, the design only shows Pillar A's table — sub-factor grouping is implicit via the indicator IDs (`A.01`, `A.02`, ...). **Decision needed:** keep the 15 disclosures (better for scanning all pillars at once) or move to a 5-tab pillar view (better for editorial weight). **See §7 Open question 5.** Recommendation: keep the accordion as one "rendering mode" and add the tab-strip filter as a secondary layout — both ship together.                                                                                                           |
| `PillarBreakdownTable` ([pillar-breakdown-table.tsx](apps/web/components/gtmi/pillar-breakdown-table.tsx))    | Exists. Pillar-by-pillar table on program detail.                           | **Structural.** Design's `ProgramHeader` strips the per-pillar plate inline (5-column grid below the headline), each cell showing pillar letter + name + score + indicator count + ScoreBar. Rebuild to match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PillarComparison` ([pillar-comparison.tsx](apps/web/components/gtmi/pillar-comparison.tsx))                  | Exists. Wraps radar + breakdown table + compare-to dropdown.                | **Visual only.** Reuse the new radar styling. Layout stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CountryFlag` ([country-flag.tsx](apps/web/components/gtmi/country-flag.tsx))                                 | Exists. Vendored SVG flags.                                                 | **Visual only.** Design also defines a fallback "ISO box" `CountryFlag` (mono ISO code in a paper-3 box). Recommendation: keep the SVG flag as primary; restyle the GlobeGlyph fallback to look like the design's box.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `JsonLd` ([json-ld.tsx](apps/web/components/gtmi/json-ld.tsx))                                                | Exists. SEO.                                                                | **Keep as-is.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### New components to add (do not exist in Phase 4)

| New component       | File                                               | Spec                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sparkline`         | `apps/web/components/gtmi/sparkline.tsx`           | 12-point SVG sparkline (~64×18px); first/last point markers; trend-up colour `var(--positive)`, trend-down `var(--accent)`. Translates `docs/design/primitives.jsx:Sparkline` directly. **Data:** see §4.                                  |
| `SpecimenPlate`     | `apps/web/components/gtmi/specimen-plate.tsx`      | Full-bleed editorial section divider. Props: `plateNo`, `title`, `caption`, `tone: 'paper-2' \| 'paper-3' \| 'ink' \| 'navy'`, `children`. Translates `docs/design/primitives.jsx:SpecimenPlate`.                                          |
| `SectionPlate`      | `apps/web/components/gtmi/section-plate.tsx`       | Chapter-style title plate. Props: `numeral`, `title`, `standfirst`, `tone`. Translates `docs/design/primitives.jsx:SectionPlate`.                                                                                                          |
| `MarginNote`        | `apps/web/components/gtmi/margin-note.tsx`         | Italic Fraunces gutter annotation. Props: `children`, `color`.                                                                                                                                                                             |
| `BubbleChart`       | `apps/web/components/gtmi/bubble-chart.tsx`        | Composite-vs-CME/PAQ scatter. Recharts `ScatterChart` with PAQ on X, CME on Y, bubble size = composite, programme name on hover. NOT in the design files — **the user brief mentions it**. **Open question 3.**                            |
| `EditorialQueue`    | `apps/web/components/gtmi/editorial-queue.tsx`     | I-01 review queue table. Columns per design: ID, programme, indicator, source, impact, confidence, age, reviewer, status. Props: `rows: ReviewListRow[]`. Status uses `data-status` attribute for CSS-driven colour.                       |
| `ChangesAudit`      | `apps/web/components/gtmi/changes-audit.tsx`       | I-02 changes log timeline-with-spine layout per `docs/design/screen-country-changes.jsx:ChangesScreen`. Props: `events: PolicyChangeRow[]`. Renders empty-state when `events` is empty (so it activates with zero code change in Phase 5). |
| `SplitSpecimen`     | `apps/web/components/gtmi/split-specimen.tsx`      | 30/70 SVG donut with side legend. Translates `docs/design/screen-rankings-v2.jsx:SplitSpecimen`.                                                                                                                                           |
| `PillarsSpecimen`   | `apps/web/components/gtmi/pillars-specimen.tsx`    | 5-letter typographic poster (A/B/C/D/E with weights). Reads weights from `getMethodologyCurrent()`. Translates `docs/design/screen-rankings-v2.jsx:PillarsSpecimen`.                                                                       |
| `WeightTreeDiagram` | `apps/web/components/gtmi/weight-tree-diagram.tsx` | Mono-typed branching weight tree. Replaces the current methodology-page `<PillarBlock>` weight-walk with the `docs/design/screen-methodology.jsx:WeightTree` rendering.                                                                    |
| `WorldMap`          | `apps/web/components/gtmi/world-map.tsx`           | Dot-matrix choropleth scoring map. **Optional Phase B candidate.** **Open question 6.**                                                                                                                                                    |
| `LeadersByCategory` | `apps/web/components/gtmi/leaders-by-category.tsx` | 5-category leader strip. **Phase B.**                                                                                                                                                                                                      |
| `ThisEdition`       | `apps/web/components/gtmi/this-edition.tsx`        | "This Edition" 30-day movers/new entrant strip. **Phase B.** **Data dependency: requires score history. Open question 7.**                                                                                                                 |
| `EditorsQuote`      | `apps/web/components/gtmi/editors-quote.tsx`       | Full-bleed dark quote block. Phase B.                                                                                                                                                                                                      |
| `ProvenanceProof`   | `apps/web/components/gtmi/provenance-proof.tsx`    | "One indicator, fully exposed" exhibit. Phase B.                                                                                                                                                                                           |
| `GtmiFooter`        | `apps/web/components/gtmi/gtmi-footer.tsx`         | Replaces the current `SiteFooter` in `(public)/layout.tsx`.                                                                                                                                                                                |
| `TopNav`            | `apps/web/components/gtmi/top-nav.tsx`             | Replaces the inline `<TopNav>` in `(public)/layout.tsx`. Adds Rankings / Programmes / Countries / Methodology / About items per design.                                                                                                    |
| `PreviewBanner`     | `apps/web/components/gtmi/preview-banner.tsx`      | Replaces the existing `<dangerouslySetInnerHTML>` banner block on `(public)/page.tsx`.                                                                                                                                                     |
| `ProvenanceDrawer`  | `apps/web/components/gtmi/provenance-drawer.tsx`   | The new right-side drawer. Internally used by `ProvenanceTrigger`. Built with Radix Dialog (modal=false) so focus trap + ESC-close + scroll-lock are correct.                                                                              |

---

## SECTION 3 — Screen-by-screen implementation plan

### Phase A — Token layer + primitives — **Small / Medium**

**Independently shippable:** yes. After Phase A, every public page renders against the new tokens and font stack; no layout has changed yet, so visually the impact is "warm cream replaces cool off-white, Fraunces replaces system-serif, oxblood replaces teal accent." All existing tests pass.

**Files changed**

- [apps/web/app/globals.css](apps/web/app/globals.css) — full rewrite of `:root` + add design's class atoms.
- [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts) — flatten `hsl(var(--…))` to `var(--…)`; replace pillar palette; add ink/paper/rule/navy colour scales; new font sizes; drop `darkMode`.
- [apps/web/lib/theme.ts](apps/web/lib/theme.ts) — replace `PILLAR_COLORS` and `ACCENT_*`; update `PRE_CALIBRATION`; drop dark variant.
- [apps/web/app/layout.tsx](apps/web/app/layout.tsx) (root) — wire `next/font/google` for Fraunces, Inter Tight, JetBrains Mono; export `--font-serif/--font-sans/--font-mono` CSS variables.

**New files created**

- `apps/web/components/gtmi/sparkline.tsx`
- `apps/web/components/gtmi/specimen-plate.tsx`
- `apps/web/components/gtmi/section-plate.tsx`
- `apps/web/components/gtmi/margin-note.tsx`
- `apps/web/components/gtmi/provenance-drawer.tsx` (skeleton — wired in Phase C)
- `apps/web/components/gtmi/top-nav.tsx`
- `apps/web/components/gtmi/gtmi-footer.tsx`
- `apps/web/components/gtmi/preview-banner.tsx`

**Existing primitives restyled (visual only — see §2 column 3)**

- `score-bar.tsx`, `pre-calibration-chip.tsx`, `coverage-chip.tsx`, `pillar-mini-bars.tsx`, `country-flag.tsx`, `direction-arrow.tsx`, `section-header.tsx`, `data-table-note.tsx`, `empty-state.tsx`, `pillar-radar.tsx`, `provenance-highlight.tsx`.

**Existing primitives structurally rebuilt**

- `composite-score-display.tsx` — new layout per design's `ProgramHeader` right-column plate.
- `methodology-bar.tsx` — kept for back-compat; new `split-specimen.tsx` and `pillars-specimen.tsx` added alongside.

**Routes touched**

- [apps/web/app/(public)/layout.tsx](<apps/web/app/(public)/layout.tsx>) — replace inline `<TopNav>` and `<SiteFooter>` with `<TopNav>` and `<GtmiFooter>` from `components/gtmi`.
- [apps/web/app/preview-gallery/page.tsx](apps/web/app/preview-gallery/page.tsx) — extend to render every new primitive (`Sparkline`, `SpecimenPlate`, `SectionPlate`, `MarginNote`, `SplitSpecimen`, `PillarsSpecimen`, restyled `ScoreBar`/`PillarMiniBars`/`PreCalibrationChip`/`CoverageChip`/`CompositeScoreDisplay`/`PillarRadar`). Drop the `<ThemeToggle>`. Drop dark-variant rows.
- Remove `apps/web/components/theme-toggle.tsx` and the `next-themes` dep.

**Tests**

- Update `score-bar.test.tsx`, `indicator-row.test.tsx`, `provenance-trigger.test.tsx`, `a11y.test.tsx` for any role/colour assertions that change.

### Phase B — Landing + Rankings — **Large**

**Independently shippable:** yes — landing and `/programs` are sister surfaces sharing `RankingsExplorer`. Cloud Run deploy required.

**Files changed**

- [apps/web/app/(public)/page.tsx](<apps/web/app/(public)/page.tsx>) — full rewrite of the editorial layout. Sections: `<HeroLanding>` (large Fraunces headline + 30/70 block + 5-cell stats strip), `<ThisEdition>` (movers strip), `<WorldMap>` (optional — Q6), `<SpecimenPlate>` wrapping `<PillarsSpecimen>`, `<LeadersByCategory>`, `<EditorsQuote>`, `<ProvenanceProof>`, then the existing rankings explorer in a `Full programme rankings` section. Keep `getRankedPrograms()` query call and `dynamic = 'force-dynamic'` directive.
- [apps/web/app/(public)/programs/page.tsx](<apps/web/app/(public)/programs/page.tsx>) — restyled rankings header (Fraunces "All programmes"), `<FilterBar>` chips, redesigned `<RankingsTable>`. Pagination kept.
- [apps/web/components/gtmi/rankings-table.tsx](apps/web/components/gtmi/rankings-table.tsx) — full visual rebuild per design; add Sparkline column (Q7), mini-bars, status chip; rank with `00`-padding; row 1 highlighted with `rgba(184,65,42,0.04)`.
- [apps/web/components/gtmi/rankings-filters.tsx](apps/web/components/gtmi/rankings-filters.tsx) — rebuild as the chip-strip `FilterBar`. Advanced filters move into a "More filters" disclosure (Q4).

**New files created**

- `apps/web/components/gtmi/this-edition.tsx`
- `apps/web/components/gtmi/world-map.tsx` (Q6)
- `apps/web/components/gtmi/leaders-by-category.tsx`
- `apps/web/components/gtmi/editors-quote.tsx`
- `apps/web/components/gtmi/provenance-proof.tsx`
- `apps/web/components/gtmi/bubble-chart.tsx` (if Q3 confirms)
- `apps/web/components/gtmi/split-specimen.tsx`
- `apps/web/components/gtmi/pillars-specimen.tsx`
- `apps/web/lib/queries/this-edition.ts` (only if Q7 confirms a real-data path is needed; otherwise the strip is hardcoded for Phase B and lit by Phase 5+ when score history exists)

**Complexity drivers:** Sparkline data, `ThisEdition`, `WorldMap`, BubbleChart all need data pulls or fabricated stubs (see §4).

### Phase C — Programme detail + Provenance drawer — **Large**

**Independently shippable:** yes. Programme pages render against new shell.

**Files changed**

- [apps/web/app/(public)/programs/[id]/page.tsx](<apps/web/app/(public)/programs/[id]/page.tsx>) — restructure to match design's `ProgramDetailScreen`. Header gets crumbs, flag + eyebrow, Fraunces program-name title, descriptive paragraph, right-column composite plate. 5-cell pillar strip below header. New `IndicatorTable` (per pillar tab) with `<ProvenanceTrigger>` opening `<ProvenanceDrawer>`. Drop `<PillarComparison>` from the page header — radar moves to a sub-section, not the top-of-page anchor. Keep "What this means" + "Government sources" + `<DataTableNote>`.
- [apps/web/components/gtmi/provenance-trigger.tsx](apps/web/components/gtmi/provenance-trigger.tsx) — switch from Radix Popover to controlled state opening `<ProvenanceDrawer>`. Trigger label changes to `N src ⛬` button (mono).
- [apps/web/components/gtmi/provenance-drawer.tsx](apps/web/components/gtmi/provenance-drawer.tsx) — full implementation: Radix Dialog (non-modal), 540px right-anchored, Header (eyebrow / id / serif title / Raw/Score/Weight/Sources strip), scrollable body listing each source as a paper-2 card with `<ProvenanceHighlight>` + char-offset/page/sha/scrape grid, plus "Scoring rule" code block reading from `field_definitions.scoring_rubric_jsonb`.
- [apps/web/components/gtmi/sub-factor-accordion.tsx](apps/web/components/gtmi/sub-factor-accordion.tsx) — restyled to match design typographic table. (See Q5 for tab-strip alternative.)
- [apps/web/components/gtmi/indicator-row.tsx](apps/web/components/gtmi/indicator-row.tsx) — rebuild to design's row layout.
- [apps/web/components/gtmi/composite-score-display.tsx](apps/web/components/gtmi/composite-score-display.tsx) — rebuilt in Phase A; integrated here.
- [apps/web/components/gtmi/pillar-breakdown-table.tsx](apps/web/components/gtmi/pillar-breakdown-table.tsx) — converted into the 5-cell pillar strip.

**New files created** — none beyond Phase A scaffolds.

### Phase D — Methodology + Country pages — **Medium**

**Independently shippable:** yes.

**Files changed**

- [apps/web/app/(public)/methodology/page.tsx](<apps/web/app/(public)/methodology/page.tsx>) — sections: `MethodologyHeader` (eyebrow / large Fraunces headline / 4-stat strip), `SplitVisual` (30/70 with full CME/PAQ indicator lists per design), `<WeightTreeDiagram>`, `FalsifiabilityCommitments` (6 numbered items per design). Keep `getMethodologyCurrent()` query and the `intro/normalization/data-integrity/sensitivity/whatGTMIMeasuresNot/pillars/A..E.md` content loads. Replace `<PillarBlock>` calls with the new diagram.
- [apps/web/app/(public)/countries/[iso]/page.tsx](<apps/web/app/(public)/countries/[iso]/page.tsx>) — design's `CountryHeader` with crumbs, Fraunces "Switzerland" headline, 3-cell summary strip; `<ProgrammesTable>` per design (categories in mono uppercase); right-column `<PillarRadar>` overlay vs OECD median (data: see §4); keep tax-treatment block. Drop the "Country-level stability" Phase 5 empty-state since the design omits it — or keep behind an internal flag (Q8).
- [apps/web/components/gtmi/weight-tree-diagram.tsx](apps/web/components/gtmi/weight-tree-diagram.tsx) — new.

**New files created**

- `apps/web/components/gtmi/weight-tree-diagram.tsx`
- `apps/web/components/gtmi/falsifiability-commitments.tsx`

### Phase E — Internal tools (Editorial review queue + Changes audit) — **Medium / Large**

**Independently shippable:** yes. Internal-only.

**Files changed**

- [apps/web/app/(internal)/review/page.tsx](<apps/web/app/(internal)/review/page.tsx>) — full rebuild. New header: Fraunces "Pending review.", standfirst, 4-cell stats strip (in queue / SLA risk / avg age / auto-conf >0.9). `<EditorialQueue>` table with columns: ID (`RV-NNNN` mono), programme (Fraunces), indicator (mono), source, impact (signed delta on composite), confidence (number + ScoreBar), age (relative), reviewer (initials avatar), status (`pending` / `in-review` / `flagged` with status dot). "Bulk approve high-confidence" + "Open next ↑" buttons. Tab strip for status filter.
- [apps/web/app/(internal)/review/layout.tsx](<apps/web/app/(internal)/review/layout.tsx>) — restyle to match design's `<InternalBadge>` (black bar, "Internal · TTR Group only · not public").
- [apps/web/lib/review-queries.ts](apps/web/lib/review-queries.ts) — extend `ReviewListRow` with `impactDelta` (PAQ delta on composite) and `extractionConfidence` so the Editorial Queue table can render them. **Data work — see §4.**
- [apps/web/app/(public)/changes/page.tsx](<apps/web/app/(public)/changes/page.tsx>) — replace the empty-state-only treatment with `<ChangesAudit>`. Filter UI redesigned as chip strip ("All", "Data", "Methodology", "Provenance", "Dissents"). When `events.length === 0` (Phase 4 reality), `<ChangesAudit>` renders the design's preview state with explanatory copy. When events flow through (Phase 5+), the same component renders the full timeline.
- [apps/web/app/(internal)/review/[id]/page.tsx](<apps/web/app/(internal)/review/[id]/page.tsx>) — restyled detail row (lower priority; keep Phase A token-only changes for v1, full restyle a follow-up).

**New files created**

- `apps/web/components/gtmi/editorial-queue.tsx`
- `apps/web/components/gtmi/changes-audit.tsx`
- `apps/web/components/gtmi/internal-badge.tsx`

### Cross-phase: tests

Each phase ships with its tests updated:

- Phase A: primitives unit + a11y tests (`vitest-axe` smoke).
- Phase B: rankings table snapshot/behaviour test; explorer integration test.
- Phase C: provenance drawer test (open / close / source list); existing `provenance-trigger.test.tsx` updated.
- Phase D: methodology + country page render tests.
- Phase E: editorial queue test; changes audit empty + populated render tests.

---

## SECTION 4 — Data layer compatibility

The headline finding: **the data layer largely covers the new design with no new query work.** The exceptions are listed below.

### 4.1 Per-screen coverage

| Screen                     | Existing query covers                            | Gaps                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing `/`                | `getRankedPrograms()`                            | Sparkline; `ThisEdition` movers; world-map quintile counts; "Programmes scored" / "Source documents" / "Provenance coverage" stat strip; bubble chart inputs                                                                                                                                                                                                                   |
| Rankings `/programs`       | `getRankedPrograms()`                            | Sparkline (per-row score history)                                                                                                                                                                                                                                                                                                                                              |
| Programme `/programs/[id]` | `getProgramDetail()`                             | None for the 5-pillar strip + radar + indicator table + provenance drawer; the design's "Editor's note" / "Disagreements" strip is not in the design files for this page so no gap                                                                                                                                                                                             |
| Methodology `/methodology` | `getMethodologyCurrent()`                        | None                                                                                                                                                                                                                                                                                                                                                                           |
| Country `/countries/[iso]` | `getCountryDetail()`                             | The radar overlay needs a "country composite radar" not just a single-program radar — but `<PillarRadar>` already supports `program` + `cohortMedian` + `compareTo`, and `CountryDetail` already returns per-program `pillarScores`. We aggregate to a country-level pillar profile in the page handler (mean of programs' pillarScores, weighted by composite). No new query. |
| Changes `/changes`         | `getPolicyChanges()`                             | None — query is real and returns `[]` today; design's filter UI is fully covered by `PolicyChangesFilters`                                                                                                                                                                                                                                                                     |
| Editorial Queue `/review`  | `listPendingReview()` + `listRecentlyReviewed()` | **Impact delta** on composite is missing                                                                                                                                                                                                                                                                                                                                       |

### 4.2 Specific data calls flagged in the brief

**Sparkline (12-month score history):** the `scores` table records every scoring run. `lib/queries/types.ts:RankedProgramRow.scoredAt` is currently a single point ("latest scored_at"). To render the sparkline per row we need either:

- **Option A — placeholder.** Synthesize a 12-month walk per row using the current composite as the right-edge value (the `trendForRank` function in `screen-rankings.jsx` does exactly this). Visually identical to the design. Honest because the score history table doesn't yet have the multi-month volume to draw a real trend (Phase 2 closed 2026-04-27, so we have ~weeks of history for AUS+SGP and zero for everyone else). **Recommended for Phase B.** Document the placeholder in the `<DataTableNote>` ("Trend rendering uses pseudo-deterministic walks until Phase 5 produces ≥ 6 months of scoring runs").
- **Option B — real data.** New query `getProgramScoreHistory(programIds, since)` reading the full `scores` table. Bucket by month; pad missing months from neighbours. Wire into `getRankedPrograms` as a left-join. Defer to Phase 5 / Phase 6 when score history is meaningful.

**BubbleChart (composite vs CME/PAQ):** `getRankedPrograms()` already returns `composite`, `cme`, `paq` per row → bubble chart needs no new query. Just a new presentation component. **No gap.**

**Stats bar (187 / 48 / 2,431 / 78.6%):**

- "187 programmes scored" → today's reality is 2 (`AUS`, `SGP`). `result.scoredCount` from `getRankedPrograms()` returns the truth. Render the truth.
- "48 indicators" → `getMethodologyCurrent()` exposes `pillars[].indicators[]`; sum is 48. Already exposed.
- "2,431 sources" → `sources` table count. New query needed: `getCohortStats()` returning `{ scoredCount, indicatorsTotal, sourcesTotal, coveragePct }` from one round trip. **New file:** `apps/web/lib/queries/cohort-stats.ts`. Trivial query, ~30 lines.
- "78.6% coverage" → average of `(field_values.fields_populated / 48)` across scored programs. Same query as above.

**EditorialQueue (I-01) impact delta + confidence + age + reviewer:**

- Confidence: `provenance.extractionConfidence` is already in the drilldown query (`getReviewDetail`) but not in `listPendingReview`. **Add** to the SELECT in `lib/review-queries.ts`.
- Age: `extractedAt` is already on the row; render as relative.
- Reviewer: `field_values.reviewed_by` exists on the schema; not currently on `ReviewListRow`. **Add.**
- **Impact delta on composite:** this is the hard one. The pipeline does NOT compute impact delta when an extraction is queued. Computing it requires re-running the scoring engine with the candidate value and diffing. Two options:
  - **Option A — defer.** Render `—` for impact for v1; `EditorialQueue` design supports `±0.0`. Add a follow-up issue to wire impact delta in a future phase.
  - **Option B — compute on read.** Add a new RPC / SQL function that, for each pending row, takes the candidate `value_indicator_score` and returns the composite delta vs the current scored composite. Query is non-trivial (needs the methodology hierarchy walk in SQL or a TypeScript service). Estimated 1–2 days. **Recommended for Phase E if we want the design to land complete.** **See §7 Open question 9.**

**ChangesAudit (I-02):** `getPolicyChanges()` already returns the right shape (`detectedAt`, `severity`, `programName`, `countryName`, `fieldKey`, `fieldLabel`, `summary`, `paqDelta`). When `policy_changes` is empty (today), `<ChangesAudit>` renders an empty-state per design that explains Phase 5+ behaviour. When Phase 5 / 6 lights up, the component renders real events. **No data gap.**

### 4.3 New query files

- `apps/web/lib/queries/cohort-stats.ts` — single SELECT returning programme/indicator/source/coverage totals, cached with `unstable_cache`. Phase B.
- `apps/web/lib/queries/this-edition.ts` — top-mover / new-entrant / largest-revision computation over the last 30 days from the `scores` history. Returns `[]` when history is too thin; component renders "Awaiting score history" placeholder. Phase B.
- (Optional) `apps/web/lib/queries/review-impact.ts` — impact-delta computation per pending row. Phase E if Q9 = yes.

### 4.4 Type-shape mismatches

- `RankedProgramRow.cme: number | null` — `null` for any programme without IMD CME data (today: many). Design assumes a number on the bubble chart axis. Filter to `cme !== null` upstream of `BubbleChart`. No code change beyond the filter.
- `pillarScores: PillarScores | null` — same treatment; mini-bars and radar already null-tolerant.
- `provenance: unknown` — drawer reads via `readProvenance()`; same contract as today's popover.

---

## SECTION 5 — Migration safety

### 5.1 `/review` is live and used

`/review` is auth-gated (Supabase magic link, middleware on `/review/*`). Phase E touches it. The risk is breaking the queue while reviewers depend on it.

**Mitigation:** Phase A and Phase B + C + D ship before Phase E touches `/review`. The token rebase in Phase A applies cleanly to `/review` — the existing markup uses generic Tailwind utilities that resolve to the new tokens automatically — so reviewers get a soft visual refresh without UX changes. Phase E, when it lands, ships with a fall-back routing trick:

- New design lives at `/review2` initially (route alias). Existing `/review` keeps working unchanged for the duration of Phase E development.
- When Phase E is signed off, swap the routes: rename `apps/web/app/(internal)/review/` → `apps/web/app/(internal)/review-legacy/`, rename `review2` → `review`. One commit. Easy revert.

### 5.2 Public routes are live on Cloud Run

`/`, `/programs`, `/programs/[id]`, `/methodology`, `/countries/[iso]`, `/changes`, `/about` all serve live traffic. Phases B / C / D each touch a subset of these.

**Mitigation:**

- Each phase deploys behind a per-route feature flag using a single `NEXT_PUBLIC_REDESIGN` env var with comma-separated route list (e.g. `landing,programs,detail,methodology,countries,changes,review`).
- The page handlers branch on the flag: when the route is in the flag list, render the redesigned section composition; otherwise fall back to the current layout. Old components stay in the tree; both renderings compile.
- Each phase's PR ships its routes as **off** in production, **on** in staging. After QA on staging the flag is flipped on for production via a Cloud Run env update — no redeploy required. Rollback is also a flag flip.

**Alternative considered — parallel route group `(public-v2)`:** rejected. Doubles maintenance during the rebase, splits SEO, breaks existing links. Feature-flag path is simpler.

### 5.3 Rollback per phase

| Phase                          | Failure mode                                                                  | Rollback action                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A — tokens                     | Visual regression on a screen we didn't anticipate                            | `git revert` — token files are isolated; tests catch most regressions; no DB dependency |
| B — landing/rankings           | Sparkline data wrong, world map mis-rendering, performance regression         | Flag flip `NEXT_PUBLIC_REDESIGN` to remove `landing,programs` from list                 |
| C — detail / provenance drawer | Drawer focus trap breaks keyboard nav, or `provenance-trigger.test.tsx` fails | Flag flip; revert `provenance-trigger.tsx` to popover branch                            |
| D — methodology / country      | Weight tree diagram mis-renders                                               | Flag flip                                                                               |
| E — editorial queue / changes  | Internal queue table breaks reviewer workflow                                 | Route swap back to `review-legacy`; flag flip on `/changes`                             |

### 5.4 Phase deploy targets

All five phases require **a Cloud Run redeploy** because they involve component code changes, `next/font` loading, and Tailwind config rebuilds — these are baked into the image, not ISR-able.

ISR continues to work for the data side (existing `unstable_cache` wrappers and route-level `revalidate` on `/about` are unaffected).

OG-image routes (`opengraph-image.tsx` on `/`, `/programs/[id]`, `/countries/[iso]`) ARE affected by the token change in Phase A — they read tailwind colours via the `@vercel/og` pipeline. Verify on staging before each redeploy.

---

## SECTION 6 — Documentation updates

Each phase's close-out commit updates the four canonical docs to reflect what landed in that phase. The redesign tag at the end is `phase-4-redesign-complete`.

### 6.1 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

**Phase A close-out commit:**

- Add a new top-level section `## Phase 4 Redesign` immediately under `## Phase 4` (which is already marked complete). Add five sub-sections (`### Phase 4-A — Token layer + primitives`, `### Phase 4-B — Landing + Rankings`, `### Phase 4-C — Programme detail`, `### Phase 4-D — Methodology + Country`, `### Phase 4-E — Internal tools`).
- Mark `### Phase 4-A` as ✅ once Phase A merges. Each subsequent phase mark it complete on its close-out commit.
- Strike-through or mark superseded the parts of `## Phase 4` that the redesign replaces — specifically the `RankingsExplorer` visual section, the legacy `<MethodologyBar>`-only methodology section, and the "Phase 5 placeholder" copy on `/changes` (the redesign supersedes the placeholder with `<ChangesAudit>` rendering the populated state when policy_changes lights up).
- Add `phase-4-redesign-complete` to the bottom-of-doc tag list once Phase E ships.

**Each subsequent phase close-out commit** updates only its own sub-section to ✅ and lists the files added / changed.

### 6.2 [docs/architecture.md](docs/architecture.md)

**Phase A close-out commit (§4 Tech stack table):**

- `next/font/google` row added: "Fraunces / Inter Tight / JetBrains Mono via `next/font` — replaces the `@import` pattern in globals.css, removes FOUT".
- Remove `next-themes` from the row listing it.
- Vendored flag SVGs row stays.

**Phase A close-out (§7 Current State):**

- Add a "Visual layer" sub-bullet under `apps/web` listing the new design tokens and the dark-mode removal.

**Phase B close-out (§7 Public routes section):**

- Update the `/` and `/programs` bullets to reference `<HeroLanding>`, `<ThisEdition>`, `<WorldMap>`, `<SpecimenPlate>` wrapping `<PillarsSpecimen>`, `<LeadersByCategory>`, `<EditorsQuote>`, `<ProvenanceProof>`, `<BubbleChart>` (if Q3 = yes), and the redesigned `<RankingsTable>` with sparkline column.

**Phase C close-out (§7 Public routes section):**

- Update the `/programs/[id]` bullet: provenance moved from popover to right-side drawer; new pillar strip; new indicator table (per-pillar tabs + accordion).

**Phase D close-out (§7 Public routes section):**

- `/methodology`: add `<WeightTreeDiagram>` and `<FalsifiabilityCommitments>`.
- `/countries/[iso]`: add country-level pillar radar overlay; remove the "Country-level stability" empty state line if the design's omission is confirmed.

**Phase E close-out:**

- Update the `/review` description in §2 workspace table to mention the editorial queue + impact-delta column.
- Update the `/changes` description in §7 Public routes to "active timeline rendering when policy_changes populates".

### 6.3 [docs/BRIEF.md](docs/BRIEF.md)

**Phase A close-out commit:**

- §1.1 design language paragraph: rewrite to describe editorial Fraunces serif, warm cream paper, oxblood accent, navy peer-review tone. Replace any reference to "deep teal" / "shadcn-default" framing.
- §10 Database schema: no change — design does not alter DB.
- Replace the Phase 4 section's component-name list with the redesign component names where they replaced an existing primitive (`<CompositeScoreDisplay>` rebuilt; `<MethodologyBar>` kept but flanked by `<SplitSpecimen>` + `<PillarsSpecimen>`; `<PolicyTimeline>` superseded by `<ChangesAudit>` on `/changes` (still used inside `<ProgramDetailScreen>` for per-program timeline)).

**Phase C close-out:**

- §8.3 Provenance chain paragraph: append "Drawer presentation" sentence describing that provenance opens as a right-side drawer on programme detail and is reachable by the `N src ⛬` mono trigger.

**Phase E close-out:**

- §13 Operational requirements: add "Editorial queue impact delta is computed at read time per pending row" if Q9 lands as yes.

### 6.4 [docs/METHODOLOGY.md](docs/METHODOLOGY.md)

**Expected: no changes.** Methodology numbers, pillar weights, normalization rules, and rubrics are unchanged by a visual redesign.

**Conditional flag — pillar labels:** if Open question 1 lands as "adopt the design's labels (Architecture / Process / Family / Recourse / Outcomes)", METHODOLOGY.md needs updates throughout: §1.3 pillar names, every pillar reference in the indicator catalogue, the overview tree in §1.1. **This would be a substantial methodology revision and should not happen silently.** If the analyst chooses this, the change must be a separate ADR (call it ADR-017 — "Pillar label revision"), not a documentation-update side-effect of the redesign. Recommendation: keep the existing labels (Access / Process / Rights / Pathway / Stability) and treat the design's labels as a copy mismatch to be normalized DOWN to the existing labels in the new components.

---

## SECTION 7 — Open questions for analyst decision

1. **Pillar labels.** Design uses "Architecture / Process / Family / Recourse / Outcomes". Implementation + METHODOLOGY.md use "Access / Process / Rights / Pathway / Stability". Do we (a) change the labels in the design assets to match the methodology, (b) change the methodology and downstream code to match the design (substantial — would require ADR-017), or (c) keep both — internal data uses A–E keys with the methodology labels, design copy uses the editorial labels? Recommendation: (a). The methodology labels are anchored in BRIEF + METHODOLOGY + extraction prompts; redesigning copy is cheap, redesigning methodology is a ceremony.

2. **Dark mode.** Confirm dropping dark-mode entirely. Removing `next-themes` saves dependency surface and complexity. Re-adding it later is achievable but non-trivial because every restyled primitive will lose its `dark:` variants in Phase A.

3. **Bubble chart.** The user brief lists `BubbleChart` as a needed new component, but it does not appear in any design screen file. Confirm: (a) bubble chart goes on the landing page somewhere — where? (b) bubble chart goes on `/programs` only? (c) drop it; the brief was speculative.

4. **Filter capability.** Existing `RankingsFilters` supports country, region, category, scored-only, score range, search. Design's `FilterBar` shows category chips + density toggle + advisor-mode link, no other filters. Recommendation: keep the chip strip front-of-stage and tuck country / region / score-range / search into a "More filters" disclosure. Confirm.

5. **Sub-factor accordion vs pillar tabs on `/programs/[id]`.** Existing UI: 15 sub-factor disclosures. Design: 5-tab pillar strip with one big indicator table per pillar. Pick one; my recommendation is **keep both** — tab strip is the primary rendering, accordion is reachable via "Expand all sub-factors" which collapses the tab and shows all 48 grouped by sub-factor.

6. **World map on landing page.** The dot-matrix world map is a striking centrepiece in the design. Building it requires hand-laid coordinates (already in `screen-rankings-v2.jsx`) — fine. Confirm we want it. It's optional in the sense that the page reads complete without it.

7. **Sparkline data treatment.** For Phase B, ship the placeholder approach (deterministic pseudo-walk from `rank` and `composite`)? Or wait for Phase 5 / 6 score-history density and ship the column blank for now? Recommendation: placeholder, with `<DataTableNote>` disclosure.

8. **Country-level stability section on `/countries/[iso]`.** Design omits this. Drop it, or keep behind a flag for Phase 5+ when stability data lights up?

9. **Impact delta on composite for the editorial queue.** Compute it (extra read-time work, ~1–2 days) so the design ships complete, or render `—` for v1 and add a TODO?

10. **Replace `MethodologyBar` everywhere or keep it.** It's the only common primitive shared between landing page and methodology page in the current implementation. Design replaces both with `SplitSpecimen` + `PillarsSpecimen`. Keep `MethodologyBar` for back-compat (some internal preview / OG-image references could exist), or delete it after migration?

11. **OG images.** Phase A token changes will affect `@vercel/og` rendered OG cards. Do we keep the existing OG layouts and just retint, or redesign the cards to be editorial (Fraunces headline, oxblood underline, etc.)?

12. **Phase ordering.** I've ordered A → B → C → D → E (tokens first, then increasing scope). The user's brief orders the same way. Confirm; if Internal tools (Phase E) is a higher priority than landing visuals, we'd flip A → E → B → C → D — which works because Phase A is a dependency of all four.

---

## Assumptions about design intent (flagged)

These are inferences from the design files, not confirmed by an explicit spec. Each assumption is something I'd want to verify before code lands.

- **`SectionPlate.tone` defaults to `'ink'` (full-bleed dark).** The design uses ink for chapter dividers and navy sparingly for peer-review framing.
- **The provenance drawer is non-modal.** It allows the user to scroll the indicator table behind it; the design's screenshot doesn't pin this down. If it should be modal (focus-trapped, scroll-locked), I'd build with Radix Dialog modal mode instead.
- **Sparkline trend colour rule:** trend up → `var(--positive)`, trend down → `var(--accent)` (oxblood). This is what the JSX does; semantically it's "improving = good, declining = score change = oxblood-as-attention". Confirm.
- **`#1` row on rankings highlighted with `rgba(184,65,42,0.04)`.** Editorial choice — only first row gets the wash. Confirm we want this for the live #1 (which today would be... whichever programme has the highest composite at runtime — currently SGP S Pass at PAQ 18.11 / composite 19.92). The design's #1 is Switzerland L-Permit at composite 78.4 because the design uses fabricated `GTMI_DATA`.
- **Editorial queue bulk-approve threshold.** Design says "Bulk approve high-confidence". Threshold is presumably the existing auto-approve cutoff (≥0.85 on extraction AND validation). Confirm.

---

## Conflicts between design and existing data constraints (explicit)

- **Stat strip values are fabricated.** Design shows "187 programmes / 2,431 sources / 78.6% coverage". Reality today is 2 scored / ~85 sources / much lower coverage. Per Open question 11, render the truth.
- **`<RankingsTable>` row 1 highlight + sparkline trend up colour both depend on which row is #1.** Today: SGP, all `phase2Placeholder: true`. Design: CHE 78.4. The redesign renders the live #1 — the visual treatment doesn't care about identity.
- **Pillar labels mismatch (Q1).** Already covered.
- **Design's `Pillar A weight = 22%` (`screen-program.jsx`) vs methodology's `Pillar A weight = 28%`.** The design's hard-coded weights are illustrative; the live page reads from `getMethodologyCurrent()` and renders 28%. No conflict beyond the fabricated mock.
- **CME / PAQ split shown as `30 / 70` and `100.0` for Switzerland.** A score of 100 in CME is impossible under min-max normalisation across the cohort — it would mean the country sets the cohort maximum. For the live cohort (today = AUS, SGP) this could happen for whichever has higher CME. Visually fine; semantically just be aware that "100.0" can occur naturally and isn't a placeholder bug.
- **Provenance drawer source list:** the design shows 4 chained sources for indicator A.03. Today the schema stores `sources` per-program and a single `source_id` per `field_value`. Multi-source provenance is not currently surfaced in `getProgramDetail()` — `field_values` carries one provenance JSONB per indicator, not a chain. The drawer can render the one-and-only source and a placeholder for the corroborating-sources slots until cross-check evidence is wired through (likely Phase 6 territory). **Open question 13** below.

13. **Provenance drawer multi-source rendering.** Render only the primary source today (matches the database) and show a "Corroborating sources land in Phase 6" placeholder for the corroborating slot? Or omit the corroborating UI entirely until the data lights up? Recommendation: omit; the drawer reads cleanly with a single source card.

---

## What this plan does NOT cover

- The Figma `design-canvas.jsx` wrapper. That's tooling for inspecting design files and is not shipped with the runtime.
- Mobile responsive behaviour. Design files target a 1440px artboard. Phase A uses the existing breakpoints in `tailwind.config.ts`; per-screen mobile behaviour gets a follow-up audit after Phase E.
- Animation / motion design. Design files don't specify motion. Existing `framer-motion` usage in `<RankingsTable>` (FLIP layout) and `useReducedMotion()` accessibility opt-out stay intact.
- Search / `RankingsFilters` deep restyling — covered under Open question 4.
- Internationalization / RTL — out of scope; the design is single-language English.

---

## Approval gate

This plan is what I will build against. **Stopping here per the brief — no implementation will start until you reply with explicit approval and decisions on the 13 open questions in §7 + §"Conflicts" #13.**
