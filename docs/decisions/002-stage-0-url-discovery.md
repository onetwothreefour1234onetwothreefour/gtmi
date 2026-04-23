# 002: Stage 0 URL Discovery Added to Pipeline

**Status:** Accepted  
**Date:** 2026-04-19

## Context

The original extraction pipeline assumed a single known source URL per program and began at the scraping stage. In practice, programs spread relevant data across multiple pages (admissions, fees, visa, ranking), none of which are known in advance. Starting from a fixed URL produced incomplete extractions and required manual registry maintenance.

## Decision

Add a Stage 0 (URL Discovery) as the first stage of the pipeline, executed before scraping. Stage 0 takes a program name and country as inputs, queries a discovery LLM, and returns a ranked list of URLs classified by tier and geographic level. The pipeline now has 7 stages: Discover → Scrape → Extract → Validate → Cross-check → Human Review → Publish.

## Consequences

- **Positive:** The pipeline is self-seeding; no manual URL registry is required per program.
- **Positive:** Discovery output carries tier and geographic metadata used by downstream stages.
- **Neutral:** Pipeline stage count increases from 5 to 7; BRIEF.md and job implementation updated accordingly.
- **Negative/Risk:** An additional LLM call per program increases latency and cost at the start of each run.
