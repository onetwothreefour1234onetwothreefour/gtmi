# GTMI — Sub-factor weight rationales (priors)

> **Companion document to [`PLAN.md`](./PLAN.md).** Read [`TRIGGER.md`](./TRIGGER.md) first for the activation condition.

This document captures the **prior** rationale for each of the 14 sub-factor weights in methodology v6.0.0. It is a draft — every entry marked `[NEEDS SZABI REVIEW]` is genuinely undocumented in the source repository as of 2026-05-07. Surface those items to Szabi before the first sensitivity run reports findings about a sub-factor weight.

**Scope of "prior":** what the methodology designer believed when assigning the weight. The sensitivity analysis (`PLAN.md` §3) tests whether the prior holds against cohort data. If the data refutes a prior with a Tier 2 trigger (`PLAN.md` §4), the weight is revised in a methodology version bump.

**Source discipline.** Every rationale below either:

- Quotes or paraphrases METHODOLOGY.md (cited per item), or
- Cites the relevant ADR (ADR-028 through ADR-032) for the v2-v6 pillar restructures, or
- Is marked `[NEEDS SZABI REVIEW]` because no documented justification exists.

Nothing in this document is invented. Where the directional logic is documented but the specific decimal value is not, the rationale states the directional logic and marks the value itself as `[NEEDS SZABI REVIEW]`.

---

## Pillar A — Product Design (28% of PAQ)

### A.1 Qualification Threshold (50% of pillar)

**Indicators:** A.1.1 Salary % of median, A.1.2 Education, A.1.3 Experience, A.1.4 Language, A.1.5 Age cap.

**Prior.** The qualification thresholds are the primary gate determining who can apply. The methodology's Pillar A rationale (METHODOLOGY.md §1.3, "selection criteria are the single biggest determinant of real-world utility") implies that the threshold sub-factor should dominate within Pillar A — A.2 (system design) and A.3 (volume) are secondary mechanics. A 50% weight reflects "primary among three sub-factors but not absolute".

**Directional documentation:** strong (Pillar A is the most documented pillar in §1.3). **Decimal-value documentation:** `[NEEDS SZABI REVIEW]` — the precise 50% vs e.g. 45% or 55% has no published rationale.

### A.2 System Design (30% of pillar)

**Indicators:** A.2.1 # of mandatory criteria, A.2.2 Compensatory vs conjunctive, A.2.3 # of distinct qualifying tracks.

**Prior.** `[NEEDS SZABI REVIEW]`. No documented rationale in METHODOLOGY.md, ADR-028, or the seed file for assigning System Design 30% within Pillar A. The directional implication ("secondary to thresholds, primary to volume") is plausible but not stated. ADR-028 documents the _restructure_ of Pillar A but not the _weights_ of the new sub-factors.

### A.3 Volume (20% of pillar)

**Indicators:** A.3.1 Annual quota presence (single indicator, weight 100% within sub-factor).

**Prior.** `[NEEDS SZABI REVIEW]`. The single-indicator structure forces the indicator weight to 100% within A.3. The 20% sub-factor weight is undocumented. Note for Szabi: A.3.1 has the **highest single-indicator leverage on the composite** (3.92%) precisely because the sub-factor weight times the indicator weight times the pillar weight times PAQ = 0.20 × 1.00 × 0.28 × 0.70. Lowering A.3 to e.g. 15% would meaningfully reduce that leverage.

---

## Pillar B — Process Design (15% of PAQ)

### B.1 Speed (30% of pillar)

**Indicators:** B.1.1 Standard SLA (days), B.1.2 Fast-track availability.

**Prior.** `[NEEDS SZABI REVIEW]`. ADR-029 documents the v3 restructure of Pillar B into 4 sub-factors (Speed, Complexity, Cost, Transparency) but not the weight assignment between them. METHODOLOGY.md Pillar B rationale ("how hard is the application itself") implies all four sub-factors are co-load-bearing on different facets of friction; the asymmetry between 30/30 (Speed, Cost) and 20/20 (Complexity, Transparency) suggests Speed and Cost are user-facing pain while Complexity and Transparency are operational quality, but this is not stated in any document.

### B.2 Complexity (20% of pillar)

**Indicators:** B.2.1 # of mandatory application steps, B.2.2 # of in-person touchpoints.

**Prior.** `[NEEDS SZABI REVIEW]`. No documented rationale. Same observation as B.1: the 20% weight (lower than B.1 Speed and B.3 Cost) is consistent with treating complexity as a secondary friction factor — the candidate experiences cost and time directly, whereas complexity is mostly admin overhead — but the document does not say so.

### B.3 Cost (30% of pillar)

**Indicators:** B.3.1 Total applicant cost USD (single indicator, 100% within sub-factor).

**Prior.** `[NEEDS SZABI REVIEW]`. METHODOLOGY.md Pillar B rationale mentions "cost" as one of four friction facets but does not justify its 30% weight. Note for Szabi: B.3.1 carries the **second-highest single-indicator leverage** on the composite (3.15%). Same single-indicator-sub-factor concentration risk as A.3.1 — a missing-data event on B.3.1 zeroes out 3% of the composite via the sqrt penalty.

### B.4 Transparency (20% of pillar)

**Indicators:** B.4.1 Appeal/refusal process clarity, B.4.2 Application status tracking.

**Prior.** `[NEEDS SZABI REVIEW]`. ADR-029 introduced the Transparency sub-factor in v3.0.0 as a new addition (replacing the v2 "online application availability" indicator). The 20% weight is undocumented. Note: Transparency is conceptually about institutional quality (does the programme tell you what's happening), which overlaps with Pillar E Performance Outcomes. A correlation analysis (B7) should flag any high cross-pillar correlation here.

---

## Pillar C — Benefits (20% of PAQ)

### C.1 Work Flexibility (40% of pillar)

**Indicators:** C.1.1 Employer switching, C.1.2 Self-employment, C.1.3 Visa duration & renewability.

**Prior.** `[NEEDS SZABI REVIEW]`. ADR-030 documents the v4 rename of Pillar C from "Rights" to "Benefits" but does not justify the 40% weight on Work Flexibility. METHODOLOGY.md Pillar C rationale ("practical experience drives offer acceptance and retention") implies that the day-one experience matters most, which would put Work Flexibility and Family on equal footing — consistent with the C.1=C.2=40% pattern, but not derived from explicit reasoning.

### C.2 Family (40% of pillar)

**Indicators:** C.2.1 Spouse inclusion & work access, C.2.2 Dependent child age cap, C.2.3 Extended family inclusion.

**Prior.** `[NEEDS SZABI REVIEW]`. Same comment as C.1 — the 40/40 pairing of Work Flexibility and Family is undocumented but defensible as "the two facets of the visa-as-experienced".

### C.3 Social Access (20% of pillar)

**Indicators:** C.3.1 Public healthcare, C.3.2 Public education for children.

**Prior.** `[NEEDS SZABI REVIEW]`. ADR-030 documents the v4 sub-factor structure. The 20% weight on Social Access is plausible as "second-tier benefit — kicks in over time, not on day one — and depends on national systems outside the visa programme's control" but this is not stated in any document. Note: C.3.2 (education) is country-substituted via OECD high-income default in some cases (ADR-014); analysts should be alert that some C.3 scores are derived rather than directly extracted.

---

## Pillar D — Pathway (22% of PAQ)

### D.1 Permanent Residency (40% of pillar)

**Indicators:** D.1.1 PR pathway available (boolean), D.1.2 Years to PR.

**Prior.** ADR-031 documents the v5 collapse of Pillar D from 11 indicators to 5 across two sub-factors (PR + Citizenship), retiring the Tax sub-factor entirely. The 40/60 split between PR and Citizenship is not stated in ADR-031 but the methodology's framing of D as "where the visa leads — the candidate is choosing a future" (METHODOLOGY.md §1.3) implies that the **terminal outcome** (citizenship) carries more weight than an intermediate step (PR). 40% on PR reflects "PR is a stepping stone with real utility but secondary to the terminal goal".

**Directional documentation:** moderate (the directional logic is implicit in §1.3). **Decimal-value documentation:** `[NEEDS SZABI REVIEW]` — the 40 vs e.g. 35 or 45 is undocumented.

### D.2 Citizenship (60% of pillar)

**Indicators:** D.2.1 Citizenship pathway boolean, D.2.2 Years to citizenship, D.2.3 Dual citizenship permitted.

**Prior.** Citizenship is the terminal outcome of the mobility journey; D.2 weighted higher than D.1 reflects "the destination matters more than the intermediate stop". Together with the methodology's framing of Pillar D as the "future" pillar (METHODOLOGY.md §1.3, "the candidate is choosing a future"), this puts citizenship at the center of Pillar D's measurement.

**Note on leverage:** D.2 is the **most concentrated leverage in the methodology**. D.2.1 + D.2.2 + D.2.3 together account for 9.24% of composite. D.2.1 and D.2.2 are tied for second-highest single-indicator leverage at 3.70% each. A combined extraction error in citizenship pathway data has the largest rank impact of any sub-factor in the index. Sensitivity analysis B5 (per-indicator dropout) and B7 (correlation) should pay particular attention to this sub-factor.

**Directional documentation:** moderate. **Decimal-value documentation:** `[NEEDS SZABI REVIEW]`.

---

## Pillar E — Performance Outcomes (15% of PAQ)

### E.1 Track Record (50% of pillar)

**Indicators:** E.1.1 Program age (years, capped at 20), E.1.2 Cumulative approvals or active visa holders.

**Prior.** ADR-032 documents the v6 collapse of Pillar E from 8 indicators across 3 sub-factors to 4 indicators across 2 sub-factors, retiring the World Bank WGI / V-Dem ingestion path. Track Record (E.1) and Rule Stability (E.2) are framed as the two halves of "how reliable is this promise" — programme history (track record) and rule constancy (stability). 50/50 reflects co-equal contribution: a long history with frequent rule changes is no more reliable than a short history with stable rules.

**Directional documentation:** strong (the equal weighting is stated in METHODOLOGY.md §5 Pillar E table). **Decimal-value documentation:** the 50/50 split is consistent with the equal-weighting prior; any deviation from 50/50 would need justification.

### E.2 Rule Stability (50% of pillar)

**Indicators:** E.2.1 Material policy changes in last 5 years (severity-weighted), E.2.2 Programme suspension or abrupt closure history (10-year boolean).

**Prior.** Co-equal with Track Record per the framing above. Rule Stability captures the predictability dimension; Track Record captures the longevity / scale dimension. Both are equally consequential for "reliability of the contract over time".

**Note:** ADR-032 retired the WGI / V-Dem external indices entirely. Pillar E v6 is sourced exclusively from Tier 1 government data (E.1.1, E.1.2 from program registry; E.2.1, E.2.2 from policy-change history). This reduces the cross-pillar correlation risk between Pillar E and other pillars (the WGI / V-Dem signals were country-level, which would have correlated with anything else country-driven).

**Directional documentation:** strong. **Decimal-value documentation:** consistent with the equal-weighting prior.

---

## Summary table for Szabi review

| Sub-factor                  | Weight | Prior strength                               | Action                 |
| --------------------------- | ------ | -------------------------------------------- | ---------------------- |
| A.1 Qualification Threshold | 50%    | Directional documented; decimal undocumented | Review decimal         |
| A.2 System Design           | 30%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| A.3 Volume                  | 20%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| B.1 Speed                   | 30%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| B.2 Complexity              | 20%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| B.3 Cost                    | 30%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| B.4 Transparency            | 20%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| C.1 Work Flexibility        | 40%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| C.2 Family                  | 40%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| C.3 Social Access           | 20%    | **Undocumented**                             | `[NEEDS SZABI REVIEW]` |
| D.1 Permanent Residency     | 40%    | Directional documented; decimal undocumented | Review decimal         |
| D.2 Citizenship             | 60%    | Directional documented; decimal undocumented | Review decimal         |
| E.1 Track Record            | 50%    | Documented (equal weighting)                 | Review                 |
| E.2 Rule Stability          | 50%    | Documented (equal weighting)                 | Review                 |

**10 of 14 sub-factor weights have no documented rationale at all.** Before the first sensitivity run reports any finding involving a sub-factor weight, those 10 entries should be either (a) given a documented rationale (with an ADR if formal) or (b) explicitly accepted as undocumented and that fact disclosed in the public methodology page sensitivity section.

---

## Reading discipline for the sensitivity-runner author

When B1 (Monte Carlo), B3 (pillar weight alternatives), or B4 (sub-factor weight alternatives) reports that perturbing a weight changes the rank order:

- If the affected weight has a **documented prior**, the finding is evidence the prior is wrong → trigger the appropriate Tier from `PLAN.md` §4.
- If the affected weight has a `[NEEDS SZABI REVIEW]` marker, the finding is evidence that **the weight needs documenting**, not necessarily that it needs revising. The ADR resulting from a Tier 2 trigger must establish a prior first, then either confirm or revise.

This is the formal mechanism by which sensitivity analysis converts undocumented intuition into either documented prior or empirical revision.

---

_Authored 2026-05-07 against methodology v6.0.0. Maintain in lock-step with `packages/db/src/seed/methodology-v1.ts:51` (sub_factor_weights) and `packages/scoring/src/score.ts:23` (SUB_FACTOR_WEIGHTS)._
