---
phase: 102-workflows-unification
plan: "01"
subsystem: routing
tags: [routing, workflows, pages, server-actions]
dependency_graph:
  requires: []
  provides: ["/workflows/** route tree"]
  affects: ["/automations/** (consumed by Plan 03 stubs)"]
tech_stack:
  added: []
  patterns: ["Next.js App Router server components", "revalidatePath with /workflows prefix"]
key_files:
  created:
    - src/app/(dashboard)/workflows/page.tsx
    - src/app/(dashboard)/workflows/loading.tsx
    - src/app/(dashboard)/workflows/actions.ts
    - src/app/(dashboard)/workflows/logs/page.tsx
    - src/app/(dashboard)/workflows/logs/actions.ts
    - src/app/(dashboard)/workflows/[toolConfigId]/page.tsx
    - src/app/(dashboard)/workflows/flows/page.tsx
    - src/app/(dashboard)/workflows/flows/new/page.tsx
    - src/app/(dashboard)/workflows/flows/[id]/page.tsx
    - src/app/(dashboard)/workflows/flows/[id]/runs/page.tsx
    - src/app/(dashboard)/workflows/flows/runs/[runId]/page.tsx
    - src/app/(dashboard)/workflows/flows/_actions/workflows.ts
    - src/app/(dashboard)/workflows/flows/_actions/runs.ts
    - src/app/(dashboard)/workflows/flows/_actions/ai-build.ts
  modified: []
decisions:
  - "Unified landing page uses Tabs with ?tab= query param instead of copying automations/page.tsx verbatim"
  - "Tab value 'automations' retained as string (not a route) — only /automations route strings replaced"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-20"
  tasks: 6
  files: 14
---

# Phase 102 Plan 01: Create /workflows/** Route Tree Summary

14 new files created under `src/app/(dashboard)/workflows/` mirroring the /automations directory structure, with all internal route strings and revalidatePath calls updated from `/automations` to `/workflows`.

## What Was Built

Copied all 13 /automations source files to /workflows equivalents and created one new unified landing page (not a copy). Every occurrence of `/automations` as a route string was replaced with `/workflows`.

Key changes per file group:
- **actions.ts**: 10 revalidatePath calls updated (`/automations` → `/workflows`, `/automations/${id}` → `/workflows/${id}`)
- **flows/_actions/workflows.ts**: 5 revalidatePath calls updated to `/workflows/flows` prefix
- **flows/_actions/runs.ts**: 1 revalidatePath call updated
- **[toolConfigId]/page.tsx**: Import and basePath/back href updated to /workflows
- **logs/page.tsx**: BASE_PATH and back href updated to /workflows
- **flows/page.tsx**: Eyebrow text and all hrefs updated
- **flows/new/page.tsx**: Back href and eyebrow updated
- **flows/[id]/runs/page.tsx**: Back and run row hrefs updated
- **flows/runs/[runId]/page.tsx**: Back href updated
- **page.tsx**: New unified tabbed landing (not a copy of automations/page.tsx)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `cbb4376`: feat(102-01): create /workflows/** route tree mirroring /automations/**

## Self-Check: PASSED

All 14 files exist. Zero `/automations` route strings in any new file. Commit `cbb4376` verified.
