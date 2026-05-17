---
phase: 58
plan: 01
title: Migration 058 + database.ts types
status: complete
completed: 2026-05-17
---

# Plan 58-01 Summary

## What landed

- `supabase/migrations/058_twilio_phone_numbers.sql` — DDL, RLS policy, three indexes (org, e164-active, unique-default-partial), updated_at trigger (reuses `public.update_updated_at()`), backfill from `integrations.config.from_number`. Single transaction.
- `src/types/database.ts` — `twilio_phone_numbers` table entry added between `integrations` and `tool_configs` with Row/Insert/Update/Relationships. Uses `organization_id` to match the parent `integrations` table column convention.

## Verification

- `npx tsc --noEmit` filtered to non-chat files returns zero errors related to the migration or types.
- Pre-existing build failure in `src/components/chat/chat-layout.tsx` (parallel chat-pagination work missing `use-infinite-conversations` hook) is NOT caused by this plan. Confirmed by user before continuing.
- Migration syntax mirrors `054_evolution_instances.sql` (RLS pattern) and `002_action_engine.sql` (parent integrations table column naming).

## Operator action required

`npx supabase db push` to apply migration 058 against the remote database. This is operator action per CLAUDE.md ("After adding a migration: 1. `npx supabase db push`"). Verification of the DB-side invariants (RLS, unique-default index) is captured as HUMAN-UAT items in Phase 63.

## Tasks completed

- [x] Wrote `supabase/migrations/058_twilio_phone_numbers.sql`
- [x] Added `twilio_phone_numbers` type to `src/types/database.ts`
- [x] Confirmed types compile cleanly (`tsc --noEmit` with chat-layout exclusion)

## Out of scope (next phases)

- Server actions + lib refactor → Phase 59
- UI → Phase 60
