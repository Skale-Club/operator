---
phase: 05-tools-logs
plan: 01
subsystem: ui
tags: [logs, action_logs, nextjs, shadcn, server-actions, pagination, filters]

requires:
  - phase: 03-tools-folders-labels
    provides: tool_configs with folder/labels columns; action_logs table exists

provides:
  - Global logs page at /tools/logs with filters + pagination
  - LogsTable shared component (used in global page and per-tool page)
  - LogDetailSheet component showing full request/response payloads
  - LogsFilters component (status, tool, date range, call ID search)
  - Per-tool detail page using shared components + getLogStats for metrics
  - Logs button in tools toolbar

affects: [tools, phone, calls]

tech-stack:
  added: []
  patterns:
    - URL-driven filters via server searchParams → props → client components
    - Pagination URLs built on server, passed as prevHref/nextHref to avoid useSearchParams
    - getLogStats separate from getLogs for accurate metric cards (not page-limited)

key-files:
  created:
    - src/app/(dashboard)/tools/logs/actions.ts
    - src/app/(dashboard)/tools/logs/page.tsx
    - src/components/tools/log-detail-sheet.tsx
    - src/components/tools/logs-table.tsx
    - src/components/tools/logs-filters.tsx
  modified:
    - src/app/(dashboard)/tools/[toolConfigId]/page.tsx
    - src/components/tools/tools-table.tsx

key-decisions:
  - "Pass prevHref/nextHref as strings from server instead of useSearchParams in LogsTable — avoids Suspense wrappers"
  - "Pass current filter values as props to LogsFilters — avoids useSearchParams, keeps components simpler"
  - "getLogStats fetches all logs for a tool (no pagination limit) for accurate metric cards"

patterns-established:
  - "URL-driven filter pattern: server reads searchParams, passes values as props to client filter components"
  - "Pagination via server-computed href strings (prevHref/nextHref) — no client-side URL manipulation needed"

duration: ~15min
started: 2026-04-08T00:00:00Z
completed: 2026-04-08T00:00:00Z
---

# Phase 5 Plan 1: Tools Logs System Summary

**Complete logs system: global /tools/logs page with filters/pagination, LogDetailSheet for payloads, shared LogsTable, and per-tool page upgraded from 20-item static list to paginated filterable view.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 8 completed |
| Files created | 5 |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Global logs page at /tools/logs | Pass | Server component, paginated 50/page |
| AC-2: Filter by status | Pass | Select: all/success/error/timeout, URL param |
| AC-3: Filter by tool | Pass | Select from all tool_configs in org |
| AC-4: Filter by date range | Pass | from/to date inputs, URL-driven |
| AC-5: Log detail sheet | Pass | Sheet with status, ms, call ID, error, request/response payloads |
| AC-6: Per-tool page uses shared component | Pass | LogsFilters + LogsTable, metric cards from getLogStats |
| AC-7: Logs button on /tools toolbar | Pass | ScrollText icon + "Logs" label, links to /tools/logs |
| AC-8: Build clean | Pass | npx next build exits 0, 25 pages |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/app/(dashboard)/tools/logs/actions.ts` | Created | getLogs, getToolOptions, getLogStats server actions |
| `src/app/(dashboard)/tools/logs/page.tsx` | Created | Global logs page; reads searchParams, passes props |
| `src/components/tools/log-detail-sheet.tsx` | Created | Sheet showing full log detail + payloads |
| `src/components/tools/logs-table.tsx` | Created | Table with status badges, pagination, opens detail sheet |
| `src/components/tools/logs-filters.tsx` | Created | Status/tool/date/search filter controls, debounced search |
| `src/app/(dashboard)/tools/[toolConfigId]/page.tsx` | Modified | Replaced inline 20-log list with shared components + getLogStats |
| `src/components/tools/tools-table.tsx` | Modified | Added Logs button (ScrollText icon) to toolbar |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Server-computed pagination hrefs | Avoids `useSearchParams` + Suspense wrappers in client components | Simpler component tree |
| Props-driven filter values | Filter values read on server, passed as props to `LogsFilters` | No hydration mismatches |
| `getLogStats` separate from `getLogs` | Per-tool metric cards need ALL-time counts, not just current page | Accurate stats regardless of filters |
| Debounced search (300ms) via `useRef`+`setTimeout` | No extra library needed; avoids rapid router.push on keypress | Good UX without deps |

## Deviations from Plan

None — plan executed exactly as written. All 8 tasks completed in sequence.

## Next Phase Readiness

**Ready:**
- Logs infrastructure complete; can add log deletion or CSV export in future plan
- Per-tool page now paginated and filterable

**Concerns:**
- `getLogStats` fetches all rows for a tool without limit — could be slow for high-volume tools. Future: replace with DB aggregate query.

**Blockers:** None

---
*Phase: 05-tools-logs, Plan: 01*
*Completed: 2026-04-08*
