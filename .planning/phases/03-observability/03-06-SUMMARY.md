---
phase: 03-observability
plan: "06"
subsystem: dashboard-metrics
tags: [dashboard, metrics, sidebar, server-component, date-fns]
dependency_graph:
  requires: [03-04]
  provides: [getDashboardMetrics-action, dashboard-page, observability-nav-active]
  affects: []
tech_stack:
  added: []
  patterns: [Promise.all parallel queries, formatDistanceToNow, stat cards, server component]
key_files:
  created:
    - src/components/calls/dashboard-metrics.tsx
  modified:
    - src/app/(dashboard)/calls/actions.ts
    - src/app/(dashboard)/page.tsx
    - src/components/layout/app-sidebar.tsx
decisions:
  - "6 queries in Promise.all — callsToday/Week/Month (head:true), success rate (status only), recentCalls (10), recentFailures (last 24h)"
  - "toolSuccessRate null when logs.length === 0 (no action_logs) — shown as 'No data'"
  - "Rate formula: Math.round(successCount * 100 / totalCount) — integer percentage"
  - "recentFailures: .in('status', ['error', 'timeout']) from last 24h, .limit(20)"
  - "Sidebar Observability: active: false -> active: true"
  - "Dashboard page no longer redirects to /dashboard/organizations"
metrics:
  duration: "10m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 4
---

# Phase 3 Plan 06: Dashboard Metrics + Sidebar Summary

One-liner: getDashboardMetrics with 6 parallel queries, /dashboard replaced with stat cards + recent calls + failure alerts, Observability sidebar link activated.

## What Was Built

- `src/app/(dashboard)/calls/actions.ts` (extended): getDashboardMetrics runs 6 Supabase queries in Promise.all for callsToday/Week/Month counts (head:true), tool success rate (from action_logs.status this month), 10 recentCalls (created_at DESC), and recentFailures (error/timeout last 24h limit 20).

- `src/app/(dashboard)/page.tsx`: Replaced redirect('/dashboard/organizations') with async DashboardPage that awaits getDashboardMetrics and renders DashboardMetrics component.

- `src/components/calls/dashboard-metrics.tsx`: 4 stat cards in 2x2/4-col grid (callsToday, callsWeek, callsMonth, toolSuccessRate with color coding: >=80 emerald, 60-79 yellow, <60 red, null shows "No data"). Recent calls list with date, duration, customer, status badge, View link. Failure alerts section (shown only when failures exist) with tool name, status badge, truncated error_detail, formatDistanceToNow relative time.

- `src/components/layout/app-sidebar.tsx`: Changed Observability nav item from `active: false` to `active: true` — link now navigates to /dashboard/calls.

## Commits

- `51e51d5` — feat(03-06): add getDashboardMetrics, dashboard page, metrics component, activate Observability link

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- getDashboardMetrics in actions.ts: FOUND
- Promise.all usage: FOUND
- src/app/(dashboard)/page.tsx: no redirect, renders DashboardMetrics
- src/components/calls/dashboard-metrics.tsx: FOUND
- Observability active: true in app-sidebar.tsx: FOUND
- npx tsc --noEmit: no new errors from these files
