---
phase: 69-customfields-core-lib
plan: "02"
status: complete
completed: 2026-05-18
requirements_addressed: [CF-07, CF-15]
---

# Plan 69-02 Summary — validate.ts + Action Wiring

## What was built

- **`src/lib/custom-fields/validate.ts`** — `validateCustomFields(orgId, entity, values)`: loads active definitions from `custom_field_definitions` via service-role client, builds dynamic zod schema per definition type, rejects unknown keys, enforces required/type/unique_per_org rules, returns all errors (not fail-fast) as `{ ok: true } | { ok: false, errors: FieldError[] }`
- **Wired into 3 action files:**
  - `src/app/(dashboard)/contacts/actions.ts` — `createContact` + `updateContact` call `validateCustomFields(orgId, 'contact', custom_fields)` before upsert
  - `src/app/(dashboard)/accounts/actions.ts` — `createAccount` + `updateAccount` call `validateCustomFields(orgId, 'account', custom_fields)`
  - `src/app/(dashboard)/pipeline/actions.ts` — `createOpportunity` + `updateOpportunity` call `validateCustomFields(orgId, 'opportunity', custom_fields)`
- All three actions return `{ ok: false, error: 'custom_fields_invalid', details: errors }` on validation failure before any DB write

## Recovery note

This work was produced in-place on main (not in a worktree) during the parallel execution of Phases 66/69/73. Committed atomically post-session after verifying the files were complete.

## Reqs addressed

- **CF-07**: Writes that violate type/required/unique_per_org rules are rejected before persisting
- **CF-15**: Currency values persist as `{amount, currency}` via serialize.ts (Plan 69-01)
