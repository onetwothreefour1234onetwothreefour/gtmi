# 003: Geographic Source Level Model (4 Levels)

**Status:** Accepted  
**Date:** 2026-04-19

## Context

Sources for a given program can have different geographic scopes: a UN agency publishes global data, a regional body covers a continent, a national ministry covers one country, and a provincial authority covers a sub-national region. Without a formal model for this distinction, the pipeline could not prioritise sources by authority or filter by relevance to a specific program's jurisdiction.

## Decision

Adopt a four-level geographic source model: `global`, `continental`, `national`, and `regional`. Each discovered URL is annotated with one of these four levels during Stage 0. Downstream stages (cross-check, provenance) use this annotation to reason about source authority.

## Consequences

- **Positive:** Enables systematic prioritisation of national or regional official sources over generic global aggregators.
- **Positive:** Provenance records carry a precise geographic scope for each extracted value.
- **Neutral:** Affects `sources` table schema and METHODOLOGY.md documentation.
- **Negative/Risk:** Discovery LLM must classify sources reliably; misclassification propagates silently into provenance records.
