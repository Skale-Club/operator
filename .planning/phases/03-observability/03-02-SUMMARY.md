---
phase: 03-observability
plan: "02"
subsystem: database
tags: [migration, sql, types, rls]
dependency_graph:
  requires: [03-01]
  provides: [calls-table-schema, calls-typescript-types]
  affects: [03-03, 03-04, 03-05, 03-06]
tech_stack:
  added: []
  patterns: [Supabase migration SQL, TypeScript database types]
key_files:
  created:
    - supabase/migrations/003_observability.sql
  modified:
    - src/types/database.ts
decisions:
  - "cost NUMERIC(10,6) — 6 decimal places to avoid Vapi float precision loss"
  - "transcript_turns JSONB — stores artifact.messages array, not flat transcript string"
  - "duration_seconds GENERATED ALWAYS AS — auto-computed from started_at/ended_at"
  - "INSERT policy: service-role only (no authenticated INSERT RLS policy)"
  - "vapi_call_id TEXT NOT NULL UNIQUE — joins with action_logs.vapi_call_id (also TEXT)"
metrics:
  duration: "5m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 2
---

# Phase 3 Plan 02: DB Migration + Types Summary

One-liner: calls table DDL with GENERATED duration_seconds, JSONB transcript_turns, NUMERIC(10,6) cost, 6 indexes, RLS SELECT policy, and matching TypeScript types.

## What Was Built

- `supabase/migrations/003_observability.sql`: Complete calls table DDL including:
  - `vapi_call_id TEXT NOT NULL UNIQUE` — joins with action_logs.vapi_call_id
  - `transcript_turns JSONB NOT NULL DEFAULT '[]'` — stores artifact.messages array verbatim
  - `duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER) STORED`
  - `cost NUMERIC(10,6)` — 6 decimal places
  - 6 indexes (org_id, created_at DESC, vapi_call_id, org+created composite, customer_number, lower(customer_name))
  - RLS ENABLE + SELECT policy via `get_current_org_id()`

- `src/types/database.ts`: calls table added to Tables object with Row/Insert/Update/Relationships following existing pattern. `Update: Record<string, never>` (append-only table).

## Commits

- `c0f85b2` — feat(03-02): add calls table migration and database.ts types

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- supabase/migrations/003_observability.sql: FOUND
- src/types/database.ts calls entry: FOUND
- npx tsc --noEmit: no new errors from these files
