---
phase: 03-observability
plan: "01"
subsystem: test-harness
tags: [testing, vitest, stubs, tdd]
dependency_graph:
  requires: []
  provides: [test-stubs-obs-01, test-stubs-obs-02-03-04, test-stubs-obs-05-06, test-stubs-obs-07]
  affects: [03-02, 03-03, 03-04, 03-05, 03-06]
tech_stack:
  added: []
  patterns: [it.todo stubs, vitest node environment]
key_files:
  created:
    - tests/call-ingestion.test.ts
    - tests/calls-actions.test.ts
    - tests/call-detail.test.ts
    - tests/dashboard-metrics.test.ts
  modified: []
decisions:
  - "it.todo() stubs allow full suite to exit 0 before any implementation exists"
  - "buildTimeline function name locked in test stubs — executor must match exactly"
metrics:
  duration: "5m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 4
---

# Phase 3 Plan 01: Test Stubs Summary

One-liner: 45 it.todo() stubs across 4 test files covering all 7 OBS requirements as RED anchors for Phase 3 TDD.

## What Was Built

Created 4 Wave 0 test stub files establishing the test harness for all OBS requirements before any implementation:

- `tests/call-ingestion.test.ts` — 12 stubs for OBS-01 (VapiEndOfCallMessageSchema + webhook route)
- `tests/calls-actions.test.ts` — 13 stubs for OBS-02/03/04 (getCalls pagination, filters, search)
- `tests/call-detail.test.ts` — 12 stubs for OBS-05/06 (buildTimeline transcript + tool interleaving)
- `tests/dashboard-metrics.test.ts` — 8 stubs for OBS-07 (getDashboardMetrics counts + success rate)

All test files import from future source paths. `npx vitest run tests/` exits 0 with 45 todo tests.

## Commits

- `b2efed8` — test(03-01): add OBS phase test stub files (45 it.todo stubs across 4 files)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- tests/call-ingestion.test.ts: FOUND
- tests/calls-actions.test.ts: FOUND
- tests/call-detail.test.ts: FOUND
- tests/dashboard-metrics.test.ts: FOUND
- All 45 stubs show as todo, vitest exits 0
