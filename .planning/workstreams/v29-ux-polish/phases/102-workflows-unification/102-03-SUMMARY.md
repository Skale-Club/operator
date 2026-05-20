---
phase: 102-workflows-unification
plan: "03"
subsystem: routing
tags: [routing, redirects, backward-compatibility, build-gate]
dependency_graph:
  requires: ["102-01 (/workflows/** route tree)", "102-02 (cross-cutting references)"]
  provides: ["Backward-compatible /automations redirects", "Passing build gate"]
  affects: ["src/app/(dashboard)/automations/** (8 pages replaced)"]
tech_stack:
  added: []
  patterns: ["Next.js redirect() server component stubs", "Dynamic params await before redirect"]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/automations/page.tsx
    - src/app/(dashboard)/automations/logs/page.tsx
    - src/app/(dashboard)/automations/[toolConfigId]/page.tsx
    - src/app/(dashboard)/automations/flows/page.tsx
    - src/app/(dashboard)/automations/flows/new/page.tsx
    - src/app/(dashboard)/automations/flows/[id]/page.tsx
    - src/app/(dashboard)/automations/flows/[id]/runs/page.tsx
    - src/app/(dashboard)/automations/flows/runs/[runId]/page.tsx
decisions:
  - "Dynamic redirect stubs are async and await params before calling redirect()"
  - "Static redirect stubs are sync (no params needed)"
  - "automations/actions.ts and logs/actions.ts left in place — required by type imports in components"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-20"
  tasks: 3
  files: 8
---

# Phase 102 Plan 03: /automations Redirect Stubs + Build Gate Summary

8 old /automations/** pages replaced with minimal redirect() stubs pointing to /workflows equivalents. Build exits 0 — all /workflows/** routes compile successfully.

## What Was Built

All 8 /automations page files overwritten with redirect-only content. Static routes use sync functions; dynamic routes use async functions that await params before redirecting.

### Redirect Mapping

| Old URL | New URL |
|---------|---------|
| `/automations` | `/workflows` |
| `/automations/logs` | `/workflows/logs` |
| `/automations/[toolConfigId]` | `/workflows/[toolConfigId]` |
| `/automations/flows` | `/workflows/flows` |
| `/automations/flows/new` | `/workflows/flows/new` |
| `/automations/flows/[id]` | `/workflows/flows/[id]` |
| `/automations/flows/[id]/runs` | `/workflows/flows/[id]/runs` |
| `/automations/flows/runs/[runId]` | `/workflows/flows/runs/[runId]` |

## Build Result

`npm run build` exits 0. Build output shows all `/workflows/**` routes compiled:
- `/workflows` (ƒ Dynamic)
- `/workflows/[toolConfigId]` (ƒ Dynamic)
- `/workflows/flows` (ƒ Dynamic)
- `/workflows/flows/[id]` (ƒ Dynamic)
- `/workflows/flows/[id]/runs` (ƒ Dynamic)
- `/workflows/flows/new` (ƒ Dynamic)
- `/workflows/flows/runs/[runId]` (ƒ Dynamic)
- `/workflows/logs` (ƒ Dynamic)

And all `/automations/**` routes (now redirect stubs):
- `/automations`, `/automations/[toolConfigId]`, `/automations/flows`, etc.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `857dfc7`: feat(102-03): replace /automations/** pages with redirect() stubs

## Self-Check: PASSED

All 8 stubs written. `npm run build` exits 0. Commit `857dfc7` verified.
