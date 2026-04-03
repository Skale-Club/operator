---
phase: 02-action-engine
plan: "06"
subsystem: webhook-route
tags: [edge-function, vapi, action-engine, webhook, http]
dependency_graph:
  requires: [02-03, 02-04, 02-05]
  provides: [POST /api/vapi/tools endpoint, complete action-engine pipeline]
  affects: [vapi webhook handling, action logging pipeline]
tech_stack:
  added: []
  patterns: [Edge Function, after() async tail, TDD RED-GREEN, service-role Supabase client]
key_files:
  created:
    - src/app/api/vapi/tools/route.ts
  modified:
    - tests/action-engine.test.ts
decisions:
  - Cast getToolArguments() return to Json type to satisfy logAction payload type constraint
  - Import Json type inline via import() expression instead of adding a top-level import
metrics:
  duration: ~15 minutes
  completed: "2026-04-02"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
---

# Phase 2 Plan 6: Vapi Tools Webhook Route Summary

**One-liner:** Edge Function POST /api/vapi/tools orchestrating resolveOrg → resolveTool → decrypt → executeAction → after(logAction) pipeline with guaranteed HTTP 200 on all paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing route tests (TDD) | 5e48eb6 | tests/action-engine.test.ts |
| GREEN | Implement webhook Edge Function | 4c744dc | src/app/api/vapi/tools/route.ts |

## What Was Built

`src/app/api/vapi/tools/route.ts` — the core of the VoiceOps product. An Edge Function that:

1. Parses and validates Vapi tool-call webhook payload via `VapiToolCallMessageSchema`
2. Creates a service-role Supabase client (bypasses RLS — no user JWT in Vapi requests)
3. Resolves the organization via `resolveOrg(call.assistantId, supabase)`
4. Resolves the tool config + integration credentials via `resolveTool(orgId, toolCall.name, supabase)`
5. Decrypts the GHL API key via `decrypt(toolConfig.integrations.encrypted_api_key)`
6. Executes the GHL action via `executeAction(toolConfig.action_type, args, credentials)`
7. Defers action logging via `after(async () => { await logAction(...) })` — does not block response
8. Returns HTTP 200 always — on every code path including errors

**7 code paths all returning HTTP 200:**
- Valid tool call: returns `{ results: [{ toolCallId, result: string }] }`
- Malformed JSON: returns `{ results: [] }`
- Schema validation failure: returns `{ results: [] }`
- Empty toolCallList: returns `{ results: [] }`
- Unknown assistantId: returns `{ results: [{ toolCallId, result: 'Service unavailable.' }] }`
- Unknown tool name: returns `{ results: [{ toolCallId, result: 'Tool not configured.' }] }`
- GHL executor throws: returns `{ results: [{ toolCallId, result: toolConfig.fallback_message }] }`
- Outer catch (unexpected): returns `{ results: [{ toolCallId: 'unknown', result: 'Service unavailable.' }] }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error for request_payload**

- **Found during:** TypeScript check after implementation
- **Issue:** `getToolArguments()` returns `Record<string, unknown>` which is not directly assignable to `Json` type (used by `logAction` payload). TypeScript error TS2322.
- **Fix:** Cast the return value to `import('@/types/database').Json` at the call site in the logAction payload object.
- **Files modified:** `src/app/api/vapi/tools/route.ts` (line 97)
- **Commit:** 4c744dc

### Pre-existing TypeScript Errors (Out of Scope — Deferred)

Two pre-existing TypeScript errors exist in files not touched by this plan:
- `src/components/organizations/organization-form.tsx` — react-hook-form type inference issue (pre-existing)
- `src/lib/crypto.ts` — `Uint8Array<ArrayBufferLike>` vs `ArrayBufferView<ArrayBuffer>` (pre-existing, TypeScript version strictness)

These are NOT introduced by this plan and are documented in `deferred-items.md` for resolution.

## Acceptance Criteria Verification

- `src/app/api/vapi/tools/route.ts` exists: YES
- Contains `export const runtime = 'edge'`: YES (line 15)
- Contains `import { after } from 'next/server'`: YES (line 5)
- Contains `after(async () => {`: YES (line 89)
- Does NOT contain `await logAction` outside after() callback: VERIFIED
- Contains outer try/catch: YES
- Contains inner try/catch around executeAction: YES
- All Response.json() calls use `{ status: 200 }`: YES (verified via grep)
- Imports `createClient` from `@supabase/supabase-js` (not ssr): YES
- Contains `SUPABASE_SERVICE_ROLE_KEY`: YES (line 45)
- `npx vitest run tests/action-engine.test.ts` exits 0: YES (18/18 pass)
- `npx vitest run` exits 0: YES (34/34 pass, 38 todos, 5 integration test files skipped)

## Test Results

```
Test Files  4 passed | 5 skipped (9)
      Tests  34 passed | 38 todo (72)
```

New tests added (6 route tests):
- Test 1: Valid call returns 200 with results[0].result string
- Test 2: Unknown assistantId returns 200 with 'Service unavailable.'
- Test 3: Unconfigured tool returns 200 with 'Tool not configured.'
- Test 4: GHL executor throws returns 200 with fallback_message
- Test 5: Invalid JSON body returns 200 with results: []
- Test 6: logAction called via after(), not awaited inline

## Known Stubs

None — the route fully implements all required code paths. GHL executors for `send_sms`, `knowledge_base`, and `custom_webhook` throw "Unsupported action type" (documented stub in execute-action.ts from Plan 05); the route handles this correctly via the inner catch returning `toolConfig.fallback_message`.

## Self-Check: PASSED

- `src/app/api/vapi/tools/route.ts` exists: FOUND
- Commit 5e48eb6 (test RED): FOUND
- Commit 4c744dc (feat GREEN): FOUND
- All route tests pass: CONFIRMED
