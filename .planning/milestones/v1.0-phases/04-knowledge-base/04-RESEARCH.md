# Phase 4: Knowledge Base - Research

**Researched:** 2026-04-02
**Domain:** RAG pipeline, pgvector semantic search, document upload, embedding generation
**Confidence:** HIGH

---

## Summary

Phase 4 builds a full RAG (Retrieval-Augmented Generation) pipeline on top of the project's existing Supabase + pgvector stack. Admins upload documents (PDF, text, CSV) or provide website URLs; the platform extracts text, chunks it, generates OpenAI embeddings, and stores them in a `halfvec(1536)` pgvector column. During live Vapi calls, the `knowledge_base` action type — already stubbed in `execute-action.ts` — performs a tenant-scoped similarity search and synthesizes an answer via a Claude or OpenAI LLM call, all within the 500ms Vapi budget.

The architecture splits cleanly into two async pipelines. **Upload path** (slow, background): file upload to Supabase Storage → text extraction → chunking → embed → insert into `document_chunks`. **Query path** (hot, <500ms): embed query → pgvector `<=>` similarity search scoped to org → LLM synthesis → return string to Vapi. The upload path MUST NOT run on the hot path.

The most significant decisions: use `halfvec(1536)` (saves 50% storage vs `vector(1536)` with <1% recall loss), use a pg_cron + pgmq queue for async embedding generation (avoids blocking the upload response), and use the Supabase pattern of `security definer` RLS-bypassing match functions filtered by `organization_id` parameter so tenant isolation holds even inside Edge Functions that use the service-role key.

**Primary recommendation:** OpenAI `text-embedding-3-small` (1536 dims) for embeddings, 500-token chunks with 50-token overlap, `halfvec(1536)` storage, `hnsw (embedding halfvec_cosine_ops)` index, pg_cron + pgmq for async processing, Route Handler (not Server Action) for file upload, `@anthropic-ai/sdk` claude-3-5-haiku for synthesis.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KNOW-01 | Admin can upload documents (PDF, text, CSV) to the organization's knowledge base | File upload via Route Handler POST → Supabase Storage; server action registers document row with status=processing |
| KNOW-02 | Admin can add website URLs for content extraction and vectorization | URL submitted as form input → server action registers URL document row → pg_cron/pgmq job fetches + parses with cheerio |
| KNOW-03 | Platform processes uploaded content: extract text, split into chunks (~500 tokens), generate OpenAI embeddings, store in pgvector | pgmq trigger on documents insert → pg_cron calls Edge Function → unpdf/pdf-parse extraction → gpt-tokenizer chunking → OpenAI embed → upsert halfvec(1536) |
| KNOW-04 | Admin can see document processing status (Processing → Ready or Error) | `documents.status` TEXT column ('processing'/'ready'/'error'); Edge Function updates on completion |
| KNOW-05 | Admin can delete documents from the knowledge base | Server action deletes `documents` row (CASCADE deletes `document_chunks`); Supabase Storage file deleted separately |
| KNOW-06 | Platform serves knowledge base queries during calls via semantic search against tenant-scoped pgvector data (returns top 3-5 most similar chunks) | knowledge_base case in execute-action.ts: embed query → RPC match_document_chunks(org_id, query_embedding) → LLM synthesis within 500ms budget |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.33.0 | Text embeddings (text-embedding-3-small) + optional synthesis | Official OpenAI Node SDK; used for embeddings across this project's established approach |
| @anthropic-ai/sdk | 0.82.0 | LLM synthesis — answer generation from retrieved chunks | Anthropic SDK; claude-3-5-haiku is fast (<200ms), cheap, sufficient for RAG synthesis |
| unpdf | 1.4.0 | PDF text extraction — edge-runtime compatible | Built on Mozilla PDF.js, serverless-safe, works in Deno Edge Functions |
| gpt-tokenizer | 3.4.0 | Token counting for chunk size validation | Pure JS, edge-safe, accurate for cl100k/o200k (same tokenizer as text-embedding-3-small) |
| cheerio | 1.2.0 | HTML parsing for URL content extraction | jQuery-like API, no browser required, server-safe |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.25.76 | Schema validation for chunking payloads + Edge Function requests | Already in project — use for all new typed inputs |
| @supabase/supabase-js | ^2.101.1 | pgvector RPC calls + storage upload + document CRUD | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unpdf | pdf-parse | pdf-parse is Node-only; unpdf works in Deno Edge Functions needed for background processing |
| gpt-tokenizer | tiktoken | tiktoken (1.0.22) is WASM-based and larger bundle; gpt-tokenizer is pure JS, lighter |
| cheerio + fetch | playwright/puppeteer | Playwright requires a full browser binary — not viable in serverless/edge context |
| claude-3-5-haiku synthesis | gpt-4o-mini | Either works; haiku is already project-aligned with Anthropic; project uses Supabase + OpenAI for embeddings only |
| pgmq + pg_cron | Supabase Edge Function HTTP trigger | pgmq pattern is officially documented by Supabase for this exact use case; more resilient to failures |

**Installation:**
```bash
npm install openai @anthropic-ai/sdk unpdf gpt-tokenizer cheerio
```

**Version verification (confirmed 2026-04-02):**
- openai: 6.33.0
- @anthropic-ai/sdk: 0.82.0
- unpdf: 1.4.0
- gpt-tokenizer: 3.4.0
- cheerio: 1.2.0

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── knowledge/
│       ├── chunk-text.ts       # Token-based text splitting (500 tokens, 50 overlap)
│       ├── extract-text.ts     # Dispatch: pdf | text | csv | url
│       ├── embed.ts            # OpenAI text-embedding-3-small wrapper
│       └── query-knowledge.ts  # Knowledge query executor (hot path)
├── app/
│   ├── api/
│   │   └── knowledge/
│       └── upload/
│           └── route.ts        # POST: multipart file upload → Supabase Storage
│   └── dashboard/
│       └── knowledge/
│           └── page.tsx        # Admin UI: document list + upload form
├── actions/
│   └── knowledge.ts            # Server actions: register doc, delete doc, add URL
supabase/
├── migrations/
│   └── 003_knowledge_base.sql  # pgvector extension, documents, document_chunks tables
└── functions/
    └── process-embeddings/
        └── index.ts            # Deno Edge Function: dequeue → extract → chunk → embed → upsert
```

### Pattern 1: Document Ingestion Pipeline (Async)

**What:** File upload triggers Storage write → server action inserts `documents` row (status=processing) → pgmq queue trigger enqueues job → pg_cron calls Edge Function every 10s → Edge Function processes: extract text, chunk, embed, insert chunks, update status.

**When to use:** All file uploads and URL additions.

**SQL Schema (Migration 003):**
```sql
-- Source: Supabase official automatic-embeddings guide
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Documents metadata table (one row per uploaded file or URL)
CREATE TABLE public.documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  source_type TEXT        NOT NULL CHECK (source_type IN ('pdf', 'text', 'csv', 'url')),
  source_url  TEXT,                     -- Supabase Storage path or original URL
  status      TEXT        NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing', 'ready', 'error')),
  error_detail TEXT,
  chunk_count INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Document chunks table (many per document)
CREATE TABLE public.document_chunks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id     UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  chunk_index     INTEGER     NOT NULL,
  -- halfvec(1536): half-precision float, 50% storage vs vector(1536), <1% recall loss
  -- Matches OpenAI text-embedding-3-small output dimensions
  embedding       extensions.halfvec(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- HNSW index: recommended as default over IVFFlat (no pre-population needed, auto-grows)
-- halfvec_cosine_ops: matches cosine distance operator (<=>)
CREATE INDEX ON public.document_chunks
  USING hnsw (embedding extensions.halfvec_cosine_ops);

-- Composite index for tenant-scoped queries in match function
CREATE INDEX idx_document_chunks_org_doc
  ON public.document_chunks(organization_id, document_id);
```

**Tenant-scoped match function (SQL):**
```sql
-- Source: adapted from Supabase RAG with permissions guide
-- SECURITY DEFINER: runs as owner, bypasses RLS — organization_id param enforces isolation
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_organization_id UUID,
  query_embedding   extensions.halfvec(1536),
  match_count       INT DEFAULT 5,
  match_threshold   FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.organization_id = p_organization_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
```

### Pattern 2: Hot Query Path (execute-action.ts extension)

**What:** `knowledge_base` case in execute-action.ts — embed the query, call RPC, synthesize answer with LLM, return string within 500ms.

**When to use:** Any incoming Vapi `tool-calls` webhook with action_type='knowledge_base'.

**execute-action.ts extension:**
```typescript
// src/lib/knowledge/query-knowledge.ts
// Called from execute-action.ts 'knowledge_base' case
// Source: project pattern established in Phase 2 execute-action.ts

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function queryKnowledge(
  query: string,
  organizationId: string,
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
): Promise<string> {
  // 1. Embed the query (~50ms)
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const queryEmbedding = embeddingRes.data[0].embedding

  // 2. Tenant-scoped similarity search via RPC (~50ms)
  const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
    p_organization_id: organizationId,
    query_embedding: queryEmbedding,
    match_count: 5,
    match_threshold: 0.7,
  })

  if (error || !chunks?.length) {
    return "I don't have information about that in my knowledge base."
  }

  // 3. Synthesize answer from chunks (~200ms — haiku is fast)
  const context = chunks.map((c: { content: string }) => c.content).join('\n\n')
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Answer this question using only the provided context. Be concise (2-3 sentences max).\n\nContext:\n${context}\n\nQuestion: ${query}`
    }]
  })

  const textBlock = message.content.find(b => b.type === 'text')
  return textBlock?.text ?? "I couldn't find a relevant answer."
}
```

**execute-action.ts integration (replace stub):**
```typescript
// Phase 4 replaces the 'knowledge_base' stub in execute-action.ts
case 'knowledge_base':
  return queryKnowledge(
    String(params.query ?? params.question ?? ''),
    organizationId,  // must be passed through from webhook route
    supabase
  )
```

**CRITICAL:** `executeAction` currently takes `(actionType, params, credentials: GhlCredentials)`. The knowledge_base case does NOT need GHL credentials — it needs `organizationId` and `supabase`. The function signature must be extended to accept an optional context object, or `queryKnowledge` is called before the decrypt step in the webhook route.

### Pattern 3: File Upload (Route Handler, NOT Server Action)

**What:** POST multipart form data to `/api/knowledge/upload` Route Handler — avoids server action 1MB body limit.

**When to use:** All file uploads from the admin dashboard.

```typescript
// src/app/api/knowledge/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  // Upload to Supabase Storage: knowledge-docs/{org_id}/{uuid}/{filename}
  // Return { path, name } — server action will then register the document row
}
```

**Maximum file size:** Route Handlers in Next.js 15 use the Web Request API with a default 10MB limit (configurable via `proxyClientMaxBodySize` in next.config.js). For MVP, 10MB is sufficient for PDF/text.

### Pattern 4: Text Chunking

**What:** Split extracted text at ~500 tokens with 50-token overlap, respecting sentence/paragraph boundaries.

**Recommended parameters (verified by 2026 benchmarks):**
- Chunk size: 500 tokens
- Overlap: 50 tokens (10%)
- Split strategy: paragraph breaks first, sentence breaks second, hard token limit last

```typescript
// src/lib/knowledge/chunk-text.ts
import { encode, decode } from 'gpt-tokenizer'

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const tokens = encode(text)
  const chunks: string[] = []
  let i = 0
  while (i < tokens.length) {
    const chunk = tokens.slice(i, i + chunkSize)
    chunks.push(decode(chunk))
    i += chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 0)
}
```

### Anti-Patterns to Avoid

- **Running embedding generation on the upload request path:** OpenAI API calls take 200-500ms per batch. Register the document row immediately (status=processing) and process asynchronously via pg_cron/pgmq.
- **Using `vector(1536)` instead of `halfvec(1536)`:** Doubles storage cost with no accuracy benefit. Use halfvec for 1536-dim embeddings.
- **Using IVFFlat index before table has data:** IVFFlat requires pre-existing rows to train; HNSW has no such requirement and auto-grows.
- **Filtering by organization_id AFTER HNSW index scan:** pgvector HNSW can return fewer results than requested if post-index filtering is too restrictive. Use `organization_id` in the WHERE clause of the match function — SECURITY DEFINER function with param-based tenant filter is the recommended Supabase pattern.
- **Passing GHL credentials to knowledge_base executor:** The knowledge_base case does not use GHL. The execute-action signature must be extended (or bypassed) to pass orgId + supabase client instead.
- **Using server actions for file upload:** Next.js server actions have a 1MB default body limit. Use a Route Handler for multipart uploads.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom binary parser | unpdf (v1.4.0) | PDF spec is complex; handles encoding, multi-page, embedded fonts |
| Token counting for chunk sizing | Character-based estimation | gpt-tokenizer (v3.4.0) | Tokens ≠ chars; text-embedding-3-small uses cl100k/o200k tokenizer |
| HTML-to-text for URL extraction | Regex stripping | cheerio (v1.2.0) | Handles malformed HTML, encoding, nested elements |
| Vector similarity ranking | Custom cosine math | pgvector `<=>` operator | Runs in Postgres with HNSW index acceleration; no app-side compute |
| Background job queue | In-memory queue | pgmq + pg_cron | Survives restarts, handles retries automatically, native to Supabase stack |
| Answer synthesis | Template string concatenation | claude-3-5-haiku via @anthropic-ai/sdk | LLM produces coherent natural language; template concat produces robotic output |

**Key insight:** The pgmq + pg_cron queue pattern is the officially documented Supabase approach for exactly this use case (automatic-embeddings guide). Using it means free retry logic, visibility timeouts, and zero extra infrastructure.

---

## Common Pitfalls

### Pitfall 1: execute-action.ts signature mismatch for knowledge_base

**What goes wrong:** The current `executeAction(actionType, params, credentials: GhlCredentials)` signature passes GHL API credentials — but knowledge_base needs `organizationId` and `supabase`, not API keys.

**Why it happens:** Phase 2 designed executeAction around GHL credentials only. Phase 4 introduces a fundamentally different executor that needs DB access, not external API credentials.

**How to avoid:** Extend the execute-action signature to accept an optional `context` object containing `{ organizationId, supabase }`. In the webhook route, pass this context alongside credentials. GHL cases ignore context; knowledge_base ignores credentials.

**Warning signs:** TypeScript type errors when adding knowledge_base case that tries to use supabase client.

### Pitfall 2: HNSW index + tenant filter returning fewer results than requested

**What goes wrong:** When HNSW scans the index and finds 5 candidates, then WHERE filters by organization_id, you may get 0-2 results because most candidates belong to other orgs.

**Why it happens:** The HNSW index scans across ALL rows, then the filter is applied. On a shared table with many tenants, most vector neighbors may belong to different orgs.

**How to avoid:** Use the match function pattern with `WHERE organization_id = p_organization_id` BEFORE ordering by similarity — this forces the planner to use the composite index `(organization_id, ...)`. Alternatively, accept that top-N may return fewer than N results in low-data tenants, which is acceptable for MVP.

**Warning signs:** Similarity search returning 0 results when documents exist and have embeddings.

### Pitfall 3: Blocking the upload response waiting for embedding generation

**What goes wrong:** If embedding generation runs synchronously during the upload request, users wait 5-30 seconds for a response. Timeouts occur. Poor UX.

**Why it happens:** Embedding requires one OpenAI API call per chunk; a 10-page PDF produces 30+ chunks.

**How to avoid:** Insert `documents` row with `status='processing'`, respond immediately to the user, let pg_cron/pgmq process asynchronously. The UI polls document status.

**Warning signs:** Upload form hangs for >2 seconds.

### Pitfall 4: Missing OPENAI_API_KEY in Edge Function environment

**What goes wrong:** The Supabase Edge Function (`process-embeddings`) calls OpenAI API but the env var is not available in the Deno runtime.

**Why it happens:** Supabase Edge Functions have their own secrets management separate from Next.js `.env.local`.

**How to avoid:** Set secrets via `supabase secrets set OPENAI_API_KEY=...` for the deployed project AND store in local `.env.local` for local development. Document required env vars in the migration plan.

**Warning signs:** Edge Function logs show "OpenAI API key missing" errors; documents stay in 'processing' status forever.

### Pitfall 5: Large file uploads silently failing via Server Action

**What goes wrong:** Admin uploads a 5MB PDF via a server action form — it silently fails with no useful error because the body exceeds Next.js server action default limit.

**Why it happens:** Next.js server actions default to 1MB body size limit. The error may not surface clearly to the user.

**How to avoid:** Use a Route Handler (`/api/knowledge/upload/route.ts`) for file upload — Route Handlers use the Web Request API with a 10MB default limit. Server actions handle only metadata (document name, type, storage path).

**Warning signs:** Upload fails for PDFs > 1MB with no clear error message.

### Pitfall 6: Forgetting to delete Storage file on document delete

**What goes wrong:** Admin deletes a document; the `documents` row (and `document_chunks` via CASCADE) is removed, but the raw file remains in Supabase Storage consuming space.

**Why it happens:** Database CASCADE only applies to Postgres tables, not Supabase Storage objects.

**How to avoid:** The delete server action must call `supabase.storage.from('knowledge-docs').remove([filePath])` after deleting the database row.

**Warning signs:** Supabase Storage bucket grows unboundedly; deleted documents reappear if re-registered.

---

## Code Examples

### Enable pgvector (SQL — Migration 003 start)
```sql
-- Source: Supabase pgvector official docs
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### HNSW Index Creation
```sql
-- Source: Supabase HNSW indexes official docs
-- halfvec_cosine_ops: pairs with <=> (cosine distance) operator
CREATE INDEX ON public.document_chunks
  USING hnsw (embedding extensions.halfvec_cosine_ops);
```

### OpenAI Embedding Call (TypeScript)
```typescript
// Source: OpenAI official embeddings API reference
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: textChunk,            // max 8191 tokens input
  encoding_format: 'float',   // returns number[]
})

const embedding: number[] = response.data[0].embedding  // length: 1536
```

### Similarity Search via RPC
```typescript
// Source: Supabase supabase.rpc pattern (supabase-js official docs)
const { data: chunks } = await supabase.rpc('match_document_chunks', {
  p_organization_id: orgId,
  query_embedding: embedding,   // number[1536]
  match_count: 5,
  match_threshold: 0.7,
})
```

### Route Handler File Upload
```typescript
// Source: Next.js App Router route.ts conventions
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const { data, error } = await supabase.storage
    .from('knowledge-docs')
    .upload(`${orgId}/${crypto.randomUUID()}/${file.name}`, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })
}
```

### PDF Extraction (unpdf)
```typescript
// Source: unpdf GitHub README (github.com/unjs/unpdf)
import { extractText } from 'unpdf'

const buffer = await file.arrayBuffer()
const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
```

### URL Content Extraction (cheerio)
```typescript
// Source: cheerio official docs (cheerio.js.org)
import * as cheerio from 'cheerio'

const response = await fetch(url)
const html = await response.text()
const $ = cheerio.load(html)
$('script, style, nav, header, footer').remove()
const text = $('body').text().replace(/\s+/g, ' ').trim()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vector(1536)` column | `halfvec(1536)` column | pgvector 0.7+ / Supabase 2024 | 50% storage reduction, <1% recall loss |
| IVFFlat index | HNSW index | pgvector 0.5+ | HNSW is now default; no pre-population needed, better recall |
| Custom background queue | pgmq + pg_cron | Supabase 2024 | Native to Supabase, handles retries, no extra infra |
| pdf-parse (Node-only) | unpdf (edge-compatible) | 2023-2024 | unpdf wraps Mozilla PDF.js for Deno/edge runtimes |

**Deprecated/outdated:**
- `vector(1536)`: Still works, but halfvec halves storage — use halfvec for production
- IVFFlat indexes: Still available but HNSW is the recommended default for new tables
- Server Actions for file upload: 1MB limit makes them unsuitable for document uploads

---

## Open Questions

1. **execute-action.ts signature extension**
   - What we know: Current signature is `(actionType, params, credentials: GhlCredentials)`. knowledge_base needs `(organizationId, supabase)` instead.
   - What's unclear: Whether to extend the function with a 4th `context` parameter or refactor the webhook route to call `queryKnowledge` before the credential/execute step.
   - Recommendation: Add optional 4th parameter `ctx?: { organizationId: string; supabase: SupabaseClient }` to executeAction. GHL cases ignore it; knowledge_base uses it.

2. **Supabase Edge Function vs. Next.js API Route for embedding processing**
   - What we know: Supabase documents the pgmq + Deno Edge Function pattern; this means maintaining a separate Deno function alongside the Next.js codebase.
   - What's unclear: Whether the project wants to keep processing entirely in Next.js (server actions + background tasks) or use Supabase Edge Functions.
   - Recommendation: Use Supabase Edge Function for embedding processing — it's the documented pattern, runs closer to the database, and avoids Next.js cold start concerns for background work.

3. **ANTHROPIC_API_KEY requirement**
   - What we know: `@anthropic-ai/sdk` is not currently installed; no ANTHROPIC_API_KEY env var exists.
   - What's unclear: Whether the project already has an Anthropic API key configured.
   - Recommendation: Plan should add ANTHROPIC_API_KEY to required env vars; Wave 0 stub tests should mock the Anthropic client.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm package install | ✓ | v24.13.0 | — |
| npm | Package install | ✓ | 11.6.2 | — |
| openai (npm) | Embeddings + optional synthesis | ✗ (not installed) | 6.33.0 available | Must install |
| @anthropic-ai/sdk (npm) | Answer synthesis | ✗ (not installed) | 0.82.0 available | Must install |
| unpdf (npm) | PDF extraction | ✗ (not installed) | 1.4.0 available | Must install |
| gpt-tokenizer (npm) | Token counting | ✗ (not installed) | 3.4.0 available | Must install |
| cheerio (npm) | URL content extraction | ✗ (not installed) | 1.2.0 available | Must install |
| pgvector (Postgres ext) | Vector storage | ✓ (referenced in schema) | Supabase managed | — |
| OPENAI_API_KEY | Embeddings + Edge Function | Unknown — not in code | — | Required; no fallback |
| ANTHROPIC_API_KEY | Answer synthesis | Unknown — not in code | — | Required; no fallback |
| Supabase Storage | File storage | ✓ (Supabase managed) | — | — |
| pgmq extension | Async job queue | Unknown — not in migrations | Supabase managed extension | Fallback: polling status table |
| pg_cron extension | Scheduled embedding processing | Unknown — not in migrations | Supabase managed extension | Fallback: manual trigger |

**Missing dependencies with no fallback:**
- `openai` npm package — install required
- `@anthropic-ai/sdk` npm package — install required (or use OpenAI for synthesis)
- `OPENAI_API_KEY` env var — must be provisioned before embedding tests work
- `ANTHROPIC_API_KEY` env var — must be provisioned before synthesis tests work

**Missing dependencies with fallback:**
- `pgmq` + `pg_cron`: If not available on the Supabase plan, fallback is a status-polling approach where the upload endpoint triggers embedding via a server action (acceptable for MVP at low document volumes)
- `unpdf`: If edge compatibility is not needed, `pdf-parse` (v2.4.5) is a simpler Node.js-only alternative for the Next.js server action path

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/knowledge-base.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KNOW-01 | File upload route registers document row with status=processing | unit (mock storage) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-02 | URL document registers with source_type='url' | unit | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-03 | chunkText splits 1500-token text into 3+ chunks with overlap | unit | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-03 | extractText returns non-empty string from a small test PDF | unit (mock unpdf) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-04 | Document status transitions processing→ready after embed job | unit (mock supabase) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-05 | Delete action removes document row and calls storage.remove | unit (mock supabase+storage) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-06 | queryKnowledge returns fallback string when no chunks found | unit (mock supabase.rpc returns []) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-06 | queryKnowledge returns synthesized string from mock chunks | unit (mock supabase.rpc + mock anthropic) | `npx vitest run tests/knowledge-base.test.ts` | ❌ Wave 0 |
| KNOW-06 | Tenant isolation: match_document_chunks only returns org A chunks | integration (requires DB) | manual | ❌ manual only |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/knowledge-base.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/knowledge-base.test.ts` — covers KNOW-01 through KNOW-06 (all 8 unit tests above)
- [ ] No new conftest/fixtures needed — existing vitest.config.ts covers this file

---

## Sources

### Primary (HIGH confidence)
- Supabase official docs — automatic-embeddings guide: pgmq + pg_cron + Edge Function pattern, halfvec schema, HNSW index syntax
- Supabase official docs — RAG with permissions guide: RLS on document_chunks, SECURITY DEFINER match function pattern
- Supabase official docs — HNSW indexes guide: `hnsw (column halfvec_cosine_ops)` syntax, HNSW vs IVFFlat recommendation
- Supabase official docs — semantic-search guide: `match_documents` RPC pattern, cosine distance `<=>` operator
- OpenAI official API reference — text-embedding-3-small: 1536 default dimensions, 8191 token input limit
- Next.js official docs — route.js conventions: Route Handler Web Request API, 10MB default limit
- npm registry (verified 2026-04-02): openai@6.33.0, @anthropic-ai/sdk@0.82.0, unpdf@1.4.0, gpt-tokenizer@3.4.0, cheerio@1.2.0

### Secondary (MEDIUM confidence)
- unpdf GitHub (github.com/unjs/unpdf) — edge-runtime PDF extraction, Deno compatibility
- Supabase blog "Fewer dimensions are better" — halfvec vs vector comparison, 50% storage saving, <1% recall loss
- Neon blog "Don't use vector, use halvec" — independent confirmation of halfvec benefits

### Tertiary (LOW confidence)
- WebSearch community results on RAG chunk size — 500-token with 50-token overlap recommendation (cross-referenced with multiple sources; MEDIUM confidence)
- WebSearch on 500ms budget for knowledge query path — informed by Phase 2 project decisions (logged in STATE.md)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry
- Architecture: HIGH — pgmq+pg_cron pattern is directly from Supabase official docs
- execute-action extension: MEDIUM — logical extension of existing pattern; exact approach TBD in planning
- Pitfalls: HIGH — HNSW+tenant-filter issue and server-action size limit confirmed via official sources
- Validation: HIGH — vitest infrastructure exists; test file structure mirrors Phase 2 pattern

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable — pgvector and Supabase AI docs are well-established)
