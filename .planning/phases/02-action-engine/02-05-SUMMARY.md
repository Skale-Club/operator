---
phase: 02-action-engine
plan: "05"
subsystem: action-engine
tags: [action-engine, supabase, ghl, dispatcher, logging, tdd]
dependency_graph:
  requires: [02-02, 02-03, 02-04]
  provides: [resolve-org, resolve-tool, execute-action, log-action]
  affects: [02-06]
tech_stack:
  added: []
  patterns:
    - "Supabase joined query: tool_configs with integrations(*) in single call"
    - "Exhaustive switch with TypeScript never-check for action_type dispatcher"
    - "try/catch error swallowing in logAction — designed for after() async logging"
    - "vi.doMock + vi.resetModules pattern for ESM module isolation in Vitest"
key_files:
  created:
    - src/lib/action-engine/resolve-org.ts
    - src/lib/action-engine/resolve-tool.ts
    - src/lib/action-engine/execute-action.ts
    - src/lib/action-engine/log-action.ts
    - src/lib/ghl/client.ts
    - src/lib/ghl/create-contact.ts
    - src/lib/ghl/get-availability.ts
    - src/lib/ghl/create-appointment.ts
  modified:
    - tests/action-engine.test.ts
    - tests/ghl-executor.test.ts
decisions:
  - "ToolConfigWithIntegration type exported from resolve-tool.ts — gives webhook route a named type for the joined result"
  - "executeAction throws for send_sms/knowledge_base/custom_webhook with 'Unsupported action type:' prefix — consistent error message for callers to match"
  - "logAction uses try/catch (not .catch()) to also catch synchronous errors from .from() or .insert() construction"
metrics:
  duration_seconds: 283
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
  tests_added: 22
---

# Phase 2 Plan 5: Action Engine Core Modules Summary

**One-liner:** Four pure action engine modules — resolveOrg, resolveTool, executeAction dispatcher, logAction error-swallowing logger — plus all GHL executor stubs from plan 02-04.

## What Was Built

### src/lib/action-engine/resolve-org.ts
`resolveOrg(assistantId, supabase)` — single Supabase query against `assistant_mappings` filtered by `vapi_assistant_id` and `is_active=true`, returns `organization_id` string or `null`. This is the first call in the webhook hot path, expected ~10-25ms with the index.

### src/lib/action-engine/resolve-tool.ts
`resolveTool(orgId, toolName, supabase)` — joined Supabase query `tool_configs` with `integrations(*)`, filtered by org, tool name, and active status. Returns `ToolConfigWithIntegration` (exported type) or `null`. Gives the webhook route both the tool config and decryption-ready credentials in one DB roundtrip.

### src/lib/action-engine/execute-action.ts
`executeAction(actionType, params, credentials)` — exhaustive switch dispatcher over all 6 `action_type` enum values. Routes `create_contact`, `get_availability`, and `create_appointment` to GHL executors. Throws `'Unsupported action type: {type}'` for `send_sms`, `knowledge_base`, and `custom_webhook` (Phase 4 stubs). Includes TypeScript `never`-type exhaustiveness check.

### src/lib/action-engine/log-action.ts
`logAction(payload, supabase)` — async void function that inserts into `action_logs`. Entire body wrapped in `try/catch` that swallows all errors (logs via `console.error` only). Designed to be called inside Next.js `after()` — logging failures must never block the Vapi response.

### src/lib/ghl/ (deviation — dependency unblocking)
GHL executor files from plan 02-04 were missing. Created all four: `client.ts` (ghlFetch + ghlFetchJson with 400ms AbortController timeout), `create-contact.ts`, `get-availability.ts`, `create-appointment.ts`. All return single-line strings (no `\n`).

## Tests

| Describe block | Tests | Status |
|---|---|---|
| ACTN-01: Org resolution | 3 | Passing |
| ACTN-02: Tool config routing | 3 | Passing |
| ACTN-11: executeAction dispatcher | 4 | Passing |
| ACTN-12: logAction | 2 | Passing |
| ACTN-09: GHL createContact | 4 | Passing |
| ACTN-09: GHL getAvailability | 3 | Passing |
| ACTN-09: GHL createAppointment | 3 | Passing |

Total: 22 tests passing, 0 todos in ACTN-01/02/11/12. Full suite: 28 passed, 0 failed.

## Commits

| Commit | Description |
|---|---|
| bc018f8 | feat(02-05): create GHL executor files (02-04 dependency) — deviation Rule 3 |
| e034e64 | feat(02-05): implement resolve-org and resolve-tool modules |
| b8f3fc0 | feat(02-05): implement execute-action dispatcher and log-action modules |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created GHL executor files from plan 02-04**
- **Found during:** Pre-task setup — execute-action.ts imports createContact, getAvailability, createAppointment
- **Issue:** Plan 02-04 had not been executed. `src/lib/ghl/` directory was empty. executeAction could not import the GHL executors.
- **Fix:** Created all four GHL files (`client.ts`, `create-contact.ts`, `get-availability.ts`, `create-appointment.ts`) using the exact spec from 02-04-PLAN.md. Also updated `tests/ghl-executor.test.ts` with 10 passing tests.
- **Files created:** src/lib/ghl/client.ts, src/lib/ghl/create-contact.ts, src/lib/ghl/get-availability.ts, src/lib/ghl/create-appointment.ts, tests/ghl-executor.test.ts
- **Commit:** bc018f8

## Known Stubs

| File | Stub | Reason |
|---|---|---|
| src/lib/action-engine/execute-action.ts | `throw new Error('Unsupported action type: send_sms')` | send_sms is Phase 4. Throws intentionally — webhook route catches and uses fallback_message. |
| src/lib/action-engine/execute-action.ts | `throw new Error('Unsupported action type: knowledge_base')` | knowledge_base is Phase 4. Same behavior. |
| src/lib/action-engine/execute-action.ts | `throw new Error('Unsupported action type: custom_webhook')` | custom_webhook is Phase 4. Same behavior. |

These are intentional stubs — the webhook route (Plan 06) handles them via the fallback_message path. They do not prevent Plan 05's goal from being achieved.

## Self-Check: PASSED
