# ADR-019 — Rubric-validation gate at publish + bulk-approve

**Status:** Proposed (Phase 3.7 — review-tab improvements, idea 3 of 3).
**Date:** 2026-04-29
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

The analyst observed that "a lot of raw values do not match the required input." A live diagnostic on 2026-04-29 confirms two distinct symptoms.

### Symptom A — Coverage-gap sentinels leak into approved rows

Two categorical fields hold approved/pending rows whose `valueRaw` is not in the published rubric:

| field                              | rubric `categories[].value`                                                         | bad raws        | rows            | status         |
| ---------------------------------- | ----------------------------------------------------------------------------------- | --------------- | --------------- | -------------- |
| **C.3.1** Public healthcare access | `full_access`, `levy_required`, `insurance_required`, `emergency_only`, `no_access` | `not_stated`    | 3 of 4 approved | **approved**   |
| **E.2.2** Published quota / cap    | `no_cap`, `published_current`, `published_historical_only`, `exists_undisclosed`    | `not_addressed` | 2 of 3 pending  | pending_review |

The publish-stage code (`packages/extraction/src/stages/publish.ts:425-433`) already drops `not_addressed` and `not_found` for categorical fields — those are coverage-gap sentinels. But:

- `not_stated` is INTENTIONALLY published with `value_raw='not_stated'` + `status='pending_review'` + `value_indicator_score=null` (publish.ts lines 443-487). The intent: "field exists, source page silent — analyst should replace at /review."
- The bulk-approve gate (`bulkApproveHighConfidence` in `apps/web/app/(internal)/review/actions.ts`) approves any row with `extractionConfidence ≥ 0.85` AND `validationConfidence ≥ 0.85`. It does NOT check whether `valueRaw` is in the rubric. So a high-confidence `not_stated` extraction (the LLM is "confident" the page is silent) gets bulk-approved into the public score.
- The 3 C.3.1 approved rows fell through this gate. They will skew/distort the public composite if the scoring engine ever tries to look up `not_stated` in the categorical rubric.

### Symptom B — `value_indicator_score` is mostly NULL

```
extractionModel               rows  with value_indicator_score
claude-sonnet-4-6             109   0
derived-knowledge             15    0
derived-computation           5     0
world-bank-api-direct         4     0
country-substitute-regional   3     3
v-dem-api-direct              3     0
```

136 of 139 rows have `value_indicator_score = NULL`. Only `country-substitute-regional` populates it. This is _not_ a scoring bug — `runScoringEngine` consumes `valueNormalized` and produces composite scores at score-time without reading `value_indicator_score`. But the column is mostly dead weight, which obscures debugging ("did this row score?" can only be answered by re-running the engine).

### Symptom C (pre-existing) — Scrolling no-stale-data check

The numeric (min_max / z_score) and boolean fields are all clean: 0 unparseable numerics, 0 out-of-vocab booleans. So the rubric-validity gap is specifically a **categorical** problem.

---

## Decision

Add a **rubric-validation gate** at two distinct enforcement points, plus a one-time backfill of `value_indicator_score` so the column carries its weight.

### 1. Publish-time gate — `PublishStageImpl.execute`

Add the categorical rubric-key check between the `not_stated` branch and the auto-approve write:

```ts
if (fieldDef.normalizationFn === 'categorical' && fieldDef.scoringRubricJsonb?.categories) {
  const allowedValues: string[] = fieldDef.scoringRubricJsonb.categories.map(
    (c: { value: string }) => c.value
  );
  if (!allowedValues.includes(rawAsString)) {
    console.log(
      `  [${extraction.fieldDefinitionKey}] valueRaw="${rawAsString}" not in rubric ` +
        `[${allowedValues.join(', ')}] — routing to pending_review (forced)`
    );
    // override auto-approve: write status='pending_review' regardless of confidence
    forcePendingReview = true;
  }
}
```

When `forcePendingReview` is set, the publish path writes `status='pending_review'` even if the row would otherwise auto-approve. The row stays in /review until an analyst maps it to a valid rubric value (or rejects it).

### 2. Bulk-approve gate — `bulkApproveHighConfidence`

Add the same rubric check to the bulk-approve SQL filter so analysts cannot accidentally one-click approve out-of-rubric rows:

```sql
AND (
  fd.normalization_fn <> 'categorical'
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(fd.scoring_rubric_jsonb -> 'categories') AS elem
    WHERE elem ->> 'value' = fv.value_raw
  )
)
```

Per-row approve via `approveFieldValue` does NOT need the gate (the analyst is making an explicit decision).

### 3. Compute and store `value_indicator_score` at publish time

Extend `PublishStageImpl.execute` to call `runScoringEngine` **for the single row** being published — or, more cheaply, call the per-indicator scoring helper directly:

```ts
import { scoreSingleIndicator } from '@gtmi/scoring';
// after normalizeRawValue() succeeds:
const score = scoreSingleIndicator({
  fieldDefinition: fieldDef,
  valueNormalized,
  normalizationParams: PHASE2_PLACEHOLDER_PARAMS, // existing
});
// persist via INSERT VALUES ... value_indicator_score: score
```

This requires exposing `scoreSingleIndicator` from `@gtmi/scoring/index.ts` (currently the scoring helpers are internal).

The same call path runs inside `editApprovedFieldValue` (proposed in ADR-017) so edits keep the score current.

### 4. One-time backfill

`scripts/backfill-value-indicator-scores.ts` — read every approved+pending row whose `value_indicator_score IS NULL`, recompute via `scoreSingleIndicator`, write back. Idempotent. Run once.

---

## Consequences

**Pros**

- Out-of-rubric rows can never reach `status='approved'` without an explicit analyst action.
- `value_indicator_score` becomes a reliable per-row debugging field.
- Closes the C.3.1 "approved with `not_stated`" leak that the diagnostic surfaced.

**Cons**

- Marginally more work at publish time (one scoring call per row). Negligible — scoring is pure arithmetic.
- The publish gate may force-pending more rows than today, increasing the /review backlog. This is correct behaviour: rows with bad raws shouldn't auto-approve.

---

## Side cleanup

The 3 C.3.1 approved rows holding `valueRaw='not_stated'` should be reverted to `pending_review` as part of the deploy. Single SQL:

```sql
UPDATE field_values fv
SET status = 'pending_review', reviewed_at = NULL
FROM field_definitions fd
WHERE fd.id = fv.field_definition_id
  AND fd.key = 'C.3.1'
  AND fv.status = 'approved'
  AND fv.value_raw = 'not_stated';
```

---

## Out of scope (deferred)

- Coverage-gap sentinel rules for non-categorical fields (numeric `not_addressed` etc.). Not currently observed in the data.
- Server-side enum on `field_definitions.scoring_rubric_jsonb` schema. Per-rubric Zod schema validator could land later if drift becomes a real concern.
