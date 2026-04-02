# Integrations

**Analysis Date:** 2026-04-02
**Project Status:** Pre-implementation (planning phase — no source code exists yet)

---

## External APIs & Services

### Vapi.ai (Core Integration)

VoiceOps is an operational layer built ON TOP of Vapi — not a competitor. Vapi handles all voice processing (STT, TTS, LLM). VoiceOps receives Vapi events and executes business logic.

**Webhook Events Received (inbound from Vapi):**
- `tool-calls` — Fired during a live call when Vapi triggers a Tool. Received at `POST /api/vapi/tools`. MUST respond within 500ms.
- `end-of-call-report` — Fired at call end. Contains transcript, summary, duration, cost, status. Received at `POST /api/vapi/end-of-call`.
- `status-update` — Fires during call lifecycle. Received at `POST /api/vapi/status`.
- `knowledge-base-request` — Fired when Vapi needs to query the knowledge base during a call. Received at a custom KB endpoint.

**Vapi API Calls (outbound to Vapi):**
- Planned: Outbound campaign dialing — Platform calls Vapi Outbound API to initiate calls per campaign contact.
- Planned: Assistant management lookups — Resolving assistant metadata.
- Client: Planned: `@vapi-ai/server-sdk` 0.11.x
- Auth env var: `VAPI_API_KEY`
- Phone number env var: `VAPI_PHONE_NUMBER_ID`
- Webhook verification: HMAC signature using `VAPI_WEBHOOK_SECRET`
- Implementation location: Planned: `src/lib/vapi/outbound.ts`, `src/lib/vapi/types.ts`

---

### GoHighLevel (CRM — First Priority Integration)

Primary CRM for the first client. First integration to be implemented as it validates the Action Engine with a real use case.

**Actions executed by VoiceOps:**
- `create_contact` — Create or update a contact in the GHL CRM.
- `get_availability` — Check available calendar slots.
- `create_appointment` — Book an appointment on a GHL calendar.

**Configuration (per organization):**
- Credentials stored in `integrations` table: `api_key`, `location_id`, `calendar_id`
- Provider key in DB: `'ghl'`
- Implementation location: Planned: `src/lib/actions/ghl.ts`
- Auth: API Key per organization (stored encrypted)

---

### Twilio (SMS)

Used for sending SMS confirmations or follow-ups during/after voice calls.

**Actions executed by VoiceOps:**
- `send_sms` — Send an SMS via Twilio to a phone number.

**Configuration (per organization):**
- Credentials stored in `integrations` table: `account_sid`, `auth_token`, `phone_number`
- Provider key in DB: `'twilio'`
- Implementation location: Planned: `src/lib/actions/twilio.ts`
- Status: Planned for v1. Executor (`send_sms` action type) listed in v2 requirements as `INTG-01` but included in master prompt Phase 6.

---

### Cal.com (Calendar / Scheduling)

Alternative calendar integration for organizations not using GoHighLevel.

**Actions executed by VoiceOps:**
- `get_availability` — Check available appointment slots.
- `create_appointment` — Book an appointment.

**Configuration (per organization):**
- Credentials stored in `integrations` table: `api_key`, `event_type_id`
- Provider key in DB: `'cal_com'`
- Implementation location: Planned: `src/lib/actions/cal.ts`
- Status: Planned. Cal.com executor listed in v2 requirements as `INTG-02`.

---

### Custom Webhook (Generic Executor)

Allows admins to connect any third-party service by configuring a URL, HTTP method, and headers — no code required.

**Actions executed by VoiceOps:**
- `custom_webhook` — POST/GET/PATCH to any external URL with a configurable payload template.

**Configuration (per organization):**
- Credentials stored in `integrations` table: `url`, `method`, `headers` (JSON)
- Provider key in DB: `'custom'`
- Implementation location: Planned: `src/lib/actions/webhook.ts`
- Status: Planned for Phase 6 (master prompt).

---

### OpenAI (Embeddings for RAG)

Used only for generating vector embeddings. VoiceOps does NOT use OpenAI for LLM inference — Vapi handles all LLM conversation logic.

**Usage:**
- Model: `text-embedding-3-small` — produces 1536-dimension vectors.
- Triggered when: Admin uploads a document (PDF, URL, text, CSV) to the knowledge base.
- Also triggered during calls when a `knowledge_base` tool is invoked — the user's question is embedded for pgvector similarity search.
- Implementation location: Planned: `src/lib/embeddings.ts`
- Auth env var: `OPENAI_API_KEY`
- Client: `openai` 4.x (Node.js and Deno via `npm:openai@4`)

---

## Authentication Providers

### Supabase Auth

Single auth provider for all users (admin and client roles). No OAuth/social login in MVP.

**Method:** Email + password only.

**Roles:**
- `admin` — Agency users. Full access to all organizations, configuration, and management.
- `member` — Client company users. Read-only access to own organization's data (deferred to post-MVP; v2 requirement `CLNT-01`).

**Session management:**
- Planned: `@supabase/ssr` (latest) — Cookie-based session in Next.js middleware. `createServerClient` for Server Components, `createBrowserClient` for Client Components.
- Session persists across browser refreshes (`AUTH-02`).
- Unauthenticated users redirected to login (`AUTH-04`).

**Auth routes:**
- `POST /api/auth/signup`
- `POST /api/auth/login`
- Login page: `src/app/(auth)/login/page.tsx`
- Signup page: `src/app/(auth)/signup/page.tsx`

**Multi-tenant isolation:**
- Supabase RLS policies on every table with `organization_id` column. Even with a code bug, client A cannot read client B's data.
- RLS policy pattern: `USING (organization_id = get_current_org_id())`

---

## Data Sources

### Supabase PostgreSQL (Primary Database)

All application data. Every table includes `organization_id` for tenant isolation enforced at DB level via RLS.

**Tables (planned):**
- `organizations` — Tenant companies managed by the agency
- `users` — Users linked to organizations with roles
- `assistant_mappings` — Links Vapi `assistant_id` values to organizations
- `integrations` — Per-organization encrypted credentials for external services
- `tools_config` — Trigger-to-action configurations per tool per organization
- `knowledge_documents` — Uploaded documents metadata and processing status
- `knowledge_chunks` — Vectorized document chunks (includes `VECTOR(1536)` column for pgvector)
- `outbound_campaigns` — Outbound calling campaign definitions
- `outbound_contacts` — Per-campaign contact lists and call status
- `call_logs` — Complete call records synced from Vapi end-of-call webhook
- `action_logs` — Per-tool execution logs during calls (status, timing, payloads)

**pgvector:**
- Extension: `vector` (enabled via `CREATE EXTENSION vector` on Supabase PostgreSQL 15+)
- Index: `ivfflat` with cosine similarity for `knowledge_chunks.embedding`
- Used for: Semantic search during RAG knowledge base queries. Scoped per `organization_id`.

### Supabase Storage (File Storage)

**Usage:**
- Planned: Stores uploaded knowledge base source files (PDFs, CSVs) before processing pipeline runs.
- Bucket type: Private (scoped per organization).
- Files are processed asynchronously: extract text → chunk (~500 tokens) → generate OpenAI embeddings → store in `knowledge_chunks`.

---

## Communication Channels

### Vapi Webhooks (Inbound)

Vapi sends HTTP POST events to VoiceOps during calls. These are the primary real-time communication channel.

**Inbound webhook endpoints (all Edge Functions):**
- `POST /api/vapi/tools` — Tool execution router. The core of the Action Engine.
- `POST /api/vapi/end-of-call` — Call data ingestion (transcript, summary, metadata).
- `POST /api/vapi/status` — Call status lifecycle updates.

**Security:** HMAC signature verification using `VAPI_WEBHOOK_SECRET`.

**Latency requirement:** All Vapi webhook endpoints MUST respond within 500ms. Edge Function runtime with no cold start is mandatory.

### Vapi API (Outbound — Campaigns)

VoiceOps calls the Vapi REST API to initiate outbound calls for campaign management.

- SDK: `@vapi-ai/server-sdk` 0.11.x
- Used for: Dialing contacts in outbound campaigns at configured cadence (calls per minute).

### Supabase Realtime (Internal)

- Planned: Postgres Changes subscription for real-time campaign contact status updates on the monitoring dashboard.
- No custom WebSocket infrastructure required — Supabase Realtime handles this.

---

## Third-party SDKs

| SDK / Library | Version | Purpose | Runtime |
|--------------|---------|---------|---------|
| `@vapi-ai/server-sdk` | 0.11.x | Vapi API client for outbound calls and assistant management | Node.js + Deno |
| `@supabase/supabase-js` | 2.x | Supabase DB, Auth, Storage, Realtime client | Browser + Node.js + Deno |
| `@supabase/ssr` | latest | Cookie-based SSR auth sessions in Next.js middleware | Node.js (Next.js) |
| `openai` | 4.x | OpenAI API client — embeddings only (`text-embedding-3-small`) | Node.js + Deno |
| `papaparse` | 5.x | CSV parsing for campaign contact imports | Browser + Node.js |

**Note on Deno compatibility:**
Supabase Edge Functions run on the Deno runtime. Packages used in Edge Functions must be imported via `npm:` prefix in `import_map.json` (e.g., `npm:@supabase/supabase-js@2`, `npm:openai@4`, `npm:zod@3`). There are no `node_modules` in the Deno environment.

---

## Integration Configuration Pattern

All external service credentials (GoHighLevel, Twilio, Cal.com, custom webhooks) are stored per-organization in the `integrations` table:

```
integrations table:
  - organization_id  → tenant scope
  - provider         → 'ghl' | 'twilio' | 'cal_com' | 'custom'
  - label            → human-readable name (e.g., "Main GoHighLevel")
  - credentials      → JSONB (encrypted at rest via src/lib/encryption.ts)
  - is_active        → boolean toggle
```

Credentials are encrypted before being written to the database. They are never exposed in the UI. The admin can test a connection via a "Test Connection" button (`POST /api/integrations/:id/test`).

New integrations can be added by:
1. Adding the provider type to the `integrations` table
2. Adding an action handler module in `src/lib/actions/`
3. Adding credential fields to the org settings UI
4. No framework-level changes required — the Action Engine is pluggable.

---

*Integration audit: 2026-04-02*
*Source: VOICEOPS_MASTER_PROMPT.md, .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/REQUIREMENTS.md*
