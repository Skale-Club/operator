---
phase: 02-action-engine
plan: "03"
subsystem: crypto-and-types
tags: [crypto, edge-runtime, zod, vapi, aes-256-gcm]
dependency_graph:
  requires: [02-01]
  provides: [src/lib/crypto.ts, src/types/vapi.ts]
  affects: [02-04, 02-05, 02-06, 02-07]
tech_stack:
  added: []
  patterns:
    - AES-256-GCM via Web Crypto API (crypto.subtle) — no Node.js crypto
    - Random 96-bit IV per encrypt call stored as ivBase64:ciphertextBase64
    - Zod .passthrough() for forward-compatible webhook validation
    - vi.stubEnv() for env-dependent unit tests in vitest node environment
key_files:
  created:
    - src/lib/crypto.ts
    - src/types/vapi.ts
  modified:
    - tests/crypto.test.ts
decisions:
  - Use dynamic import() in tests (not require()) for ESM path alias compatibility with vitest
  - Use manual hex-decode byte loop for ENCRYPTION_SECRET (Buffer.from() is Node.js only)
  - Accept both arguments and parameters on VapiToolCall schema (defensive dual-field)
metrics:
  duration: "~8 minutes"
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements: [ACTN-04]
---

# Phase 2 Plan 03: Crypto Utilities and Vapi Types Summary

AES-256-GCM Edge-safe encryption library and Zod-validated Vapi webhook type definitions — foundational utilities for all subsequent Phase 2 plans.

## What Was Built

### src/lib/crypto.ts
Edge Runtime-safe credential encryption using the Web Crypto API (`crypto.subtle`). Exports three functions:

- `encrypt(plaintext)` — Generates a fresh 96-bit random IV via `crypto.getRandomValues`, encrypts with AES-256-GCM, returns `ivBase64:ciphertextBase64` format
- `decrypt(stored)` — Parses the colon-separated format, reconstructs IV + ciphertext, decrypts to original plaintext
- `maskApiKey(key)` — Returns `••••••••{last4}` display string; never persists the masked form (UI display only)

Key constraint honored: **no `import from 'crypto'` or `from 'node:crypto'`**. The 64-char hex `ENCRYPTION_SECRET` env var is decoded via a manual byte loop (not `Buffer.from()`, which is Node.js-only).

### src/types/vapi.ts
Zod schemas for Vapi tool-call webhook payloads with two key design decisions from research:

- `assistantId` is camelCase (Vapi API reference confirmed — not `assistant_id`)
- `.passthrough()` on the call object allows Vapi to add fields between API versions without rejecting valid webhooks
- Both `arguments` and `parameters` fields are accepted as `.optional()` on `VapiToolCallSchema` — Vapi sends either depending on their internal version

### tests/crypto.test.ts
Updated from 5 `it.todo` stubs to 5 passing tests using `vi.stubEnv('ENCRYPTION_SECRET', TEST_SECRET)`. All tests use dynamic `import()` (not `require()`) for ESM path alias compatibility.

## Test Results

```
tests/crypto.test.ts — 5 passed, 0 failed, 0 todos
Full suite — 6 passed, 59 todo (all other test files remain stubs)
npx vitest run — exits 0
```

## Commits

| Hash | Message |
|------|---------|
| 67b492a | feat(02-03): implement AES-256-GCM encryption library (Edge Runtime safe) |
| e8b21c3 | feat(02-03): add Vapi webhook Zod schemas (VapiToolCallMessageSchema) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed maskApiKey test using require() instead of import()**
- **Found during:** Task 1 GREEN phase
- **Issue:** The test used `require('@/lib/crypto').maskApiKey` which fails in vitest's ESM environment; `@/` path aliases are not resolved by CommonJS require
- **Fix:** Changed to `const { maskApiKey } = await import('@/lib/crypto')` — consistent with the other 4 tests in the same file
- **Files modified:** tests/crypto.test.ts
- **Commit:** 67b492a

## Known Stubs

None — both deliverables are fully implemented and wired. `src/lib/crypto.ts` reads from `process.env.ENCRYPTION_SECRET` at runtime; `src/types/vapi.ts` exports are ready to be consumed by the webhook route in Plan 05.

## Self-Check: PASSED

- src/lib/crypto.ts — FOUND
- src/types/vapi.ts — FOUND
- tests/crypto.test.ts — updated with 5 passing tests
- Commits 67b492a and e8b21c3 — verified in git log
- No Node.js crypto imports — confirmed (grep returns no matches)
- npx vitest run — exits 0
