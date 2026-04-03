---
phase: 03-observability
plan: "04"
subsystem: calls-list-ui
tags: [server-component, tanstack-table, filters, pagination, nextjs15]
dependency_graph:
  requires: [03-02, 03-03]
  provides: [calls-list-page, getCalls-action, getAssistantOptions-action]
  affects: [03-05, 03-06]
tech_stack:
  added: []
  patterns: [Next.js 15 await searchParams, TanStack Table, URL-driven filter state, 300ms debounce]
key_files:
  created:
    - src/app/(dashboard)/calls/actions.ts
    - src/app/(dashboard)/calls/page.tsx
    - src/components/calls/calls-table.tsx
    - src/components/calls/calls-filters.tsx
  modified: []
decisions:
  - "All filter state in URL searchParams — no React state for filters"
  - "Status filter maps to ended_reason column (not status column)"
  - "Search uses .or(customer_number.ilike + customer_name.ilike)"
  - "Duration formatter: Math.floor(s/60) + ':' + String(s%60).padStart(2, '0')"
  - "Pagination controls in CallsTable use useRouter + useSearchParams to preserve other params"
metrics:
  duration: "10m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 4
---

# Phase 3 Plan 04: Calls List Page + Actions Summary

One-liner: getCalls server action with 5 filter types + /dashboard/calls server page with TanStack Table pagination, filter controls, and URL-driven state.

## What Was Built

- `src/app/(dashboard)/calls/actions.ts`: getCalls with PAGE_SIZE=20, range-based pagination, 5 filter types (date range on started_at, ended_reason equality, assistant_id equality, call_type equality, ILIKE search on customer_number/customer_name). getAssistantOptions queries active assistant_mappings.

- `src/app/(dashboard)/calls/page.tsx`: async server component using `const params = await searchParams` (Next.js 15 pattern). Calls getCalls + getAssistantOptions in Promise.all. Renders CallsFilters + CallsTable.

- `src/components/calls/calls-table.tsx`: 'use client', TanStack Table with columns (date/time, duration m:ss, call type pretty label, customer phone, contact name, ended_reason badge, View link). Pagination controls use router.replace to update ?page= while preserving other URL params. Empty state with Phone icon.

- `src/components/calls/calls-filters.tsx`: 'use client', debounced search input (300ms setTimeout/clearTimeout), status/call-type/assistant Select components, from/to date inputs. Each change calls router.replace with updated params while preserving others.

## Commits

- `ec55727` — feat(03-04): add calls list page with server pagination and filter components

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/app/(dashboard)/calls/actions.ts: FOUND
- src/app/(dashboard)/calls/page.tsx: FOUND
- src/components/calls/calls-table.tsx: FOUND
- src/components/calls/calls-filters.tsx: FOUND
- await searchParams: FOUND in page.tsx
- useReactTable: FOUND in calls-table.tsx
- router.replace: FOUND in calls-filters.tsx
- padStart(2: FOUND in calls-table.tsx
