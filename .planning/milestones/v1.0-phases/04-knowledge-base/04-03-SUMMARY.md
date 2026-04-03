---
phase: 04-knowledge-base
plan: "03"
subsystem: upload-pipeline
tags: [route-handler, server-actions, deno, edge-function, supabase-storage]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [POST /api/knowledge/upload, insertDocument, addUrlDocument, deleteDocument, process-embeddings Edge Function]
  affects: [04-05]
tech_stack:
  added: [Supabase Deno Edge Function, supabase/functions/process-embeddings]
  patterns: [fire-and-forget async trigger, service-role storage access, Node.js route handler for formData]
key_files:
  created:
    - src/app/api/knowledge/upload/route.ts
    - src/actions/knowledge.ts
    - supabase/functions/process-embeddings/index.ts
decisions:
  - Upload uses Route Handler (NOT server action) to bypass 1MB server action body limit
  - Route Handler uses Node.js runtime (no runtime='edge') — formData() is Node.js only
  - triggerEmbeddingJob is fire-and-forget (void) — upload returns immediately, embedding async
  - Deno Edge Function uses esm.sh CDN imports — no @/ path aliases (Deno incompatible)
  - Sequential embedding loop (not Promise.all) to respect OpenAI rate limits
  - deleteDocument uses service-role client for Storage removal (RLS doesn't apply to storage)
metrics:
  duration: 12m
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 4 Plan 03: Upload Route + Server Actions + Deno Edge Function Summary

Document ingestion pipeline: multipart upload Route Handler, server actions for registration/URL/delete, and async Deno Edge Function for extract-chunk-embed-insert.

## What Was Built

### src/app/api/knowledge/upload/route.ts
- POST handler: auth check → org membership → formData parse → size/MIME validation → Storage upload
- Node.js runtime (no `runtime='edge'`) — formData() requires Node.js
- 10MB limit, PDF/TXT/CSV support, service-role Storage client
- Returns `{ path, name, organizationId }` immediately (no embedding wait)

### src/actions/knowledge.ts
- `insertDocument(storagePath, fileName, sourceType)`: inserts documents row (status=processing), triggers embedding job
- `addUrlDocument(url)`: validates URL format, inserts documents row (source_type=url), triggers embedding job
- `deleteDocument(documentId)`: tenant-scoped delete, removes Storage file for non-URL docs
- `triggerEmbeddingJob(documentId, organizationId)`: fire-and-forget fetch to Edge Function URL

### supabase/functions/process-embeddings/index.ts
- Deno Edge Function triggered by HTTP POST
- esm.sh CDN imports: @supabase/supabase-js@2, openai@6, gpt-tokenizer@3, unpdf@1
- Pipeline: fetch doc metadata → extract text (url/pdf/text) → chunk (500 tokens, 50 overlap) → embed sequentially → batch insert chunks → update status=ready
- Error handling: catches all errors, sets status=error + error_detail, logs + returns 500

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
- src/app/api/knowledge/upload/route.ts: FOUND
- src/actions/knowledge.ts exports insertDocument, addUrlDocument, deleteDocument: CONFIRMED
- supabase/functions/process-embeddings/index.ts exists: FOUND
- grep "Deno.serve": FOUND
- grep "knowledge-docs": FOUND
- grep "esm.sh" CDN imports: FOUND (4 CDN imports)
- vitest exits 0: CONFIRMED
