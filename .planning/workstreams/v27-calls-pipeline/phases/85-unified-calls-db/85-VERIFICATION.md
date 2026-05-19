---
phase: 85-unified-calls-db
verified: 2026-05-19T08:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 85: UNIFIED-CALLS-DB Verification Report

**Phase Goal:** Migration criando a VIEW `unified_calls` unindo `calls` (AI/Vapi) e `call_logs` (Human/Twilio) em um único dataset consultável. TypeScript types + server actions base.
**Verified:** 2026-05-19T08:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                     | Status     | Evidence                                                                           |
|----|-------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------|
| 1  | VIEW `unified_calls` exists as a SQL migration with `call_type` discriminator (CALL-01)  | VERIFIED   | `supabase/migrations/063_unified_calls_view.sql` — UNION ALL with `'ai'` / `'human'` literals, SECURITY INVOKER, GRANT SELECT |
| 2  | `UnifiedCall` TypeScript type exists in `database.ts` with all 21 columns (CALL-02)      | VERIFIED   | Lines 1779–1806: all columns present, union literals `'ai' | 'human'` and `'inbound' | 'outbound'`, `Insert: never`, `Update: never`, `Relationships: []` |
| 3  | `getUnifiedCalls` and `getUnifiedCall` server actions exist and are correctly wired       | VERIFIED   | `src/app/(dashboard)/calls/actions.ts` — both exported, auth-gated, all filters applied, contact enrichment, pagination with `.range()` |
| 4  | Vitest test suite passes (8 tests) and `npm run build` exits 0                           | VERIFIED   | `npx vitest run tests/calls-actions.test.ts`: 8 passed, 13 todo. `npm run build`: exit 0, TypeScript strict clean |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact                                              | Expected                                         | Status     | Details                                                                 |
|-------------------------------------------------------|--------------------------------------------------|------------|-------------------------------------------------------------------------|
| `supabase/migrations/063_unified_calls_view.sql`      | VIEW with UNION ALL, call_type, SECURITY INVOKER | VERIFIED   | 21 columns, both call_type literals, COALESCE for started_at, ended_at present, GRANT SELECT to authenticated/anon |
| `src/types/database.ts` (lines 1779–1806)             | `unified_calls` Row type with 21 columns         | VERIFIED   | All 21 columns with correct nullability; union literal types used for call_type and direction; Insert/Update: never |
| `src/app/(dashboard)/calls/actions.ts`                | `getUnifiedCalls` + `getUnifiedCall` exports     | VERIFIED   | Both functions exported; filters: type, direction, missed, from, to, q; pagination via `.range()`; two-step contact enrichment; auth-gated via `getUser()` |
| `tests/calls-actions.test.ts`                         | 8 passing Vitest tests for the two actions       | VERIFIED   | 8 tests pass; 13 legacy `.todo` stubs preserved; `buildFakeClient` uses chainable thenable proxy pattern |

---

## Key Link Verification

| From                        | To                                         | Via                                      | Status   | Details                                                       |
|-----------------------------|--------------------------------------------|------------------------------------------|----------|---------------------------------------------------------------|
| `actions.ts`                | `unified_calls` VIEW                       | `.from('unified_calls').select('*')`     | WIRED    | Both `getUnifiedCalls` and `getUnifiedCall` query the VIEW    |
| `actions.ts`                | `contacts` table                           | `.from('contacts').select('id,name,...')`| WIRED    | Two-step enrichment in both actions                           |
| `actions.ts`                | `database.ts` `UnifiedCall` type           | `Database['public']['Tables']['unified_calls']['Row']` | WIRED | Line 7: `type UnifiedCall = Database['public']['Tables']['unified_calls']['Row']` |
| `tests/calls-actions.test.ts` | `actions.ts` exports                     | `import { getUnifiedCalls, getUnifiedCall }` | WIRED | Top-level import after vi.mock declarations                   |

---

## Data-Flow Trace (Level 4)

Server actions are the data layer for this phase — they are not render components. Level 4 data-flow trace applies to the actions themselves rather than to UI components.

| Artifact              | Data Variable | Source                              | Produces Real Data       | Status    |
|-----------------------|---------------|-------------------------------------|--------------------------|-----------|
| `getUnifiedCalls`     | `data`, `count` | `.from('unified_calls').select('*', { count: 'exact' })` | Yes — queries VIEW, returns all rows + count | FLOWING |
| `getUnifiedCall`      | `data`        | `.from('unified_calls').select('*').eq('id', id).maybeSingle()` | Yes — returns single row or null | FLOWING |
| Contact enrichment    | `contactMap`  | `.from('contacts').select('id, name, phone, email').in('id', contactIds)` | Yes — batch query by contact_id set | FLOWING |

---

## Behavioral Spot-Checks

| Behavior                                         | Command                                       | Result                               | Status |
|--------------------------------------------------|-----------------------------------------------|--------------------------------------|--------|
| 8 Vitest tests for getUnifiedCalls/getUnifiedCall | `npx vitest run tests/calls-actions.test.ts` | 8 passed, 13 todo, exit 0            | PASS   |
| TypeScript strict build, no type errors           | `npm run build`                               | Compiled 75 routes, TypeScript clean, exit 0 | PASS   |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                            | Status    | Evidence                                                                    |
|-------------|------------|------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------|
| CALL-01     | 85-01      | VIEW `unified_calls` unindo `calls` e `call_logs` com `call_type` discriminador | SATISFIED | Migration 063 creates UNION ALL VIEW with `'ai'::text` / `'human'::text` discriminator |
| CALL-02     | 85-01, 85-02 | TypeScript types + server actions `getUnifiedCalls` e `getUnifiedCall` | SATISFIED | Type at database.ts:1779, both server actions fully implemented and test-covered |

---

## VIEW Column Verification (CALL-01 Detail)

All 21 columns verified present in `supabase/migrations/063_unified_calls_view.sql`:

| Column              | AI branch (`calls`)                          | Human branch (`call_logs`)                                  |
|---------------------|----------------------------------------------|-------------------------------------------------------------|
| `id`                | `c.id`                                       | `l.id`                                                      |
| `call_type`         | `'ai'::text`                                 | `'human'::text`                                             |
| `org_id`            | `c.organization_id AS org_id`                | `l.org_id`                                                  |
| `external_id`       | `c.vapi_call_id AS external_id`              | `l.call_sid AS external_id`                                 |
| `counterpart_number`| `c.customer_number AS counterpart_number`    | `CASE WHEN l.direction = 'inbound' THEN l.from_number ELSE l.to_number END` |
| `counterpart_name`  | `c.customer_name AS counterpart_name`        | `NULL::text AS counterpart_name`                            |
| `contact_id`        | `NULL::uuid AS contact_id`                   | `l.contact_id`                                              |
| `direction`         | `'inbound'::text AS direction`               | `l.direction`                                               |
| `duration_seconds`  | `c.duration_seconds`                         | `l.duration_seconds`                                        |
| `status`            | `c.status`                                   | `l.status`                                                  |
| `substatus`         | `c.ended_reason AS substatus`                | `NULL::text AS substatus`                                   |
| `recording_url`     | `NULL::text AS recording_url`                | `l.recording_url`                                           |
| `recording_duration`| `NULL::integer AS recording_duration`        | `l.recording_duration`                                      |
| `transcript`        | `c.transcript`                               | `NULL::text AS transcript`                                  |
| `notes`             | `c.summary AS notes`                         | `l.notes`                                                   |
| `cost`              | `c.cost`                                     | `NULL::numeric AS cost`                                     |
| `assistant_id`      | `c.assistant_id`                             | `NULL::text AS assistant_id`                                |
| `routing_mode`      | `NULL::text AS routing_mode`                 | `l.routing_mode`                                            |
| `started_at`        | `COALESCE(c.started_at, c.created_at)`       | `COALESCE(l.started_at, l.created_at)`                      |
| `ended_at`          | `c.ended_at`                                 | `l.ended_at`                                                |
| `created_at`        | `c.created_at`                               | `l.created_at`                                              |

VIEW properties: `WITH (security_invoker = true)` — present. `GRANT SELECT ON public.unified_calls TO authenticated, anon` — present.

---

## Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `actions.ts` | 156 | `console.error` in `getCalls` (legacy function) | Info | Legacy function outside this phase's scope — no impact on CALL-01/02 |

No stubs, no hardcoded empty returns, no TODO/FIXME in the phase deliverables.

---

## Discrepancy: ROADMAP Success Criterion vs Actual Implementation

**ROADMAP Phase 85 Success Criterion 1** states:
> `supabase/migrations/071_unified_calls_view.sql` cria a VIEW `unified_calls` com colunas: `id, call_type (ai|human), org_id, external_id, counterpart_number, counterpart_name, contact_id, direction, duration_seconds, status, substatus, recording_url, transcript, notes, cost, assistant_id, routing_mode, started_at, created_at`

**Actual implementation:** Migration is numbered `063_unified_calls_view.sql` (not 071), and has 21 columns — including `recording_duration` and `ended_at`, which are absent from the ROADMAP list. The discrepancy is **in the ROADMAP documentation only** — the PLAN (85-01-PLAN.md) and SEED-014 spec correctly specify all 21 columns. The PLAN is authoritative; the ROADMAP criterion was written with an earlier draft column list and an incorrect migration number. The implementation is correct and complete against the PLAN specification.

This discrepancy does not affect goal achievement — the VIEW, types, and actions are all consistent with each other and with the PLAN.

---

## Human Verification Required

None. All phase 85 deliverables are fully verifiable programmatically:
- VIEW SQL is statically readable
- TypeScript types are statically readable
- Server actions are statically verifiable and covered by unit tests
- Build and test suite produce deterministic exit codes

---

## Gaps Summary

No gaps. All four must-haves are verified:

1. The `unified_calls` VIEW exists in migration 063 with the correct UNION ALL structure, `call_type` discriminator, 21 columns, SECURITY INVOKER, and GRANT SELECT.
2. The `UnifiedCall` TypeScript type is complete with all 21 columns, union literal types for `call_type` and `direction`, and `Insert: never` / `Update: never` / `Relationships: []`.
3. Both server actions (`getUnifiedCalls` and `getUnifiedCall`) are correctly implemented: auth-gated, all filters applied, contact enrichment via two-step batch query, pagination via `.range()`, null-safe returns.
4. 8 Vitest unit tests pass (exit 0). `npm run build` exits 0 with TypeScript strict and no type errors across 75 routes.

Phase 85 goal is fully achieved. Phase 86 (UNIFIED-TIMELINE-PAGE) can proceed.

---

_Verified: 2026-05-19T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
