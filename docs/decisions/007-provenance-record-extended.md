# 007: Provenance Record Extended with Geographic Level and Source Tier

**Status:** Accepted  
**Date:** 2026-04-19

## Context

The original provenance record stored the source URL, extraction model, confidence scores, and review decision for each published field value. With the adoption of the geographic source level model (ADR-003) and multi-URL extraction (ADR-005), source URL alone is insufficient to reconstruct why a particular source was chosen. Auditors and downstream consumers need to know the geographic scope and authority tier of the source at the time of extraction.

## Decision

Extend the provenance JSONB record stored in `field_values.provenance` with two additional fields: `geographicLevel` (one of `global`, `continental`, `national`, `regional`) and `sourceTier` (1 or 2). Both fields are populated from the Stage 0 discovery metadata and written at the Publish stage alongside the existing provenance fields.

## Consequences

- **Positive:** Provenance records are self-contained; no join to a discovery log is needed to understand source authority.
- **Positive:** Enables future filtering and quality analysis by geographic scope or tier.
- **Neutral:** Affects the `field_values.provenance` JSONB schema; existing records written before this change will lack these two fields.
- **Negative/Risk:** Schema is untyped JSONB; a future migration or Zod schema enforcement step should validate that all records conform.
