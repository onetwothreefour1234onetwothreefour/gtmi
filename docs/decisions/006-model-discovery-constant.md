# 006: MODEL_DISCOVERY Dedicated Constant for URL Discovery Stage

**Status:** Accepted  
**Date:** 2026-04-19

## Context

Stage 0 (URL Discovery) uses a language model to generate and rank candidate URLs. The optimal model for URL discovery differs from the model used for field extraction: discovery benefits from broad web knowledge and fast latency, while extraction prioritises faithfulness to scraped content. Without a dedicated constant, the discovery model string was either duplicated across the codebase or conflated with the extraction model constant, making it error-prone to update independently.

## Decision

Introduce a `MODEL_DISCOVERY` constant in the extraction package, separate from any extraction model constants. All discovery stage code references `MODEL_DISCOVERY` exclusively. The extraction stage uses its own constant. The two can be updated independently.

This pattern was subsequently extended: `MODEL_VALIDATION` (Stage 3) and `MODEL_CROSSCHECK` (Stage 4) constants were added by the same rationale — both set to `claude-sonnet-4-6` and independently updatable without touching extraction or discovery model choices. All four constants are exported from `packages/extraction/src/clients/anthropic.ts`.

## Consequences

- **Positive:** Discovery and extraction model choices are decoupled; each can be tuned or upgraded without affecting the other.
- **Positive:** A single constant change propagates to all discovery calls.
- **Neutral:** Minor addition noted in BRIEF.md.
- **Negative/Risk:** None significant; this is a low-risk implementation detail.
