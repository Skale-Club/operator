---
phase: 04-knowledge-base
plan: "01"
subsystem: database
tags: [pgvector, halfvec, hnsw, rls, migrations, typescript-types]
dependency_graph:
  requires: [001_foundation.sql, 002_action_engine.sql]
  provides: [documents table, document_chunks table, match_document_chunks function]
  affects: [04-02, 04-03, 04-04, 04-05]
tech_stack:
  added: [pgvector extension, halfvec(1536) column type, HNSW index]
  patterns: [SECURITY DEFINER function, tenant-scoped RPC, RLS on vector tables]
key_files:
  created:
    - supabase/migrations/004_knowledge_base.sql
  modified:
    - src/types/database.ts
decisions:
  - Migration numbered 004 (not 003) because 003_observability.sql already exists
  - halfvec(1536) over vector(1536): 50% storage reduction with identical query semantics
  - HNSW over IVFFlat: no pre-population required, works on empty table
  - SECURITY DEFINER + p_organization_id: caller must pass authenticated org ID, function bypasses RLS
  - RLS on document_chunks is SELECT-only: service-role key writes chunks directly, bypassing RLS
metrics:
  duration: 8m
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 4 Plan 01: Knowledge Base DB Migration Summary

Knowledge Base schema with halfvec(1536) pgvector tables, HNSW index, SECURITY DEFINER tenant-scoped match function, and TypeScript Database types.

## What Was Built

### Migration 004_knowledge_base.sql
- `documents` table: id, organization_id, name, source_type (pdf/text/csv/url CHECK), source_url, status (processing/ready/error CHECK), error_detail, chunk_count, created_at, updated_at
- `document_chunks` table: id, organization_id, document_id (CASCADE), content, chunk_index, embedding halfvec(1536), created_at
- HNSW index on `embedding` using `halfvec_cosine_ops`
- Composite index `idx_document_chunks_org_doc(organization_id, document_id)`
- RLS enabled on both tables
- `match_document_chunks` SECURITY DEFINER function: p_organization_id param enforces tenant isolation, cosine similarity ordering via `<=>` operator

### src/types/database.ts
- `documents` table: Row/Insert/Update types with status and source_type union types
- `document_chunks` table: Row/Insert/Update types with `embedding: number[] | null`
- `match_document_chunks` function: Args with p_organization_id, query_embedding, match_count, match_threshold; Returns Array<{id, document_id, content, similarity}>

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration numbered 004 instead of 003**
- **Found during:** Task 1
- **Issue:** Plan specified `003_knowledge_base.sql` but `003_observability.sql` already exists from Phase 3
- **Fix:** Created `004_knowledge_base.sql` to maintain sequential migration ordering
- **Files modified:** supabase/migrations/004_knowledge_base.sql
- **Commit:** 88775bb

## Self-Check: PASSED
- supabase/migrations/004_knowledge_base.sql: FOUND
- src/types/database.ts contains `documents:`: FOUND
- src/types/database.ts contains `document_chunks:`: FOUND
- src/types/database.ts contains `match_document_chunks:`: FOUND
- TypeScript errors: only pre-existing organization-form.tsx errors (out of scope)
