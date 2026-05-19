---
phase: 93
plan: "01"
subsystem: scheduling
tags: [migration, race-condition, bookings]
requirements: [SCHED-01, SCHED-02]
key-files:
  created:
    - supabase/migrations/072_scheduling_hardening.sql
  modified:
    - src/app/(dashboard)/scheduling/_actions/bookings.ts
---

# Phase 93 Plan 01: Migration 072 + 23505 mapping Summary

Adds a partial unique index `(event_type_id, start_at) WHERE status='confirmed'` to `public.bookings`, then maps the resulting Postgres `23505 unique_violation` into the existing `slot_taken` UX path inside `createBooking`.

## Commits

- `6c9e37d` feat(93-01): add migration 072 partial unique index for bookings
- `7f5aab5` feat(93-01): map Postgres 23505 unique_violation to slot_taken in createBooking

## Deviations from Plan

None.

## Self-Check: PASSED
- supabase/migrations/072_scheduling_hardening.sql — FOUND
- bookings.ts contains 23505 mapping — FOUND
