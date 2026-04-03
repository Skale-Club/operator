---
phase: 03-observability
plan: "03"
subsystem: webhook-ingestion
tags: [edge-function, webhook, zod, vapi]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [vapi-end-of-call-schema, calls-webhook-route]
  affects: [03-04, 03-05, 03-06]
tech_stack:
  added: []
  patterns: [Zod schema passthrough, Edge Function, service-role Supabase client, idempotent insert]
key_files:
  created:
    - src/app/api/vapi/calls/route.ts
  modified:
    - src/types/vapi.ts
decisions:
  - "Always returns HTTP 200 — Vapi fires and forgets, no 500ms constraint on end-of-call"
  - "Write synchronously (no after()) — end-of-call webhook has no latency constraint"
  - "23505 error code ignored — idempotent: Vapi may retry the same call"
  - "transcript_turns = artifact?.messages ?? [] (cast to Json) — NOT the flat transcript string"
  - "startedAt/endedAt fallback: message root fields first, then message.call fields"
  - "No organizationId found: log console.warn and return 200 without insert"
metrics:
  duration: "5m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 2
---

# Phase 3 Plan 03: Vapi Schema + Webhook Route Summary

One-liner: ArtifactMessageSchema + VapiEndOfCallMessageSchema Zod schemas and POST /api/vapi/calls Edge Function that always returns 200 and writes calls rows via service-role client.

## What Was Built

- `src/types/vapi.ts`: Appended `ArtifactMessageSchema` (passthrough for transcript turn items) and `VapiEndOfCallMessageSchema` (end-of-call-report payload with nested call, artifact, analysis). All existing exports preserved.

- `src/app/api/vapi/calls/route.ts`: Edge Function (export const runtime = 'edge') that:
  1. Parses JSON body (returns 200 on malformed JSON)
  2. Validates with VapiEndOfCallMessageSchema.safeParse (returns 200 on wrong type)
  3. Extracts call.id as vapiCallId (returns 200 + warn if missing)
  4. Resolves organizationId via assistant_mappings (returns 200 + warn if no mapping)
  5. Inserts calls row with all fields including transcript_turns as artifact.messages
  6. Ignores 23505 duplicate key errors (idempotent retry support)
  7. Always returns new Response(null, { status: 200 })

## Commits

- `27ae6ed` — feat(03-03): add VapiEndOfCallMessageSchema and POST /api/vapi/calls edge function

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/types/vapi.ts VapiEndOfCallMessageSchema: FOUND
- src/app/api/vapi/calls/route.ts: FOUND
- export const runtime = 'edge': FOUND
- 23505 handling: FOUND
- npx tsc --noEmit: no new errors from these files
