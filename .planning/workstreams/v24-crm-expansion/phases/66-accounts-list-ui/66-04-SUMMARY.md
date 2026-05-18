---
phase: 66-accounts-list-ui
plan: "04"
subsystem: ui
tags: [react-hook-form, zod, combobox, accounts, contacts, crm]

requires:
  - phase: 65-accounts-core
    provides: getAccounts + createAccount server actions, AccountWithCounts type, AccountListFilters schema

provides:
  - AccountCombobox client component with debounced search, account selection, inline quick-create
  - account_id field wired into ContactForm (contactSchema, NormalisedContact, createContact, updateContact)

affects: [contacts, accounts, pipeline]

tech-stack:
  added: []
  patterns:
    - Combobox pattern: Input + absolute dropdown div with click-outside via useRef/useEffect
    - Debounced server-action call (300ms) inside useEffect with cleanup
    - Inline quick-create panel within same component state machine

key-files:
  created:
    - src/components/accounts/account-combobox.tsx
  modified:
    - src/components/contacts/contact-form.tsx
    - src/lib/contacts/zod-schemas.ts
    - src/app/(dashboard)/contacts/actions.ts

key-decisions:
  - "account_id added to contactSchema as z.string().uuid().nullable().optional() alongside legacy company string field for backward compat"
  - "AccountCombobox uses getAccounts({ q, pageSize: 20 }) with 300ms debounce; results show name + domain"
  - "Inline quick-create replaces the dropdown (showCreate state) rather than opening a modal"
  - "createContact and updateContact updated to pass account_id to Supabase (Rule 2 auto-fix)"

requirements-completed: [ACC-13]

duration: 25min
completed: 2026-05-18
---

# Phase 66 Plan 04: AccountCombobox Summary

**AccountCombobox with debounced account search, inline company quick-create, and account_id FK wired end-to-end from ContactForm to Supabase**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-18T00:00:00Z
- **Completed:** 2026-05-18T00:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `AccountCombobox` — 'use client' combobox with 300ms debounced `getAccounts` search, account item list (name + domain), and an inline quick-create flow calling `createAccount`
- Replaced the plain Company `<Input>` in `ContactForm` with `<AccountCombobox>` wired to `react-hook-form` via `watch`/`setValue`; legacy `company` text kept in sync for backward compat
- Added `account_id: z.string().uuid().nullable().optional()` to `contactSchema`, `NormalisedContact`, `normaliseContactInput`, and both `createContact`/`updateContact` Supabase calls

## Task Commits

1. **Tasks 1+2: AccountCombobox + ContactForm wiring** - `36cba84` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/components/accounts/account-combobox.tsx` - New 'use client' combobox component (debounced search, quick-create, click-outside)
- `src/components/contacts/contact-form.tsx` - Company field replaced with AccountCombobox; account_id defaultValue added
- `src/lib/contacts/zod-schemas.ts` - account_id added to contactSchema, NormalisedContact, normaliseContactInput
- `src/app/(dashboard)/contacts/actions.ts` - account_id passed to Supabase insert/update in createContact and updateContact

## Decisions Made
- Kept the legacy `company` text field hidden but in sync (set via onChange callback) so existing data pipelines that read `contacts.company` are unaffected
- Used a simple state machine (`isOpen` + `showCreate`) rather than a Radix Popover to stay consistent with the project's custom dropdown pattern seen in accounts-table
- Quick-create fires `createAccount({ name })` and immediately selects the result — no page reload required

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Pass account_id through createContact and updateContact**
- **Found during:** Task 2 (wire AccountCombobox into ContactForm)
- **Issue:** The actions.ts insert/update calls did not include `account_id` — form value would be silently discarded on submit
- **Fix:** Added `account_id: data.account_id` to both `.insert(...)` and `.update(...)` Supabase calls in `src/app/(dashboard)/contacts/actions.ts`
- **Files modified:** src/app/(dashboard)/contacts/actions.ts
- **Verification:** `npm run build` exits 0; TypeScript confirms `account_id` is valid on the contacts table Insert/Update types
- **Committed in:** 36cba84

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical DB write)
**Impact on plan:** Essential for correctness — without this fix, selecting an account would not persist. No scope creep.

## Issues Encountered
None — build passed on first attempt after completing both tasks.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- AccountCombobox is ready for use in any form that needs a company/account selector
- `account_id` column on contacts is already in the DB schema (migration 064); FK constraint in place
- Contact detail page (Phase 67 or later) can now display account name by joining on account_id

---
*Phase: 66-accounts-list-ui*
*Completed: 2026-05-18*
