---
phase: 96
plan: "02"
subsystem: scheduling
tags: [tests, bookings, integration]
requirements: [SCHED-10, SCHED-11, SCHED-12]
key-files:
  created:
    - tests/scheduling-bookings.test.ts
---

# Phase 96 Plan 02: scheduling-bookings.test.ts Summary

6 integration tests for `createBooking` (success, SELECT-conflict, 23505-conflict) and `cancelBookingByToken` (success, invalid token, already cancelled). All 6 pass.

## Commits

- `5b59699` test(96-02): integration tests for createBooking + cancelBookingByToken

## Deviations from Plan

**1. [Rule 2 - Critical] Indexed table-routing for repeat queries**
- **Found during:** First test run — cancellation email pipeline reissues queries against `bookings`/`event_types`/`scheduling_profiles` after the primary update.
- **Issue:** A flat per-table response map mixes up which canned response goes where when the same table is queried multiple times in one action.
- **Fix:** The fake admin client tracks a per-table call index for tables touched multiple times. First call returns the "primary" canned response; subsequent calls return the cancellation-pipeline-specific responses (`bookingsCancelLookup`, `eventTypeCancelLookup`, `schedulingProfileCancelLookup`).

## Self-Check: PASSED
- tests/scheduling-bookings.test.ts — FOUND
- 6/6 tests pass — VERIFIED
- Combined scheduling suite (14 tests) — PASS
- npm run build exits 0 — VERIFIED
