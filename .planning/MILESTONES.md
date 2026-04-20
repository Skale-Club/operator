# Milestones

## v1.2 Operator + Embedded Chatbot (Shipped: 2026-04-05)

**Stats:** 6 phases, 21 plans, 31 commits, 63 files, +5,206 / −324 lines
**Timeline:** 2026-04-04 → 2026-04-05 (2 days)
**Stack:** Next.js 15, TypeScript, Supabase (renamed chat tables), Redis, Vercel AI SDK, LangChain, esbuild (widget bundle), Shadow DOM, shadcn/ui + react-resizable-panels v4

**Key accomplishments:**

1. **Brand rename** — VoiceOps → Leaidear → **Operator** (final); canonical origin landed as `https://operator.skale.club`. Deployment host and `vo_active_org` cookie name preserved to avoid breakage.
2. **Embeddable chat widget** — `public/widget.js` bundled via esbuild, Shadow DOM isolation, floating bubble + SSE chat panel, GTM-compatible async load, localStorage session persistence, CORS + OPTIONS preflight on chat route.
3. **Chat API with dual-memory** — POST `/api/chat/[token]` validates per-org `widget_token`, Redis short-term context per session, Supabase long-term history (`conversations` / `conversation_messages`) via service-role client with denormalized `organization_id`.
4. **AI conversation engine** — Plain JSON SSE protocol (`session`/`token`/`tool_call`/`done`), LangChain `SupabaseVectorStore` pre-retrieval with `{ org_id }` filter, mid-stream `executeAction` calls (OpenRouter primary, Anthropic fallback).
5. **Admin widget config** — `/widget` dashboard page, live local preview, normalized `#RRGGBB` color validation, embed code generator, token regeneration with explicit invalidation copy; runtime config hydration via token-scoped public GET endpoint.
6. **Chat Inbox** — Admin dashboard to view/filter/search/reply to widget conversations; tabbed `ConversationList` + `ChatArea` with debug toggle; dual-polling (conversations + messages) via native fetch + setInterval; responsive with ResizablePanelGroup on desktop and CSS-transform slide on mobile.

**UAT:** All 28 requirements validated; human browser verification passed at Plans 04-03, 05-04, and 06-05.

**Known gaps (accepted as tech debt):**

- v1.0 carry-overs still open: HMAC validation on Vapi webhooks, `send_sms` / `custom_webhook` stubs, campaign calls not auto-appearing in Observability
- Widget analytics dashboard deferred to v1.3+
- No visitor identity capture, no human-agent handoff, no multi-language widget (v1.3+)

**Archives:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Knowledge Base (Shipped: 2026-04-03)

**Stats:** 1 commit, 18 files, +2191 / -334 lines
**Timeline:** 2026-04-03 (single-session)
**Stack:** LangChain + Supabase pgvector, Next.js 15, Deno Edge Functions

**Key accomplishments:**

1. **LangChain vector pipeline** — Replaced custom chunking/embedding with LangChain `RecursiveCharacterTextSplitter` + `OpenAIEmbeddings` + `SupabaseVectorStore.fromDocuments()`
2. **Schema migration** — Renamed `documents` → `knowledge_sources` (tracking table), new LangChain-compatible `documents` table with `content/metadata/embedding vector(1536)`, `match_documents` RPC
3. **Semantic search upgrade** — `query-knowledge.ts` uses `SupabaseVectorStore.similaritySearch()` with `org_id` metadata filter for org isolation
4. **Per-org upload limits** — Max 5 files + 5 URLs enforced server-side; UI shows counters (X/5) and disables at limit
5. **OpenAI integration gate** — Upload form disabled and banner shown when org has no active OpenAI integration
6. **AlertDialog for deletions** — Replaced `window.confirm()` with shadcn `AlertDialog` across knowledge base UI

**UAT:** 10/10 tests passed (code audit + migration smoke test)

**Archives:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

---

## v1.0 VoiceOps MVP (Shipped: 2026-04-03)

**Stats:** 6 phases, 30 plans, 95 commits, 231 files, ~44K LOC
**Timeline:** 2026-03-30 → 2026-04-03 (4 days)
**Stack:** Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + RLS + pgvector), Vercel

**Key accomplishments:**

1. **Multi-tenant foundation** — Organizations, assistant mappings, Supabase RLS on all tables, email/password auth with middleware guards
2. **Action Engine** — Edge Function webhook receiver processes Vapi tool calls in <500ms, executes GoHighLevel actions (create contact, check availability, book appointment), logs every execution
3. **Observability** — End-of-call webhook ingestion, paginated call list with 5 filter types, chat-format transcript with inline tool execution badges, dashboard metrics
4. **Knowledge Base** — Document upload (PDF/text/CSV/URL), OpenAI embedding vectorization via Deno Edge Function, tenant-scoped semantic search (pgvector + match_document_chunks RPC)
5. **Outbound Campaigns** — Campaign CRUD, CSV contact import with deduplication, Vapi outbound dialing with cadence control, Supabase Realtime per-contact status board
6. **API Key Admin** — All third-party API keys (OpenAI, Anthropic, OpenRouter, Vapi) migrated from env vars to per-org encrypted integrations with AES-256-GCM

**Audit:** 42/42 requirements wired, 8/8 E2E flows pass, tech_debt status (no blockers)

**Known gaps (accepted as tech debt):**

- No Vapi webhook HMAC/secret validation
- Campaign calls don't auto-appear in Observability call list (deployment config gap)
- 132 todo test stubs (pre-existing)
- send_sms / custom_webhook are v2 stubs

**Archives:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---
