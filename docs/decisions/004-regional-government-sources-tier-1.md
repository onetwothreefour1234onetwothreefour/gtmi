# 004: Regional Government Sources Classified as Tier 1

**Status:** Accepted  
**Date:** 2026-04-19

## Context

The source model uses three tiers of authority:

- **Tier 1 — Official government sources:** Immigration authorities, tax authorities, ministries, official gazettes, statistics bureaux. Used as primary extraction sources.
- **Tier 2 — Law firm commentary:** Fragomen, KPMG, Envoy, Baker McKenzie. Used for cross-checking only, never as primary extraction sources.
- **Tier 3 — News and editorial:** IMI Daily, Henley newsroom, Expatica, Nomad Gate. Used for policy change early-warning signals only; not used in extraction or cross-check.

The initial definition of Tier 1 covered only national-level official sources. Regional government sources — provincial ministries, state-level education bodies — were classified as Tier 2. For programs administered at the sub-national level, regional government sources are in fact the authoritative primary source, and treating them as secondary introduced unnecessary friction in validation.

## Decision

Regional government sources are classified as Tier 1 (primary sources) on equal footing with national government sources. Tier 2 is reserved for independent third-party verifiers (international ranking bodies, accreditation agencies). Tier classification is determined by source authority, not geographic scope.

## Consequences

- **Positive:** Extraction for sub-nationally administered programs uses the highest-authority source available.
- **Positive:** Cross-check logic is not inverted for regional programs.
- **Neutral:** METHODOLOGY.md tier definitions updated to reflect the revised classification.
- **Negative/Risk:** Broader Tier 1 definition increases the number of URLs entering the extraction stage, marginally increasing per-program cost.
