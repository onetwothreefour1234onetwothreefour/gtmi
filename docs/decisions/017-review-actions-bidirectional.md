# ADR-017 — Bidirectional review actions: edit-after-approve and re-reject

**Status:** Proposed (Phase 3.7 — review-tab improvements, idea 1 of 3).
**Date:** 2026-04-29
**Authors:** Szabi (analyst spec) + pipeline notes.

---

## Context

The current `/review` action surface is one-shot and irreversible:

- `apps/web/app/(internal)/review/[id]/page.tsx:218` gates the approve + reject form on `isPending`. Approved or rejected rows show only a `<StatusBanner>` — no editor, no path back.
- Server actions (`approveFieldValue`, `rejectFieldValue`, `bulkApproveHighConfidence` in `apps/web/app/(internal)/review/actions.ts`) only support `pending_review → approved | rejected`. There is no `editApprovedFieldValue`, no `unapproveFieldValue`, no `rejectAfterApproval`.
- The `field_values.status` column is `varchar(50)` with no DB-level state-machine constraint — bidirectional transitions are mechanically possible.

### Diagnostic snapshot (2026-04-29)

```
status           rows  reviewedAt set  reviewedBy set
approved         61    61              0
pending_review   76    0               0
rejected         2     2               0
```

61 approved rows have no recourse if the analyst spots a mistake on a re-read; the only out is direct DB editing. Two rejected rows have no path back if the analyst changes their mind. This is the gap the analyst flagged.

---

## Decision

Make the review action surface **idempotent and bidirectional**, mirroring how editorial workflows actually run (typo on first pass → fix later; reviewer disagrees with prior call → re-decide).

### State machine (additive — no schema change)

```
pending_review ──approve──▶ approved ──edit / unapprove / reject──┐
       ▲                       │                                  │
       │                       └────re-pending────▶ pending_review ─┘
       │                                                           │
       └────────────────────re-pending───────── rejected ◀──reject─┘
```

Status remains the existing `varchar(50)` enum-by-convention; transitions are write-allowed in any direction.

### New / extended server actions (`apps/web/app/(internal)/review/actions.ts`)

| Action                                          | Allowed source statuses  | Effect                                                                                                           |
| ----------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `approveFieldValue(id, editedRaw?)`             | any                      | sets `status='approved'`, optionally rewrites `valueRaw` + `valueNormalized`, stamps `reviewedAt = now()`        |
| `rejectFieldValue(id, reason?)`                 | any                      | sets `status='rejected'`, stamps `reviewedAt = now()`, persists optional `reason` into `provenance.rejectReason` |
| `editApprovedFieldValue(id, editedRaw)` _(new)_ | `approved`               | rewrites `valueRaw` + re-runs `normalizeRawValue` + stamps `reviewedAt`, status stays `approved`                 |
| `unapproveFieldValue(id)` _(new)_               | `approved` \| `rejected` | sets `status='pending_review'`, clears `reviewedAt`, leaves `valueRaw` untouched                                 |
| `bulkApproveHighConfidence()`                   | `pending_review`         | unchanged                                                                                                        |

`approveFieldValue` and `rejectFieldValue` both relax their from-state guards (currently implicit via the UI gate) to accept any starting status. The UI is the one that decides which control to show; the action accepts what the UI sends.

### UI changes (`apps/web/app/(internal)/review/[id]/page.tsx`)

- Remove the `isPending` gate around the `<form action={approve}>` + `<form action={reject}>` block. Always show the editor.
- Render a status-aware action set:
  - **pending_review** — current behaviour (Approve / Reject).
  - **approved** — show `Edit` (re-runs the approve action with new `editedRaw`), `Reject`, and `Re-pend` (calls `unapproveFieldValue`).
  - **rejected** — show `Re-pend` and `Approve` (treats the rejected row as a do-over).
- The `<StatusBanner>` stays — it just becomes a header above the editor, not a replacement for it.

### Audit trail

Every status mutation already stamps `reviewedAt`. Add an append-only `review_history` table in a follow-up ADR if the analyst wants a full transition log — out of scope for this ADR (keep the change minimal).

### `review_queue` table

The reject/approve transactions already update `review_queue.status` in lockstep. Extending bidirectional transitions: when a row leaves `approved` or `rejected` back to `pending_review`, also reset the `review_queue.status` to `'pending_review'` and clear `resolvedAt`. If no `review_queue` row exists for the field-value (e.g. the row was published auto-approved without ever being queued), a `re-pend` should INSERT one so it shows up in the pending list again.

---

## Consequences

**Pros**

- Analyst can correct mistakes without DB access.
- Matches the natural editorial workflow.
- No schema migration needed.

**Cons**

- A row's audit trail is currently just `reviewedAt` (one timestamp); bidirectional flips overwrite it. The follow-up `review_history` ADR would close this.
- Without reviewer attribution (post-Supabase-auth-removal, `reviewedBy` is always `null`), there's no record of _who_ flipped what. Must be solved at the IAM layer when the Cloud Run lockdown lands.

---

## Out of scope (deferred)

- Reviewer attribution — handled separately when Cloud Run IAM / IAP arrives.
- `review_history` event log — separate ADR if/when needed.
