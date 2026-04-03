---
phase: 02-action-engine
plan: 02
subsystem: database-schema
tags: [migration, rls, typescript-types, action-engine, supabase]
dependency_graph:
  requires: [02-01]
  provides: [integrations-table, tool_configs-table, action_logs-table, phase-2-types]
  affects: [02-03, 02-04, 02-05, 02-06]
tech_stack:
  added: []
  patterns:
    - AES-256-GCM ciphertext stored in encrypted_api_key TEXT column (never plaintext)
    - RLS policies with (SELECT public.get_current_org_id()) subquery wrapper for performance
    - Composite index idx_tool_configs_org_tool for O(1) webhook hot path lookup
    - action_logs append-only enforcement via Update: Record<string, never> in TypeScript
    - status TEXT CHECK constraint instead of fourth ENUM for simple 3-value domain
key_files:
  created:
    - supabase/migrations/002_action_engine.sql
  modified:
    - src/types/database.ts
decisions:
  - status TEXT CHECK instead of ENUM for action_logs.status — avoids third enum for a simple 3-value domain; CHECK constraint is equally enforced and easier to extend
  - tool_configs integration_id ON DELETE RESTRICT — prevents orphaned tool configs; admin must reassign before deleting an integration
  - action_logs tool_config_id ON DELETE SET NULL — preserves audit history even when tool configs are reconfigured or deleted
metrics:
  duration_minutes: 4
  completed_date: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 2 Plan 02: Action Engine Schema Summary

**One-liner:** PostgreSQL migration adding integrations, tool_configs, and action_logs tables with AES-256-GCM storage pattern, composite hot-path index, and append-only RLS — plus full TypeScript Database types for all three tables.

## What Was Built

### Migration 002_action_engine.sql

Complete Phase 2 schema applying cleanly on top of 001_foundation.sql:

**ENUM types:**
- `public.action_type`: 6 values — `create_contact`, `get_availability`, `create_appointment`, `send_sms`, `knowledge_base`, `custom_webhook`
- `public.integration_provider`: 4 values — `gohighlevel`, `twilio`, `calcom`, `custom_webhook`

**integrations table** — Per-org credential store for external platform integrations. `encrypted_api_key TEXT NOT NULL` stores AES-256-GCM ciphertext (`iv:ciphertext` base64 format). Never plaintext. `location_id` is nullable for GHL sub-account ID. Index on `organization_id`. `updated_at` trigger wired to `public.update_updated_at()`.

**tool_configs table** — Maps Vapi tool names to action types and integrations per org. `UNIQUE(organization_id, tool_name)` enforces one config per tool name per org. `integration_id ON DELETE RESTRICT` prevents orphaning. Two indexes: `idx_tool_configs_org_id` for general scoping and `idx_tool_configs_org_tool` composite index for the webhook hot path (`WHERE organization_id = $1 AND tool_name = $2`). `fallback_message TEXT NOT NULL` required — Vapi always gets a response.

**action_logs table** — Append-only execution audit log. `status TEXT CHECK (status IN ('success', 'error', 'timeout'))`. `tool_config_id ON DELETE SET NULL` preserves history. Three indexes: by `organization_id`, by `created_at DESC` (for time-ordered log display), and by `tool_config_id` (for per-tool analytics). No `updated_at` column — rows are never modified after insertion.

**RLS policies:**
- `integrations`: SELECT, INSERT (WITH CHECK), UPDATE (USING + WITH CHECK), DELETE
- `tool_configs`: SELECT, INSERT (WITH CHECK), UPDATE (USING + WITH CHECK), DELETE
- `action_logs`: SELECT, INSERT (WITH CHECK) only — no UPDATE or DELETE (append-only)
- All policies use `(SELECT public.get_current_org_id())` subquery wrapper (evaluated once per statement, not per row)

### src/types/database.ts

Extended with Phase 2 types. Phase 1 types (organizations, org_members, assistant_mappings) preserved exactly.

**New tables added:**
- `integrations` — Row/Insert/Update shapes; `Update` excludes `organization_id` and `provider` (immutable after creation)
- `tool_configs` — Row/Insert/Update shapes with `action_type` union on all three; Relationships to both `organizations` and `integrations`
- `action_logs` — Row/Insert shapes; `Update: Record<string, never>` enforces append-only at the TypeScript layer

**New enums added to `public.Enums`:**
- `action_type`: union of all 6 action values
- `integration_provider`: union of all 4 provider values

## Verification

```
CREATE TABLE count:        3 (integrations, tool_configs, action_logs)
ENABLE ROW LEVEL SECURITY: 3
idx_tool_configs_org_tool: present (composite hot-path index)
Row: shapes in database.ts: 6 (3 Phase 1 + 3 Phase 2)
npx vitest run:            exit 0 — 6 passed, 59 todo, 7 skipped
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates schema and types only. No UI components or server actions with placeholder data.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | eea56d3 | feat(02-02): write migration 002_action_engine.sql |
| Task 2 | 9a8f11e | feat(02-02): extend database.ts with Phase 2 types |

## Self-Check: PASSED

- supabase/migrations/002_action_engine.sql: FOUND
- src/types/database.ts: FOUND
- .planning/phases/02-action-engine/02-02-SUMMARY.md: FOUND
- Commit eea56d3: FOUND
- Commit 9a8f11e: FOUND
