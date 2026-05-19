---
phase: 94
plan: "02"
subsystem: scheduling
tags: [emails, integration, bookings]
requirements: [SCHED-05, SCHED-06]
key-files:
  modified:
    - src/app/(dashboard)/scheduling/_actions/bookings.ts
---

# Phase 94 Plan 02: Cancellation email + integration Summary

Wires `sendBookingConfirmation` and `sendBookingCancellation` into all three action paths (`createBooking`, `cancelBookingByToken`, `cancelBooking`). Booker now receives an email on confirmation and on cancellation, with a rebook link in the cancellation message.

## Commits

- `fba48fc` feat(94-02): wire booker confirmation + cancellation emails into actions

## Deviations from Plan

**1. [Rule 2 - Critical] Added resolveHostName helper**
- **Found during:** Task 2 implementation
- **Issue:** `scheduling_profiles` has no display-name column. Plan said "use auth.users.email" but a slightly nicer UX uses `user_metadata.full_name` first.
- **Fix:** Added `resolveHostName(userId)` that reads `auth.admin.getUserById`, prefers `full_name` → `name` → `email` → `'your host'`. Never throws.

## Self-Check: PASSED
- createBooking calls sendBookingConfirmation — FOUND
- cancelBooking calls sendCancellationEmailForBooking — FOUND
- cancelBookingByToken calls sendCancellationEmailForBooking — FOUND
- All three are fire-and-forget (void ... .catch) — VERIFIED
- npm run build exits 0 — VERIFIED
