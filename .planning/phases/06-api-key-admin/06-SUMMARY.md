---
phase: "06"
plan: "01"
subsystem: api-key-admin
tags: [integrations, encryption, openai, anthropic, openrouter, vapi, deno]
dependency_graph:
  requires: [02-action-engine, 04-knowledge-base, 05-outbound-campaigns]
  provides: [api-key-admin]
  affects: [knowledge-base, outbound-campaigns, process-embeddings-edge-fn]
tech_stack:
  added: [openrouter]
  patterns: [db-credential-fetch, per-org-api-keys, conditional-form-fields]
key_files:
  created:
    - supabase/migrations/006_api_key_admin.sql
    - src/lib/integrations/get-provider-key.ts
  modified:
    - src/types/database.ts
    - src/lib/knowledge/embed.ts
    - src/lib/knowledge/query-knowledge.ts
    - src/lib/campaigns/outbound.ts
    - src/lib/campaigns/engine.ts
    - src/app/api/campaigns/[id]/start/route.ts
    - supabase/functions/process-embeddings/index.ts
    - src/components/integrations/integration-form.tsx
    - src/app/(dashboard)/integrations/actions.ts
decisions:
  - "getProviderKey returns null (not throws) on missing/invalid key — callers decide fallback behavior"
  - "queryKnowledge tries OpenRouter first then falls back to Anthropic direct — OpenRouter saves per-org Anthropic key overhead"
  - "campaign start route rolls back status to draft if Vapi key is missing — prevents stuck in_progress campaigns"
  - "Deno edge function decrypts key inline using Web Crypto API to match src/lib/crypto.ts format (ivBase64:ctBase64)"
  - "Anthropic testConnection validates key format (sk-ant- prefix) instead of making a billable API call"
  - "integration-form uses single schema with manual apiKey check at submit for create mode — avoids conditional schema TS complexity"
metrics:
  duration: ~25 min
  completed: "2026-04-02"
  tasks: 6
  files: 9
---

# Phase 06: API Key Admin — Summary

**One-liner:** All third-party API keys (OpenAI, Anthropic, OpenRouter, Vapi) migrated from env vars to per-org integrations table with AES-256-GCM encryption, plus OpenRouter as a new synthesis provider.

## What Was Built

### Task 1: Migration + Types
- `supabase/migrations/006_api_key_admin.sql` — extends `integration_provider` enum with `openai`, `anthropic`, `openrouter`, `vapi` using `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
- `src/types/database.ts` — updated `integration_provider` Enum and `integrations` Row/Insert types with 4 new providers

### Task 2: getProviderKey Helper
- `src/lib/integrations/get-provider-key.ts` — single function that queries integrations table for an org's active key for any provider, decrypts with AES-256-GCM, returns `null` on miss or decrypt failure

### Task 3: Knowledge Base Refactor
- `embed.ts` — removed module-level singleton, now accepts `apiKey: string` parameter directly
- `query-knowledge.ts` — removed module-level OpenAI/Anthropic clients and env var reads; fetches `openai` key for embedding, tries `openrouter` first for synthesis then `anthropic` as fallback; returns `FALLBACK_RESPONSE` if any required key is missing

### Task 4: Campaign Engine Refactor
- `outbound.ts` — replaced `process.env.VAPI_API_KEY` with `vapiApiKey: string` field on `OutboundCallParams`
- `engine.ts` — added `vapiApiKey: string` param to `startCampaignBatch` and `fireContactCall`
- `start/route.ts` — fetches Vapi key via `getProviderKey` after status transition; rolls back to `draft` and returns 400 if key not configured

### Task 5: Deno Edge Function
- `process-embeddings/index.ts` — removed `OPENAI_API_KEY` env var; now queries integrations table for org's `openai` provider key, decrypts inline using Web Crypto API (matches Node.js `crypto.ts` format: `ivBase64:ciphertextBase64`), errors 400 if no integration found

### Task 6: Integration Form + Actions
- `integration-form.tsx` — 8 providers now available; Location ID field conditional on `gohighlevel`; Default Model field appears for `openrouter`; unified schema with submit-time apiKey required check for create
- `actions.ts` — `IntegrationForDisplay.provider` extended; `createIntegration`/`updateIntegration` accept `config` object; `testConnection` routes to provider-specific health checks (OpenAI models endpoint, Anthropic key format check, OpenRouter models endpoint, Vapi assistant list)

## Commits

| Hash | Description |
|------|-------------|
| 834e594 | feat(06): extend integration_provider enum + add getProviderKey helper |
| c6878e9 | feat(06): refactor embed + query-knowledge to fetch keys from DB |
| 70cea75 | feat(06): refactor outbound campaign to fetch Vapi key from DB |
| 1c5c156 | feat(06): refactor Deno Edge Function to decrypt OpenAI key from DB |
| 6bee866 | feat(06): update integration form with new providers and conditional fields |

## Deviations from Plan

**1. [Rule 1 - Bug] Rolled back campaign status on Vapi key miss**
- **Found during:** Task 4
- **Issue:** The plan said to return a 400 if no Vapi key, but the campaign had already been transitioned to `in_progress` before the key check. This would leave the campaign permanently stuck.
- **Fix:** Added rollback update to `draft` before returning the 400 error
- **Files modified:** `src/app/api/campaigns/[id]/start/route.ts`
- **Commit:** 70cea75

**2. [Rule 1 - Bug] Deno decrypt format mismatch**
- **Found during:** Task 5
- **Issue:** The plan's example `decryptKey` used `iv:authTag:cipher` hex encoding, but the actual `crypto.ts` uses `ivBase64:ciphertextBase64` (where AES-GCM appends the auth tag to the ciphertext automatically). Using the plan's hex format would fail to decrypt any existing key.
- **Fix:** Implemented `decryptKey` using `atob()` base64 decode matching the actual Node.js crypto.ts format
- **Files modified:** `supabase/functions/process-embeddings/index.ts`
- **Commit:** 1c5c156

**3. [Rule 2 - Missing functionality] Added config field to updateIntegration**
- **Found during:** Task 6
- **Issue:** `updateIntegration` did not accept a `config` field, so OpenRouter model settings would be lost on edit
- **Fix:** Added `config?: Record<string, string>` to `updateIntegration` signature and data object
- **Files modified:** `src/app/(dashboard)/integrations/actions.ts`
- **Commit:** 6bee866

## Known Stubs

None. All data paths are fully wired — the form saves real data and all key fetches go to the real integrations table.

## Test Results

- 38 passing tests, 132 todos (pre-existing stubs across all phases)
- `npx tsc --noEmit` — 0 new errors in Phase 06 files (pre-existing errors in `organization-form.tsx` and `crypto.ts` are out of scope)

## Self-Check: PASSED

- `supabase/migrations/006_api_key_admin.sql` — FOUND
- `src/lib/integrations/get-provider-key.ts` — FOUND
- `src/lib/knowledge/embed.ts` — FOUND (updated)
- `src/lib/knowledge/query-knowledge.ts` — FOUND (updated)
- `src/lib/campaigns/outbound.ts` — FOUND (updated)
- `src/lib/campaigns/engine.ts` — FOUND (updated)
- `src/app/api/campaigns/[id]/start/route.ts` — FOUND (updated)
- `supabase/functions/process-embeddings/index.ts` — FOUND (updated)
- `src/components/integrations/integration-form.tsx` — FOUND (updated)
- `src/app/(dashboard)/integrations/actions.ts` — FOUND (updated)
- All 5 commits verified in git log
