---
phase: 102-workflows-unification
plan: "02"
subsystem: routing
tags: [routing, sidebar, components, command-palette]
dependency_graph:
  requires: ["102-01 (/workflows/** route tree must exist)"]
  provides: ["All nav/import references pointing to /workflows"]
  affects: ["sidebar.tsx", "flow-canvas.tsx", "new-flow-form.tsx", "command-palette.tsx"]
tech_stack:
  added: []
  patterns: ["Edit existing files — minimal targeted changes"]
key_files:
  created: []
  modified:
    - src/components/layout/sidebar.tsx
    - src/components/flows/flow-canvas.tsx
    - src/components/flows/new-flow-form.tsx
    - src/components/command-palette.tsx
decisions:
  - "command-palette keeps 'automations' as a keyword so old searches still find the Workflows item"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-20"
  tasks: 3
  files: 4
---

# Phase 102 Plan 02: Update Cross-Cutting References Summary

4 files updated with targeted edits to remove all `/automations` href and import references, pointing them to the new `/workflows/**` route tree.

## What Was Changed

- **sidebar.tsx**: `href: '/automations'` → `href: '/workflows'` (Workflows nav item)
- **flow-canvas.tsx**: Import of `saveWorkflowDefinition` updated to `/workflows/_actions` path
- **new-flow-form.tsx**: Import of `createWorkflow` + `router.push` target both updated to `/workflows`
- **command-palette.tsx**: `label: 'Automations'`, `href: '/automations'` → `label: 'Workflows'`, `href: '/workflows'`; `'automations'` added to keywords array

## Known Out-of-Scope Deferred Items

Additional components with `/automations` references were discovered outside Plan 02's explicit scope. These do not break the build (redirect stubs + source files still exist). Documented in `deferred-items.md`:
- `src/components/flows/ai-builder-chat.tsx`
- `src/components/flows/flow-toolbar.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/notifications/notification-item.tsx`
- `src/components/tools/inline-tool-name.tsx`, `log-detail-sheet.tsx`, `logs-table.tsx`, `tool-config-form.tsx`, `tools-table.tsx`
- `src/components/agents/tool-picker.tsx`

## Deviations from Plan

None for in-scope files — plan executed exactly as written. Out-of-scope items deferred.

## Commits

- `9cc1f39`: feat(102-02): update cross-cutting references to /workflows

## Self-Check: PASSED

All 4 files modified. Zero `/automations` href or import strings in scope files. Commit `9cc1f39` verified.
