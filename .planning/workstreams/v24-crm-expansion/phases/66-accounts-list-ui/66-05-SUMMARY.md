---
phase: 66-accounts-list-ui
plan: "05"
subsystem: dashboard/accounts
tags: [dashboard, widget, accounts, vitest, unit-tests, ACC-18]
requirements: [ACC-18]

dependency_graph:
  requires:
    - 66-01  # AccountRow type and getAccounts action
    - 65-02  # accounts DB table and Supabase queries
  provides:
    - TopCompanies dashboard widget (async server component)
    - Vitest unit tests for accounts list UI logic helpers
  affects:
    - src/app/(dashboard)/page.tsx  # dashboard layout now has 4 rows

tech_stack:
  added: []
  patterns:
    - Two-call Supabase aggregation pattern (accounts + opportunities join in server component)
    - WidgetErrorBoundary + Suspense wrapping for dashboard widgets
    - Pure-function unit tests replicated from client component helpers

key_files:
  created:
    - src/components/dashboard/widgets/top-companies.tsx
    - tests/accounts-list-ui.test.ts
  modified:
    - src/app/(dashboard)/page.tsx

decisions:
  - title: Direct Supabase query instead of getAccounts() server action
    rationale: >
      AccountRow (returned by getAccounts) does not include open_opportunity_count
      or pipeline_value — those are computed fields only in AccountWithCounts
      (returned by getAccount detail). Rather than changing the schema or
      adding a new action, the widget queries accounts + opportunities directly
      (two lightweight Supabase calls), matching the pattern used by
      pipeline-overview.tsx. This avoids schema changes and keeps the action
      boundary clean.
  - title: Row 4 full-width grid instead of extending Row 3
    rationale: >
      Row 3 is a 3-column grid (recent-calls, integrations-status,
      activity-snapshot). Adding a 4th column would either break the 3-column
      balance or require a wider breakpoint. Using a separate Row 4 with
      grid-cols-1 keeps Row 3 intact and lets Phase 67 extend Row 4 horizontally
      when more widgets are added.

metrics:
  duration_minutes: 18
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 66 Plan 05: Top Companies Widget + UI Unit Tests Summary

**One-liner:** TopCompanies dashboard widget querying top 5 accounts by open opportunity count via direct Supabase aggregation, plus 8 Vitest unit tests for accounts-list UI logic helpers.

## What Was Built

### Task 1: Vitest unit tests (tests/accounts-list-ui.test.ts)

Pure-function unit tests — no DB, no network. All 8 tests pass.

- `relativeTime`: boundary coverage for "just now" (< 1 min) and "Nm ago"
- `sourceLabel`: known mapping (`auto_from_contact_company` → `'Auto-imported'`) and unknown passthrough
- `extractAccountRows`: combobox search fallback — returns `[]` on `ok: false`, returns rows on `ok: true`
- `shouldBlockDelete`: bulk-delete guard — blocks for empty ids, passes for non-empty

**Deviation:** Test used 20s instead of 30s for the "just now" boundary because `Math.round(30000/60000) = 1` rounds up to `"1m ago"`. Fixed inline (Rule 1 — bug in the plan's example code).

### Task 2: TopCompanies widget (src/components/dashboard/widgets/top-companies.tsx)

Async server component mirroring the `pipeline-overview.tsx` pattern:

- Queries `accounts` (id, name, up to 200 rows) + `opportunities` (account_id, value, status=open) via two RLS-scoped Supabase calls
- Aggregates counts and values per account in-memory
- Filters to accounts with at least 1 open opportunity
- Sorts by `open_opportunity_count DESC`, then `pipeline_value DESC` for ties
- Renders top 5 rows: rank number, company name (link to `/accounts/[id]`), deal count, pipeline value
- Shows `WidgetEmpty` state when no accounts have open opportunities

### Dashboard wiring (src/app/(dashboard)/page.tsx)

Added Row 4 (full-width `grid-cols-1`) after the existing Row 3:

```tsx
{/* Row 4 — Top Companies (ACC-18) */}
<div className="grid grid-cols-1 gap-4">
  <WidgetErrorBoundary name="top-companies" fallback={<WidgetError title="Top Companies" />}>
    <Suspense fallback={<PanelSkeleton rows={5} />}>
      <TopCompanies />
    </Suspense>
  </WidgetErrorBoundary>
</div>
```

## Verification

- `npx vitest run tests/accounts-list-ui.test.ts` — 8/8 tests pass
- `npm run build` — exits 0, compiled successfully in ~42s

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed relativeTime "just now" boundary in test**

- **Found during:** Task 1 test execution
- **Issue:** Plan's example used `Date.now() - 30_000` (30 seconds). `Math.round(30000/60000) = Math.round(0.5) = 1`, so the function returns `"1m ago"` not `"just now"`. Test failed.
- **Fix:** Changed to `Date.now() - 20_000` (20 seconds). `Math.round(20000/60000) = Math.round(0.333) = 0`, correctly returns `"just now"`.
- **Files modified:** `tests/accounts-list-ui.test.ts`
- **Commit:** cd0c1f3

**2. [Rule 2 - Architecture] Used direct Supabase query instead of getAccounts() call**

- **Found during:** Task 2 implementation
- **Issue:** Plan's widget code called `getAccounts({ pageSize: 25 })` and used `a.open_opportunity_count` and `a.pipeline_value` from the result, but `AccountRow` (the type returned by `getAccounts`) does not have these fields — they only exist in `AccountWithCounts` (returned by `getAccount` detail action).
- **Fix:** Queried accounts + opportunities directly in the widget (two Supabase calls), aggregating counts in-memory. No schema changes required.
- **Files modified:** `src/components/dashboard/widgets/top-companies.tsx`
- **Commit:** 6d5e811

## Commits

| Hash | Message |
|------|---------|
| cd0c1f3 | test(66-05): add accounts-list UI logic unit tests |
| 6d5e811 | feat(phase-66): add TopCompanies dashboard widget + UI unit tests (ACC-18) |

## Self-Check: PASSED

- [x] `src/components/dashboard/widgets/top-companies.tsx` exists and exports `TopCompanies`
- [x] `tests/accounts-list-ui.test.ts` exists with 8 passing tests
- [x] Dashboard page imports and renders `TopCompanies` inside WidgetErrorBoundary + Suspense
- [x] cd0c1f3 commit exists
- [x] 6d5e811 commit exists
- [x] Build compiles successfully
