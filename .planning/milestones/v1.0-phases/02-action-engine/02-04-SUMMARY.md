---
phase: 02-action-engine
plan: "04"
subsystem: ghl-executors
tags: [ghl, http-client, abort-controller, edge-runtime, vapi]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [src/lib/ghl/client.ts, src/lib/ghl/create-contact.ts, src/lib/ghl/get-availability.ts, src/lib/ghl/create-appointment.ts]
  affects: [02-05]
tech_stack:
  added: []
  patterns:
    - Native fetch with AbortController (400ms timeout) — Edge Runtime safe, no node:http
    - ghlFetch wrapper centralizes Authorization + Version headers across all GHL requests
    - ghlFetchJson<T> generic helper throws on non-2xx with structured error message
    - Single-line result strings (no \n) for Vapi response parser safety
key_files:
  created:
    - src/lib/ghl/client.ts
    - src/lib/ghl/create-contact.ts
    - src/lib/ghl/get-availability.ts
    - src/lib/ghl/create-appointment.ts
  modified:
    - tests/ghl-executor.test.ts
decisions:
  - AbortController timeout set to 400ms — leaves 100ms margin within 500ms Vapi budget after 2 DB lookups (~50ms each)
  - ghlFetchJson<T> throws on non-2xx — callers own fallback path (not the executor)
  - getAvailability truncates to first 3 slots across sorted dates — keeps Vapi response brief and single-line
  - appointmentStatus hardcoded to 'confirmed' — GHL API requires this value for calendar booking
metrics:
  duration: "~0 minutes (pre-implemented by 02-05 dependency fix)"
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
requirements: [ACTN-09]
---

# Phase 2 Plan 04: GHL Executor Functions Summary

GHL API v2 HTTP client with shared fetch wrapper and three executor functions (createContact, getAvailability, createAppointment) using AbortController 400ms timeouts and single-line Vapi-safe result strings.

## What Was Built

### src/lib/ghl/client.ts

Shared GHL API v2 fetch wrapper — Edge Runtime safe (native fetch, no Node.js imports). Exports:

- `GhlCredentials` interface — `{ apiKey: string, locationId: string }` (decrypted credentials shape)
- `ghlFetch(path, method, body, credentials, queryParams?)` — Sets `Authorization: Bearer {token}` and `Version: 2021-07-28` headers, attaches AbortController signal with 400ms timeout, clears timer in `finally` block to avoid timer leaks
- `ghlFetchJson<T>()` — Calls `ghlFetch`, throws `GHL API error {status}: {bodyText}` on non-2xx, returns typed JSON

The `clearTimeout` in the `finally` block is critical — without it, pending timers cause test hangs in some vitest environments.

### src/lib/ghl/create-contact.ts

POST `/contacts/` executor. Accepts `Record<string, unknown>` params from Vapi tool arguments, spreads optional `firstName`, `lastName`, `phone`, `email` fields alongside required `locationId` from credentials. Returns `Contact created. ID: {id}` — single-line, no newlines.

### src/lib/ghl/get-availability.ts

GET `/calendars/{calendarId}/free-slots` executor. Accepts `calendarId`, `startDate`, `endDate` (required), and optional `timezone`. Returns up to 3 slots across sorted date keys as `Available slots: {slot1}, {slot2}, {slot3}` — comma-separated single line. Returns `No availability found for the requested dates.` when GHL responds with empty data. Validates required params before calling GHL (throws early with descriptive messages).

### src/lib/ghl/create-appointment.ts

POST `/calendars/events/appointments` executor. Validates all four required params (calendarId, contactId, startTime, endTime) before making the network call. Sends `appointmentStatus: 'confirmed'` and defaults `title` to `'Appointment'` when not provided. Returns `Appointment confirmed. ID: {id}`.

### tests/ghl-executor.test.ts

10 tests across 3 describe blocks — all active (no `it.todo`). Uses `vi.stubGlobal('fetch', mockFetch)` at module scope with `vi.clearAllMocks()` in `beforeEach`. Tests cover:
- Correct URL, method, and required headers per executor
- Result string format and no-newline constraint
- Non-2xx error throwing behavior
- AbortSignal presence on the fetch init object

## Test Results

```
tests/ghl-executor.test.ts — 10 passed, 0 failed, 0 todos
Full suite — 28 passed, 38 todo (integration tests require Supabase connection)
npx vitest run tests/ — exits 0
```

## Commits

| Hash | Message |
|------|---------|
| bc018f8 | feat(02-05): create GHL executor files (02-04 dependency) |

Note: The GHL executor files and tests were committed under the 02-05 commit tag because they were created as a dependency fix during 02-05 execution (Plan 02-05 needed these files to compile before 02-04 was executed).

## Deviations from Plan

### Pre-implemented as Dependency Fix

**[Rule 3 - Blocking Issue] GHL executor files created during 02-05 execution**
- **Found during:** Plan 02-05 task execution
- **Issue:** Plan 02-05 (execute-action dispatcher) imports from `@/lib/ghl/create-contact`, `@/lib/ghl/get-availability`, and `@/lib/ghl/create-appointment`. When 02-05 ran before 02-04, TypeScript compilation and test imports failed because the files didn't exist.
- **Fix:** Created all four GHL files (client.ts + 3 executors) and the full test file with 10 active tests during 02-05 execution, matching the exact implementations specified in this plan.
- **Files created:** src/lib/ghl/client.ts, src/lib/ghl/create-contact.ts, src/lib/ghl/get-availability.ts, src/lib/ghl/create-appointment.ts, tests/ghl-executor.test.ts
- **Commit:** bc018f8

When 02-04 executed, all artifacts were already in place and all 10 tests were passing. No further implementation was needed.

## Known Stubs

None — all four GHL executor files are fully implemented. `ghlFetch` uses real AbortController with 400ms timeout. All three executor functions make real GHL API calls (mocked in tests via `vi.stubGlobal('fetch', mockFetch)`). The implementations are ready to be called by `executeAction()` in Plan 02-05 (already wired).

## Self-Check: PASSED

- src/lib/ghl/client.ts — FOUND (exports ghlFetch, ghlFetchJson, GhlCredentials)
- src/lib/ghl/create-contact.ts — FOUND (exports createContact)
- src/lib/ghl/get-availability.ts — FOUND (exports getAvailability)
- src/lib/ghl/create-appointment.ts — FOUND (exports createAppointment)
- tests/ghl-executor.test.ts — 10 passing tests, 0 todos
- Commit bc018f8 — verified in git log
- AbortController usage — confirmed (TIMEOUT_MS=400, new AbortController(), controller.abort())
- No literal \n in result strings — confirmed (grep returns no matches in return statements)
- npx vitest run tests/ — exits 0
