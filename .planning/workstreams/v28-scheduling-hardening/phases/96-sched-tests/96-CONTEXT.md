---
phase: 96
slug: sched-tests
type: tests
---

# Phase 96 Context — SCHED-TESTS

## Goal

Lock down the scheduling system's invariants with unit + integration tests for `generateSlots` and the `createBooking` / `cancelBookingByToken` server actions.

## Why now

Phases 93–95 added DB-level invariants and side effects (rate limit, emails, custom-field defaults). Without tests, future changes to `bookings.ts` will silently regress.

## Inputs

- `src/lib/scheduling/slots.ts` — pure `generateSlots` function (no IO)
- `src/app/(dashboard)/scheduling/_actions/bookings.ts` — `createBooking`, `cancelBookingByToken`
- `tests/calls-actions.test.ts` — reference mock pattern for `@/lib/supabase/server` + thenable proxy

## Plans

- 96-01: `tests/scheduling-slots.test.ts` — 8 cases for `generateSlots`
- 96-02: `tests/scheduling-bookings.test.ts` — 6 cases for `createBooking` + `cancelBookingByToken`
