---
phase: 66-accounts-list-ui
plan: "02"
subsystem: crm-accounts
tags: [accounts, crm, filters, search, debounce, url-params, client-component]
dependency_graph:
  requires:
    - 66-01  # page shell + AccountsTable
    - 65-02  # getAccounts + ACCOUNT_SIZES + ACCOUNT_SOURCES
  provides:
    - AccountsFilters client component (search + 5 filter selects/inputs + active-filter chips)
    - URL-driven filter state flowing from AccountsFilters -> page.tsx -> getAccounts
  affects:
    - src/app/(dashboard)/accounts/
    - src/components/accounts/
tech_stack:
  added: []
  patterns:
    - 300ms debounced input -> URL searchParam (useRouter.replace + URLSearchParams)
    - Active-filter chips with per-chip remove + Clear all
    - Server component page passes currentX props to 'use client' filter component
    - Filter state fully URL-driven (no persistent local state except debounced inputs)
key_files:
  created:
    - src/components/accounts/accounts-filters.tsx
  modified:
    - src/app/(dashboard)/accounts/page.tsx
decisions:
  - "Tag and assigned_to filters use debounced Input (not Select) — free-text values; a full user-picker is Phase 67 territory per plan spec"
  - "setParam clears 'page' on every filter change to avoid stale pagination"
  - "Local state (query/tagInput/ownerInput) syncs back from URL props via useEffect so chip-clears reset the input immediately"
  - "assigned_to passed to getAccounts as 'assignedTo' (camelCase) matching AccountListFilters schema — no deviation from page.tsx, which already used camelCase from plan 66-01"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 66 Plan 02: AccountsFilters — Debounced Search + 5 Filter Chips Summary

Shipped the `AccountsFilters` client component: a search input with 300ms debounce + five filter controls (industry/size/tag/owner/source) + active-filter chips that clear individually, all wired into the `/accounts` page above the Suspense boundary.

## What Was Built

**`src/components/accounts/accounts-filters.tsx`** — `'use client'` component that:
- Search input: `<Search>` icon prefix, 300ms debounce writing to `q` URL param, `<X>` clear button
- Five filter controls in a flex-row:
  1. **Industry** `<Select>` — 8 predefined options (`Technology`, `Finance`, `Healthcare`, `Retail`, `Manufacturing`, `Education`, `Real Estate`, `Other`) + "All industries" sentinel
  2. **Size** `<Select>` — options from `ACCOUNT_SIZES` (`1-10`/`11-50`/`51-200`/`201-1000`/`1000+`) + "All sizes" sentinel
  3. **Tag** debounced `<Input>` — 300ms debounce to `tag` param; `w-[140px]`
  4. **Owner** debounced `<Input>` — 300ms debounce to `assigned_to` param; `w-[130px]`
  5. **Source** `<Select>` — options from `ACCOUNT_SOURCES` via `sourceLabel()` helper + "All sources" sentinel
- Active-filter chips row: appears when any filter is set; each chip shows label + `<X>` remove; "Clear all" button when >1 chip active
- `setParam` helper mirrors contacts-table pattern: replaces URL without full reload, deletes `page` param on every filter change
- Local debounced state (`query`, `tagInput`, `ownerInput`) syncs back from URL props via `useEffect` so chip clears immediately reset the corresponding input field

**`src/app/(dashboard)/accounts/page.tsx`** — Updated to:
- Import and render `<AccountsFilters>` between the hero section and the `<Suspense>` block
- Pass all 6 current filter values as props (`currentQuery`, `currentIndustry`, `currentSize`, `currentTag`, `currentAssignedTo`, `currentSource`)

## Deviations from Plan

None — plan executed exactly as written. The page already parsed `industry` and `assignedTo` from plan 66-01, and `getAccounts` already accepted them (camelCase `assignedTo` matching the schema). No structural changes were required beyond import + component insertion.

## Known Stubs

None introduced in this plan. The owner filter uses a plain text input that passes a free-text string through to `getAccounts` where it matches `assigned_to ILIKE` — intentional per plan spec. A full user-picker (UUID-based) is deferred to Phase 67.

## Self-Check: PASSED

- `src/components/accounts/accounts-filters.tsx` — created, compiled with zero TS errors
- `src/app/(dashboard)/accounts/page.tsx` — modified, AccountsFilters wired above Suspense
- `npm run build` exit: clean (no TypeScript errors, `/accounts` route confirmed as `ƒ /accounts` dynamic)
- Commit `9f3f9c1` — verified in git log
