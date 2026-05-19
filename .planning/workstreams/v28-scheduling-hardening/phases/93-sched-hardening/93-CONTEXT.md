---
phase: 93
slug: sched-hardening
type: infrastructure
---

# Phase 93 Context — SCHED-HARDENING

## Goal

Eliminate race-condition double-bookings at the DB level via a partial unique index, and add per-IP rate limiting on the public booking flow to prevent spam.

## Why now

Bookings are currently guarded only by an application-level pre-SELECT in `createBooking`. Under concurrent submissions for the same slot, both calls can pass the SELECT and both inserts can succeed, leaving the host with two attendees in the same slot. The fix moves the invariant to the database (partial unique index) and translates the resulting `23505` (`unique_violation`) into the existing `slot_taken` UX path.

Public booking pages have no rate limiting, which exposes them to scripted spam (the `/book/[slug]/[eventType]` route accepts anonymous inserts via service-role write inside the server action).

## Inputs

- `supabase/migrations/071_scheduling.sql` — current schema for `bookings` (status enum + indexes already in place)
- `src/app/(dashboard)/scheduling/_actions/bookings.ts` — `createBooking` server action where the insert happens
- `src/lib/redis.ts` — existing singleton Redis client (Upstash) with `isReady` check pattern
- `src/components/scheduling/booking-form.tsx` — caller that already handles `slot_taken` via toast

## Constraints

- Migration must be **idempotent** (`CREATE UNIQUE INDEX IF NOT EXISTS`) — never edit old migrations
- Partial index `WHERE status = 'confirmed'` so that cancelled bookings don't block reactivations
- Rate limiter must **fail-open** when Redis is unreachable (booking continues to work even if Upstash is down)
- New error code returned from `createBooking` must be a string the existing toast handler can branch on (`slot_taken`, `rate_limited`)

## Plans

- 93-01: Migration 072 + `createBooking` 23505 mapping
- 93-02: Rate limiter helper + per-IP enforcement
