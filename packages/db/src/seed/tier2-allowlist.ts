/**
 * Phase 3.4 / ADR-013 — Tier 2 backfill allowlist.
 *
 * Indicator codes for which a Tier 2 (law-firm / advisory) source MAY
 * populate `field_values` if the Tier 1 extraction returns empty.
 *
 * The allowlist is enforced at the DB-row level by the
 * `field_definitions.tier2_allowed BOOLEAN` column (migration 00008).
 * The constant below mirrors that DB state for code that needs to know
 * which fields are allowlisted (the future extraction-stage Tier 2
 * fallback path, the dashboard badge logic if it ever reads the seed
 * directly, the apply script).
 *
 * The allowlist is intentionally short. See ADR-013 for the rationale
 * per indicator and the eligibility rule (only fields outside the
 * scoring core where Tier 1 is structurally silent).
 *
 * Cross-checked against `docs/phase-3/baseline-gaps.csv` on 2026-04-27:
 *   B.3.3 — CAN LLM_MISS, SGP POPULATED, AUS ABSENT.
 *   C.2.4 — CAN LLM_MISS, SGP POPULATED, AUS ABSENT.
 *   D.2.3 — CAN LLM_MISS, SGP ABSENT, AUS ABSENT.
 *
 * The CAN LLM_MISS cases are addressed first by Phase 3.3 prompt
 * rewrites (which were also pushed live). Tier 2 backfill only fires
 * if those prompts still return empty on the next canary.
 *
 * The originally-proposed fourth allowlist entry, C.2.3 (parent /
 * extended family inclusion), was REMOVED from this list because the
 * Phase 3 gap register cross-check showed it is POPULATED in all three
 * canaries — there is no coverage gap to fill.
 */

export const TIER2_BACKFILL_ALLOWLIST: readonly string[] = Object.freeze([
  'B.4.1', // Appeal and refusal process clarity (methodology v3.0.0; was B.3.3)
  'C.2.4', // Same-sex partner recognition
  'D.2.3', // Dual citizenship permitted
]);
