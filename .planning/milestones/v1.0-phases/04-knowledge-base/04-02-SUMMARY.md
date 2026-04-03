---
phase: 04-knowledge-base
plan: "02"
subsystem: knowledge-utilities
tags: [openai, anthropic, unpdf, gpt-tokenizer, cheerio, vitest, embeddings]
dependency_graph:
  requires: []
  provides: [chunkText, extractText, embed, queryKnowledge, test-stubs]
  affects: [04-03, 04-04, 04-05]
tech_stack:
  added: [openai@6, @anthropic-ai/sdk, unpdf, gpt-tokenizer, cheerio]
  patterns: [module-level singleton client, token-aware chunking, cl100k tokenizer]
key_files:
  created:
    - tests/knowledge-base.test.ts
    - src/lib/knowledge/chunk-text.ts
    - src/lib/knowledge/extract-text.ts
    - src/lib/knowledge/embed.ts
    - src/lib/knowledge/query-knowledge.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - query-knowledge.ts created in 04-02 (not 04-04) to satisfy KNOW-06 test import
  - .env.example created but gitignored — documented API key requirements
  - cl100k tokenizer (gpt-tokenizer) matches text-embedding-3-small token counting
  - Module-level OpenAI/Anthropic clients avoid reinstantiation on hot paths
metrics:
  duration: 10m
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 4 Plan 02: npm Packages + Utilities + Test Stubs Summary

Five npm packages installed, three core knowledge utility modules implemented, test stubs covering KNOW-01 through KNOW-06, and query-knowledge.ts created early to enable test compilation.

## What Was Built

### npm Packages
- openai@6.33.0 — embedding API client
- @anthropic-ai/sdk@0.82.0 — Claude haiku synthesis
- unpdf@1.4.0 — PDF text extraction (Mozilla PDF.js wrapper)
- gpt-tokenizer@3.4.0 — cl100k tokenizer for token-aware chunking
- cheerio@1.2.0 — HTML parsing for URL content extraction

### src/lib/knowledge/chunk-text.ts
- `chunkText(text, chunkSize=500, overlap=50)`: uses gpt-tokenizer encode/decode
- Returns empty array for empty/whitespace-only input
- Sliding window with overlap to preserve context across chunks

### src/lib/knowledge/extract-text.ts
- `extractText(file)`: dispatches PDF (unpdf) → text/csv (file.text()) → fallback
- `extractTextFromUrl(url)`: fetch → cheerio load → strip nav/header/footer → body text

### src/lib/knowledge/embed.ts
- `embed(text)`: OpenAI text-embedding-3-small, encoding_format: float
- Module-level singleton client with lazy initialization
- Throws if OPENAI_API_KEY not set

### src/lib/knowledge/query-knowledge.ts
- `queryKnowledge(query, organizationId, supabase)`: embed→RPC→haiku synthesis
- Returns FALLBACK_RESPONSE on empty chunks, RPC error, or any exception
- Uses claude-3-5-haiku-20241022, max_tokens: 256

### tests/knowledge-base.test.ts
- 11 it.todo stubs covering KNOW-01 through KNOW-06
- 3 implemented chunkText unit tests (splitting, single chunk, empty string)
- 1 KNOW-06 queryKnowledge fallback test (mocks OpenAI + Anthropic, empty RPC)
- vitest exits 0: 4 pass, 11 todo

## Deviations from Plan

**1. [Rule 2 - Missing Functionality] query-knowledge.ts created in 04-02**
- **Found during:** Task 1
- **Issue:** The KNOW-06 test stub imports `@/lib/knowledge/query-knowledge` which must exist for vitest to compile and exit 0
- **Fix:** Created query-knowledge.ts in 04-02 instead of waiting for 04-04. The 04-04 plan will simply verify the existing implementation.
- **Files modified:** src/lib/knowledge/query-knowledge.ts
- **Commit:** 09c6052

## Self-Check: PASSED
- tests/knowledge-base.test.ts: FOUND
- src/lib/knowledge/chunk-text.ts: FOUND
- src/lib/knowledge/extract-text.ts: FOUND
- src/lib/knowledge/embed.ts: FOUND
- src/lib/knowledge/query-knowledge.ts: FOUND
- vitest exits 0: CONFIRMED (4 pass, 11 todo)
- npm packages installed: openai, @anthropic-ai/sdk, unpdf, gpt-tokenizer, cheerio all confirmed
