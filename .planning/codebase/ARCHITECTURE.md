# Architecture

**Analysis Date:** 2026-04-02

## System Overview

Operator is a multi-tenant integration and orchestration platform. It connects trigger sources (Vapi voice calls, Meta DMs, ManyChat flows, and more) to action targets (GoHighLevel, Twilio, custom webhooks, knowledge base, etc.) per tenant configuration. Vapi is one of several supported sources, not the center of the platform.

The fundamental contract: when a trigger source sends a webhook, Operator receives it, identifies the tenant, resolves the configured automation, executes the action against a third-party API, logs everything, and returns a structured response — all within the source's latency window.

**System boundary diagram (planned):**

```
┌──────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL LAYER                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │   Vapi.ai    │   │  Admin       │   │  Third-Party │             │
│  │  Webhooks    │   │  Browser     │   │  APIs (GHL,  │             │
│  │  (live calls)│   │  (Dashboard) │   │  Twilio, etc)│             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
├─────────┴──────────────────┴──────────────────┴─────────────────────┤
│                      EDGE FUNCTION LAYER                             │
│         (Next.js Route Handlers — export const runtime = 'edge')    │
│  ┌─────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │/api/vapi/   │  │/api/vapi/      │  │/api/vapi/      │            │
│  │tools        │  │end-of-call     │  │status          │            │
│  │(Action Router│  │(Call Logger)   │  │(Status Sync)   │            │
│  └──────┬──────┘  └──────┬─────────┘  └──────┬─────────┘            │
├─────────┴─────────────────┴─────────────────┴──────────────────────┤
│                    SERVERLESS FUNCTION LAYER                         │
│         (Next.js Route Handlers — default Node.js runtime)          │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐          │
│  │Org CRUD   │ │Tool Config│ │Knowledge   │ │Campaign    │          │
│  │& Auth     │ │& Integr.  │ │Upload/Proc │ │Mgmt/Dial   │          │
│  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘ └─────┬──────┘          │
├────────┴─────────────┴─────────────┴──────────────┴─────────────────┤
│                        SERVICE LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Action      │  │  Knowledge   │  │  Vapi API    │               │
│  │  Executors   │  │  Pipeline    │  │  Client      │               │
│  │(GHL, Twilio, │  │(Chunk, Embed,│  │(Outbound,    │               │
│  │ Cal, Webhook)│  │ Search)      │  │ Calls)       │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
├─────────┴─────────────────┴─────────────────┴──────────────────────┤
│                      DATA LAYER (Supabase)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │PostgreSQL│  │   Auth   │  │ Storage  │  │ pgvector │             │
│  │ (RLS)    │  │          │  │(files)   │  │(RAG)     │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Edge Function: Action Router
- Planned location: `src/app/api/vapi/tools/route.ts`
- Runtime: `export const runtime = 'edge'` — mandatory, no exceptions
- Responsibility: Receives Vapi `tool-calls` webhooks during live calls, resolves the tenant from `assistantId`, fetches the tool configuration, dispatches to the correct action executor, logs the result, and returns the Vapi-formatted response within 500ms
- Uses: `lib/supabase/admin.ts` (service role — no user JWT in Vapi webhooks), `lib/actions/registry.ts`, `lib/vapi/resolve-org.ts`

### Edge Function: End-of-Call Logger
- Planned location: `src/app/api/vapi/end-of-call/route.ts`
- Runtime: `export const runtime = 'edge'`
- Responsibility: Receives Vapi `end-of-call-report` events, stores transcript, summary, duration, cost, and call metadata into `call_logs`, links to the tenant via assistant mapping

### Edge Function: Status Sync
- Planned location: `src/app/api/vapi/status/route.ts`
- Runtime: `export const runtime = 'edge'`
- Responsibility: Receives Vapi `status-update` events, updates call status in `call_logs`, triggers `outbound_contacts` status updates for campaign tracking

### Action Executor Registry
- Planned location: `src/lib/actions/`
- Files: `registry.ts` (action_type → executor mapping), `executor.ts` (base interface), `ghl.ts`, `twilio.ts`, `cal.ts`, `webhook.ts`, `knowledge.ts`
- Responsibility: Pluggable action handlers invoked by the Edge Function tool router. Each executor receives `toolConfig` (with decrypted integration credentials) and `toolArgs` (from Vapi), calls the third-party API, and returns a result string for Vapi to speak
- Pattern: Registry lookup by `action_type` string — adding a new integration requires adding one file and one registry entry

### Knowledge Pipeline
- Planned location: `src/lib/knowledge/`
- Files: `extract.ts`, `chunk.ts`, `embed.ts`, `search.ts`
- Responsibility: Processes uploaded documents (PDF, URL, text, CSV) into vectorized chunks — extract text, split into ~500-token chunks, generate `text-embedding-3-small` vectors via OpenAI, store in `knowledge_chunks` table with `organization_id`
- RAG query path: Generates embedding for the user's question → cosine similarity search against tenant-scoped `knowledge_chunks` via pgvector → returns top 3-5 chunks to Vapi

### Multi-Tenant Data Layer (Supabase + RLS)
- Every table with tenant data has an `organization_id` column
- Row Level Security policies enforce that all queries automatically filter by the authenticated user's `organization_id`
- Exception: Edge Functions receiving Vapi webhooks use the `service_role` key (bypasses RLS) and manually enforce tenant isolation by resolving `organization_id` from the trusted `assistant_mappings` table — never from the request body

### Dashboard (Next.js App Router)
- Planned location: `src/app/(dashboard)/`
- Seven modules: Main dashboard (metrics), Assistants (mapping), Integrations (credentials), Tools (Action Engine), Knowledge Base (RAG), Outbound (campaigns), Calls (observability)
- All pages are server components by default; client components only where interactivity is required

---

## Data Flow

### Tool Call During Live Call (Critical Path)

```
Vapi (live call) — user triggers a Tool
    │
    ▼ POST /api/vapi/tools (Edge Function)
    │
    ├── 1. Validate webhook (x-vapi-secret header)
    ├── 2. Extract: toolName, toolArgs, assistantId from Vapi payload
    ├── 3. Resolve org: assistant_mappings WHERE vapi_assistant_id = assistantId
    ├── 4. Fetch tool config: tools_config WHERE org_id = X AND tool_name = Y
    ├── 5. Decrypt integration credentials from integrations table
    ├── 6. Execute action via registry.getExecutor(action_type).execute(config, args)
    ├── 7. Log to action_logs (fire-and-forget via EdgeRuntime.waitUntil if available)
    └── 8. Return { results: [{ toolCallId, result }] } to Vapi
                                                        (< 500ms total)
```

### End of Call — Observability Capture

```
Vapi (call ends)
    │
    ▼ POST /api/vapi/end-of-call (Edge Function)
    │
    ├── 1. Resolve org from assistantId
    ├── 2. Write call_logs: transcript (JSONB), summary, duration, cost, status
    └── 3. Update outbound_contacts status (if outbound campaign call)
```

### Knowledge Base RAG Query

```
User asks question during call
    │
    ▼ Vapi calls knowledge_base tool → POST /api/vapi/tools
    │
    ├── 1. Resolve org
    ├── 2. knowledge.ts executor: generate embedding via OpenAI (text-embedding-3-small)
    ├── 3. pgvector cosine similarity search scoped to organization_id
    ├── 4. Return top 3-5 chunk content strings
    └── 5. Vapi reads chunks to user as context
```

### Knowledge Base Document Processing (Async)

```
Admin uploads document via dashboard
    │
    ▼ POST /api/knowledge/upload (Serverless Function)
    │
    ├── 1. Save raw file to Supabase Storage
    ├── 2. Create knowledge_documents record (status: 'processing')
    ├── 3. Background: extract text (PDF/URL/CSV) → chunk (~500 tokens)
    ├── 4. Background: generate embeddings via OpenAI for each chunk
    ├── 5. Background: insert into knowledge_chunks with organization_id + VECTOR(1536)
    └── 6. Update knowledge_documents status → 'ready' or 'error'
```

### Outbound Campaign Call Dialing

```
Admin starts campaign
    │
    ▼ POST /api/outbound/campaigns/:id/start
    │
    ├── 1. Fetch pending outbound_contacts for campaign
    ├── 2. Respect calls_per_minute cadence
    ├── 3. Dial each contact via Vapi Outbound API (VAPI_API_KEY)
    ├── 4. Record vapi_call_id in outbound_contacts, status → 'calling'
    └── 5. Vapi end-of-call webhook updates contact status → 'completed'/'failed'/'no_answer'
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Edge Functions for all `/api/vapi/*` routes | Vapi is latency-sensitive during live calls. Edge Functions have ~5ms cold starts, are globally distributed, and are co-located with Supabase data. All Vapi webhook routes in `src/app/api/vapi/` MUST export `runtime = 'edge'`. |
| Supabase RLS for multi-tenant isolation | Every table with `organization_id` has RLS enabled. It is architecturally impossible for tenant A to read tenant B's data, even with application-layer bugs. Tenant isolation is enforced at the database level. |
| Service Role only in Vapi webhook handlers | Vapi webhooks carry no user JWT. Edge Functions use the service role key to bypass RLS but always manually filter every query by `organization_id` resolved from `assistant_mappings` — never from untrusted request body fields. |
| pgvector co-located (not external vector DB) | Keeps the stack to a single platform (Supabase). No sync issues, no additional service. Sufficient for projected scale (<1M vectors per tenant). HNSW index can be added if performance degrades. |
| Custom Tools over Vapi's built-in GHL integration | Vapi's native GHL tools are per-assistant and provide no multi-tenant credential management, no action chaining, and no observability. VoiceOps uses Custom Tools with `server.url` pointing to the Action Router Edge Function. |
| Custom KB endpoint over Vapi's built-in Knowledge Base | Vapi's built-in KB has no tenant-scoping and no admin observability. Custom endpoint enables per-tenant pgvector search with full query logging. |
| No ORM (supabase-js + generated types) | Supabase client handles typed queries via generated types. Adding Prisma or Drizzle on top of Supabase's already-typed client adds complexity with no benefit, especially when RLS policies are SQL-first. |
| No client-side global state (nuqs + server state) | This is a server-rendered admin panel, not a SPA. URL state via `nuqs` handles table filters and pagination. Supabase queries provide server state. Redux/Zustand would add unnecessary complexity. |
| Admin panel first, client panel post-MVP | Agency needs to configure and validate the system before exposing read-only views to end clients. Client (member role) dashboard is a v2 requirement. |

---

## Patterns and Paradigms

### Edge/Serverless Runtime Split

All routes in `src/app/api/vapi/` are Edge Functions (`export const runtime = 'edge'`). All other API routes use the default Node.js (serverless) runtime. This boundary is structural — the folder location enforces the runtime requirement visually.

Edge constraints to respect: no `fs` module, Web Crypto API only (not Node.js `crypto`), 2MB bundle limit per function, no Node.js built-ins.

### Action Executor Registry Pattern

The Action Engine uses a registry pattern in `src/lib/actions/registry.ts`. The Edge Function tool router calls `getExecutor(toolConfig.action_type)` to resolve the correct handler. Each executor implements a shared `execute(config, args): Promise<string>` interface. Adding a new integration requires no changes to the router — only a new file in `src/lib/actions/` and a registry entry.

### Latency Budget Strategy

The 500ms Vapi response budget is managed as follows:
- Simple single actions (create GHL contact, check availability): Execute synchronously, respond within 200ms
- Multi-action chains: Execute first action synchronously, return result, defer remainder via `EdgeRuntime.waitUntil()`
- Heavy processing (document ingestion, embedding generation): Respond 200 OK immediately, process in background via `waitUntil()`

### Tenant Resolution Pattern for Webhooks

Vapi webhooks do not carry user JWTs. Org resolution follows this strict pattern (see `src/lib/vapi/resolve-org.ts` — planned):
1. Extract `assistantId` from the Vapi payload
2. Query `assistant_mappings` using service role client to resolve `organization_id`
3. Use the resolved `organization_id` to scope ALL subsequent queries
4. Never trust `organization_id` from the request body

### Database Schema Conventions

- Every tenant-scoped table has `organization_id UUID NOT NULL REFERENCES organizations(id)`
- RLS enabled on all tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- Standard policy pattern: `CREATE POLICY "org_isolation" ON x USING (organization_id = get_current_org_id())`
- Integration credentials stored encrypted in `integrations.credentials JSONB` — AES-256-GCM via `src/lib/encryption.ts` (planned)

---

*Architecture analysis: 2026-04-02*
*Status: Pre-implementation planning phase — no source code exists yet. All items describe planned design.*
