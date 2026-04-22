/**
 * Canonical 0-100 scores for every categorical rubric value in GTMI methodology v1.
 *
 * These scores are applied at scoring time by `normalizeCategorical` (packages/scoring).
 * Keep in parity with docs/METHODOLOGY.md category intent and the `direction` field.
 *
 * For `higher_is_better` rubrics: best category → 100, worst → 0.
 * For `lower_is_better` rubrics: best (least burdensome) category → 100, worst → 0.
 */
export const RUBRIC_SCORES: Record<string, Record<string, number>> = {
  'A.1.3': {
    salary_only: 0,
    salary_plus_one: 50,
    salary_plus_multiple: 100,
    no_salary_route: 75,
  },
  'A.2.1': {
    none: 100,
    secondary: 80,
    vocational: 60,
    bachelor: 40,
    master: 20,
    doctorate: 0,
  },
  'A.2.3': {
    none: 100,
    basic: 75,
    intermediate: 50,
    upper_intermediate: 25,
    advanced: 0,
  },
  'A.3.1': {
    open: 100,
    broad_list: 75,
    restricted_list: 40,
    shortage_list_only: 15,
  },
  'A.3.2': {
    no_quota: 100,
    large_quota: 80,
    moderate_quota: 50,
    tight_quota: 20,
    quota_undisclosed: 30,
  },
  'B.1.2': {
    none: 0,
    available_slow: 50,
    available_fast: 100,
    available_undisclosed_sla: 30,
  },
  'B.3.1': {
    fully_online: 100,
    mostly_online: 70,
    hybrid: 40,
    offline_only: 0,
  },
  'B.3.3': {
    comprehensive: 100,
    substantive: 75,
    basic: 50,
    limited: 25,
    absent: 0,
  },
  'C.1.1': {
    not_required: 100,
    required_initial_only: 60,
    required_throughout: 0,
  },
  'C.1.2': {
    free_switching: 100,
    notification_only: 70,
    re_application: 30,
    not_permitted: 0,
  },
  'C.1.3': {
    full_rights: 100,
    limited_secondary: 65,
    permitted_with_permission: 35,
    prohibited: 0,
  },
  'C.2.1': {
    automatic_with_full_work_rights: 100,
    automatic_with_limited_work_rights: 75,
    automatic_no_work_rights: 50,
    by_permit_with_work_rights: 65,
    by_permit_no_work_rights: 25,
    not_permitted: 0,
  },
  'C.3.1': {
    full_access: 100,
    levy_required: 70,
    insurance_required: 50,
    emergency_only: 20,
    no_access: 0,
  },
  'C.3.2': {
    full_access: 100,
    fee_based: 60,
    limited: 30,
    no_access: 0,
  },
  'D.2.4': {
    none: 100,
    light: 70,
    moderate: 40,
    heavy: 0,
  },
  'D.3.2': {
    none: 0,
    time_limited_bonus: 50,
    time_limited_flat_rate: 65,
    non_dom: 80,
    indefinite_preferential: 100,
  },
  'D.3.3': {
    worldwide: 0,
    worldwide_with_remittance_basis: 60,
    territorial: 100,
    hybrid: 40,
  },
  'E.2.2': {
    no_cap: 100,
    published_current: 90,
    published_historical_only: 60,
    exists_undisclosed: 20,
    // "not_addressed" intentionally removed — represents coverage gap, not data.
    // Publish stage routes valueRaw === "not_addressed" to ABSENT (no row written).
  },
  'E.2.3': {
    comprehensive: 100,
    substantive: 75,
    basic: 50,
    minimal: 25,
    absent: 0,
  },
};
