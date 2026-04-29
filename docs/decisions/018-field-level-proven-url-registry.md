# ADR-018 — Field-level proven-URL registry for self-improving re-discovery

**Status:** Proposed (Phase 3.7 — review-tab improvements, idea 2 of 3).
**Date:** 2026-04-29
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

The analyst flagged that "URLs are not being linked to the exact values that they are finding for each program. They for sure need to be linked so if we do a refresh, it will know automatically where to look."

### What's actually stored today

- **`field_values.provenance.sourceUrl`** carries the URL that produced the value, at row-level granularity. **137/137 approved+pending rows** in the live DB have this populated. The data is there.
- **`sources` table** stores URL × programId pairs (with `tier`, `is_primary`, `discovered_by`). It does NOT store URL × field_key. It is the registry that `loadProgramSourcesAsDiscovered` reads at re-run time.
- **`extraction_cache`** is keyed by `(content_hash, field_key, prompt_md)`. It avoids re-paying for identical content but is not a discovery aid.

### Where the chain breaks

`scripts/canary-run.ts` discovery merge loads:

1. **Fresh** Stage-0 URLs (LLM-discovered this run).
2. **Registry** URLs from the `sources` table for the same program — _no field linkage_.
3. **Proven** URLs from `loadProvenUrlsForMissingFields` — _only across other programs in the same country_.

There is no "for field B.2.1 on programme X, last run produced an approved value at URL Y — try Y first" fast path. Re-runs rediscover from scratch.

### Diagnostic snapshot (2026-04-29)

```
program                                            sources  proven URLs (in field_values)
AUS Skills in Demand 482 — Core Skills Stream      28       14
CAN Express Entry — Federal Skilled Worker         7        7
GBR Skilled Worker Visa                            1        2  ← 1 proven URL not in sources
SGP S Pass                                         16       10
```

Two patterns are visible:

1. **Sources bloat (AUS, SGP):** the registry has more URLs than have actually proven anything. Re-runs scrape unproven URLs at cost.
2. **Sources leak (GBR):** an approved row points at a URL that is _not_ in the sources registry. Next run's discovery merge will not see that URL — the proof is invisible to the orchestrator.

In both directions the orchestrator's discovery loop is misaligned with the field-level evidence already on disk.

---

## Decision

Add a **field-level proven-URL view** that the discovery merge consumes as the highest-priority pre-loaded URL set. Field-aware, same-program-aware, and append-only — three properties the current `sources` table does not have.

### Schema option (preferred — pure DB view, no migration)

Create a Postgres VIEW (or a CTE inside `loadProvenUrlsForMissingFields`'s replacement) that derives field-level proven URLs from `field_values.provenance`:

```sql
CREATE VIEW v_proven_field_urls AS
SELECT
  fv.program_id,
  p.country_iso,
  fd.key                          AS field_key,
  fd.id                           AS field_definition_id,
  fv.provenance->>'sourceUrl'     AS url,
  (fv.provenance->>'sourceTier')::int AS tier,
   fv.provenance->>'geographicLevel'  AS geographic_level,
  fv.status,
  fv.extracted_at,
  (fv.provenance->>'extractionConfidence')::float AS extraction_confidence
FROM field_values fv
JOIN field_definitions fd ON fd.id = fv.field_definition_id
JOIN programs p          ON p.id = fv.program_id
WHERE fv.status IN ('approved', 'pending_review')
  AND fv.provenance->>'sourceUrl' IS NOT NULL
  AND fv.provenance->>'sourceUrl' NOT LIKE 'derived%'
  AND fv.provenance->>'sourceUrl' NOT LIKE 'internal:%'
  AND fv.provenance->>'sourceUrl' NOT LIKE 'https://api.worldbank.org/%';
```

The view is read-only and self-maintaining: every approved or pending field-value with real provenance shows up in it.

### Code option — extend `loadProvenUrlsForMissingFields`

Update the helper signature to also pull **same-program** prior URLs, with field-level priority:

```ts
loadProvenUrlsForMissingFields(
  programId: string,
  countryIso: string,
  missingFieldKeys: string[],
  options?: { sameProgram?: boolean; cap?: number }
): Promise<DiscoveredUrl[]>
```

When `sameProgram: true` (the default for re-runs), the SQL drops the `fv.program_id <> ${programId}` exclusion and prefers same-program URLs. The returned `DiscoveredUrl` carries a `reason: "Field-proven — produced ${approved | pending} value for ${field_key} in this programme on ${date}"`.

### Discovery merge change (`scripts/canary-run.ts:330-336`)

```ts
const fieldProvenUrls = await loadProvenUrlsForMissingFields(
  programId,
  countryIso,
  missingFieldKeys,
  { sameProgram: true }
);
const otherProgUrls = await loadProvenUrlsForMissingFields(
  programId,
  countryIso,
  missingFieldKeys,
  { sameProgram: false }
);
const registryUrls = await loadProgramSourcesAsDiscovered(programId);

const merged = mergeDiscoveredUrls({
  freshFromStage0: discoveryResult.discoveredUrls,
  fromFieldProven: fieldProvenUrls, // NEW — highest priority
  fromSourcesTable: registryUrls,
  fromProvenance: otherProgUrls,
  cap,
  quotas,
});
```

`mergeDiscoveredUrls` priority order becomes: **fresh > field-proven (same program) > registry > field-proven (other program) > proven (cross-program legacy)**. Dedup keeps the highest-priority entry.

### Side benefit — `sources` table cleanup

With the view in place, the `sources` table can be downgraded to "Stage-0-and-seed-only" — every long-term truth lives on `field_values.provenance`. A follow-up cleanup ADR may delete unused rows or stop appending, but that's out of scope here.

---

## Targeted re-run impact

`PHASE3_TARGETED_RERUN=true` already filters Stage 0 to missing fields. With this ADR:

- Targeted re-runs would prefer **the URL that last produced a value** (even a pending one — the LLM was on the right page, just not confident enough), eliminating wasted scrapes of dud URLs.
- A field that was `pending_review` from URL X gets retried on X first; if it fails again, normal Stage 0 proceeds.

Concrete example from the 2026-04-29 CAN FSW re-run: B.2.1 (principal applicant fees) was LLM_MISS; the fees.html URL is in the sources registry but the orchestrator did not prioritise it for the targeted re-run. With ADR-018, B.2.1 would top-priority retry on the historical proven-or-attempted fees URL.

---

## Consequences

**Pros**

- Self-improving by construction: every approved row makes the next re-run smarter without a separate registration step.
- Closes the GBR-style leak (proven URL not in sources).
- Reduces wasted scrapes against unproven `sources` rows (AUS / SGP bloat).

**Cons**

- The view query joins three tables (`field_values`, `field_definitions`, `programs`) and filters on JSONB. With current row counts (~140) it's trivially fast; at 30-country × 90-program scale it'll need an expression index on `(provenance->>'sourceUrl')`. Trivial follow-up.
- "Proven" includes `pending_review` too, which means a low-confidence URL gets re-tried first. The Stage 0 LLM still has the option to reject it, so this is graceful degradation, not a regression.

---

## Out of scope (deferred)

- Sources-table garbage collection (delete rows that haven't proven anything in N runs).
- Per-field URL TTL (proven URL stops being re-tried after `extracted_at + 90 days`).
