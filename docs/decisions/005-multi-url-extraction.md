# 005: Multi-URL Extraction (Up to 5 URLs per Program)

**Status:** Accepted  
**Date:** 2026-04-19

## Context

The original design used a single canonical URL per program stored in a static registry. A single URL rarely contains all relevant fields: tuition fees, admission requirements, visa rules, and ranking data are typically spread across separate pages. Forcing all extraction through one URL produced high rates of missing values and required manual registry maintenance as URLs rotated.

## Decision

Replace the static single-URL registry with dynamic multi-URL extraction. Stage 0 discovery returns up to 5 URLs per program, ranked by tier and geographic level. The extraction stage runs against all Tier 1 URLs and selects the best result per field across all sources. The cross-check stage uses the first available Tier 2 URL.

## Consequences

- **Positive:** Field coverage improves substantially; extraction is no longer bottlenecked by a single page.
- **Positive:** No manual URL registry maintenance required.
- **Neutral:** Scraping and extraction costs scale with the number of discovered URLs (up to 5×).
- **Negative/Risk:** Conflicting values across multiple Tier 1 sources must be resolved by the extraction stage; the winning source selection logic must be robust.
