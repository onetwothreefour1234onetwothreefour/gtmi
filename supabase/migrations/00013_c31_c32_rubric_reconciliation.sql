-- 00013_c31_c32_rubric_reconciliation.sql
--
-- Phase 3.8 / P0 follow-up to commit fd590f8 — align the live
-- `field_definitions` rows for C.3.1 and C.3.2 with the reconciled
-- methodology seed. Migration 00009/00010 updated `normalization_fn` /
-- `data_type` for the Phase 3.5 restructures but never touched
-- `scoring_rubric_jsonb` or `extraction_prompt_md`, so the live rows
-- still carry the legacy v1 vocabulary. This causes:
--
--   - C.3.2: rubric on the row says {full_access, fee_based, limited,
--     no_access} but the substitute path writes {automatic, fee_paying}
--     and the engine throws "Categorical value 'automatic' not found
--     in rubric" on any reverse-lookup path.
--   - C.3.1: re-seed would throw because `automatic` /
--     `conditional_rhca` aliases were added inline to the rubric in a
--     later edit but never written to the live row.
--
-- Reversible: re-run the previous applyRubricScores from rubric-scores.ts
-- against the v1 prompts (kept verbatim in methodology-v1.ts pre-fd590f8).

-- C.3.2 — replace rubric with the reconciled 4-value set. Scores match
-- REGIONAL_SUBSTITUTES (100 / 40) and the analyst-set gradient (20 / 0).
UPDATE "field_definitions"
SET "scoring_rubric_jsonb" = jsonb_build_object(
  'categories', jsonb_build_array(
    jsonb_build_object(
      'value', 'automatic',
      'score', 100,
      'description', 'public schooling available on the same basis as citizens/PRs.'
    ),
    jsonb_build_object(
      'value', 'fee_paying',
      'score', 40,
      'description', 'access available but foreign-student or fee-paying levy applies.'
    ),
    jsonb_build_object(
      'value', 'restricted',
      'score', 20,
      'description', 'case-by-case basis or local-authority approval, not guaranteed.'
    ),
    jsonb_build_object(
      'value', 'none',
      'score', 0,
      'description', 'no access to public education.'
    )
  )
)
WHERE "key" = 'C.3.2';
--> statement-breakpoint

-- C.3.1 — backfill the `automatic` and `conditional_rhca` aliases that
-- were added inline to methodology-v1.ts after the initial seed. Scores
-- mirror the inline values in methodology-v1.ts (100 and 70).
UPDATE "field_definitions"
SET "scoring_rubric_jsonb" = jsonb_build_object(
  'categories', jsonb_build_array(
    jsonb_build_object('value', 'full_access',        'score', 100, 'description', 'same basis as citizens/PRs.'),
    jsonb_build_object('value', 'automatic',          'score', 100, 'description', 'same basis as citizens/PRs (alias of full_access).'),
    jsonb_build_object('value', 'conditional_rhca',   'score', 70,  'description', 'access contingent on a reciprocal/bilateral health agreement.'),
    jsonb_build_object('value', 'levy_required',      'score', 70,  'description', 'access upon payment of a health levy/contribution.'),
    jsonb_build_object('value', 'insurance_required', 'score', 50,  'description', 'access contingent on private insurance.'),
    jsonb_build_object('value', 'emergency_only',     'score', 20,  'description', 'only emergency care covered publicly.'),
    jsonb_build_object('value', 'no_access',          'score', 0,   'description', 'no public healthcare access.')
  )
)
WHERE "key" = 'C.3.1';
--> statement-breakpoint

-- C.3.2 prompt — switch the "Allowed values" enumeration from the legacy
-- v1 vocabulary (full_access / fee_based / limited / no_access) to the
-- reconciled set. The Phase 3.5 prompt in methodology-v2.ts uses the
-- new vocabulary; sync-prompts-from-seed.ts --source v2 is the canonical
-- way to refresh this column going forward, but a one-shot UPDATE here
-- avoids a manual script run during deploy.
UPDATE "field_definitions"
SET "extraction_prompt_md" = regexp_replace(
  "extraction_prompt_md",
  E'Allowed values:\\s*\\n\\s*\\n"full_access".*?"no_access":[^\\n]*\\n',
  E'Allowed values:\n\n"automatic": public schooling available on the same basis as citizens/PRs (no extra fees).\n"fee_paying": access available but foreign-student or fee-paying levy applies.\n"restricted": case-by-case basis or local-authority approval, not guaranteed.\n"none": no access to public education.\n',
  'sn'
)
WHERE "key" = 'C.3.2';
--> statement-breakpoint

-- Existing field_values rows for C.3.2 may carry the legacy vocabulary
-- in valueRaw. Force them to pending_review with valueIndicatorScore=null
-- so the new rubric gate routes them through analyst review on next
-- read. Substitute-written rows (provenance.extractionModel =
-- 'country-substitute-regional') already use the new vocabulary; leave
-- those approved.
UPDATE "field_values"
SET "status" = 'pending_review',
    "value_indicator_score" = NULL
WHERE "field_definition_id" = (SELECT id FROM "field_definitions" WHERE "key" = 'C.3.2')
  AND ("provenance"->>'extractionModel') IS DISTINCT FROM 'country-substitute-regional'
  AND "value_raw" IN ('full_access', 'fee_based', 'limited', 'no_access');
