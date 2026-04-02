# Concerns & Risks

**Analysis Date:** 2026-04-02
**Project State:** Pre-implementation (planning phase). No source code exists yet. All concerns are forward-looking based on architecture decisions documented in `.planning/research/PITFALLS.md`, `.planning/research/STACK.md`, `VOICEOPS_MASTER_PROMPT.md`, and `.planning/REQUIREMENTS.md`.

---

## Technical Debt

**IVFFlat index in master prompt vs. HNSW recommendation in research:**
- Issue: `VOICEOPS_MASTER_PROMPT.md` line 181 specifies `CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`. The stack research explicitly states HNSW is the correct choice because IVFFlat requires rebuilding when data changes significantly and HNSW handles changing data without rebuild.
- Files: `VOICEOPS_MASTER_PROMPT.md` (line 181), `.planning/research/PITFALLS.md` (Pitfall 7), `.planning/research/STACK.md`
- Impact: If IVFFlat is implemented as written in the master prompt, knowledge base semantic search performance degrades silently as new chunks are added. Rebuilding the index requires downtime or creates performance gaps during rebuild.
- Fix approach: Use `CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)` from day one. Document this deviation from the master prompt explicitly.

**Missing RLS policy templates for all CRUD operations:**
- Issue: The master prompt provides only a SELECT policy example (`FOR ALL USING ...`). UPDATE policies must have both `USING` and `WITH CHECK` clauses — a missing `WITH CHECK` allows any authenticated user to change an `organization_id` column to another org's ID.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 259-282)
- Impact: A user could reassign their own call_log or action_log to another organization's context via a crafted UPDATE, partially bypassing tenant isolation.
- Fix approach: For every table, define separate SELECT, INSERT, UPDATE (with both USING + WITH CHECK), and DELETE policies. Create a migration template enforcing this pattern.

**Storing all Vapi event types without filtering:**
- Issue: The current schema stores everything through the `call_logs` and `action_logs` tables without explicit filtering of which Vapi event types are persisted. Vapi sends `status-update`, `transcript`, `speech-update`, `conversation-update`, `model-output`, `tool-calls`, and `end-of-call-report` per call. Storing all of them naively creates 20-50 rows per call.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 241-253), `.planning/research/PITFALLS.md` (Pitfall 8)
- Impact: At 100 calls/day across 20 clients (2,000 calls/day), the `call_logs` and `action_logs` tables accumulate millions of rows within months. Dashboard queries slow. Storage costs rise.
- Fix approach: Store only `end-of-call-report` (transcript + summary), `tool-calls` (action logs), and terminal `status-update` (ended). Discard intermediate events or route them to a separate cold-storage table. Implement time-based partitioning by Phase 3.

**No data retention or archiving strategy:**
- Issue: The schema has no defined retention policy for `call_logs` or `action_logs`. There is no archive table, no TTL, no scheduled cleanup.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 220-253), `.planning/REQUIREMENTS.md`
- Impact: Unbounded table growth. Offset-based pagination collapses at ~100K rows. Dashboard aggregation from raw logs becomes unacceptably slow.
- Fix approach: Add time-based indexes on `created_at` for all log tables. Implement cursor-based pagination. Pre-aggregate daily metrics in a summary table updated via a cron job or Supabase trigger.

---

## Security Concerns

**Credential encryption not yet implemented — highest priority before first real client:**
- Risk: The `integrations` table stores `credentials JSONB NOT NULL`. Nothing in the current schema or pseudocode implements AES-256-GCM encryption. If the database is compromised (SQL injection, leaked backup, insider threat), every client's GoHighLevel API keys, Twilio credentials, Cal.com tokens, and custom webhook secrets are exposed. These credentials grant access to client CRMs, phone systems, and calendars — not just VoiceOps.
- Files: `VOICEOPS_MASTER_PROMPT.md` (line 129), `.planning/REQUIREMENTS.md` (ACTN-04), `.planning/research/PITFALLS.md` (Pitfall 3)
- Current mitigation: Schema comment says "(ENCRYPT in production)". `src/lib/encryption.ts` is planned but not written. `ENCRYPTION_KEY` env var is listed in `.env` template.
- Recommendation: Implement `src/lib/encryption.ts` using the Web Crypto API (`crypto.subtle.encrypt` with AES-256-GCM) before any real credentials are saved. Store IV alongside ciphertext. Decrypt only in server-side Edge Functions. Show only "••••••last4" in the admin UI.

**No Vapi webhook signature validation in pseudocode:**
- Risk: The tool router pseudocode in `VOICEOPS_MASTER_PROMPT.md` (lines 478-551) does not include validation of the `X-Vapi-Secret` header or HMAC signature. Any party that discovers the Edge Function URL can POST fake tool-calls to trigger arbitrary CRM writes, SMS sends, or calendar bookings on behalf of any organization.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 478-551), `.planning/research/PITFALLS.md` (Pitfall 6, Security Mistakes table)
- Current mitigation: `VAPI_WEBHOOK_SECRET` env var is listed in the stack research but absent from the master prompt's `.env` template (line 735-750).
- Recommendation: Add `VAPI_WEBHOOK_SECRET` to `.env` template. Add signature validation as step 0 in the tool router before any DB query. Return 401 immediately if validation fails.

**`organization_id` trust boundary in webhook handler:**
- Risk: The pseudocode derives `organization_id` correctly by looking up `assistantId` from the Vapi payload → `assistant_mappings` table. However, if future handlers accept `organization_id` from the request body instead of deriving it, an attacker can modify the payload to target any org.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 490-497), `.planning/research/PITFALLS.md` (Pitfall 6)
- Recommendation: Establish a codebase convention: `organization_id` is ALWAYS derived from authenticated context (JWT → user → org) or the assistant mapping lookup. Never from the request body. Enforce this in code review.

**Service role key exposure risk:**
- Risk: The master prompt lists `SUPABASE_SERVICE_ROLE_KEY` as a required env var (line 739). Edge Functions handling Vapi webhooks necessarily use this key (no user JWT context). If this key is accidentally prefixed `NEXT_PUBLIC_` or leaked into client bundle, it bypasses all RLS.
- Files: `VOICEOPS_MASTER_PROMPT.md` (line 739), `.planning/research/PITFALLS.md` (Security Mistakes table)
- Recommendation: Audit all env var names at project setup. Add a CI lint check that rejects any `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE*` pattern. Never log or return this key in response bodies.

**No rate limiting on Vapi webhook endpoints:**
- Risk: `/api/vapi/tools`, `/api/vapi/end-of-call`, and `/api/vapi/status` are unauthenticated (from Vapi's server). Without rate limiting, these endpoints are vulnerable to DDoS or webhook replay attacks that exhaust Supabase connection limits or run up GoHighLevel/Twilio API costs.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 467-470), `.planning/research/PITFALLS.md` (Security Mistakes table)
- Recommendation: Add rate limiting per IP and per `assistantId` in the Edge Function, or via Vercel's WAF/firewall rules. Reject requests that fail signature validation before any DB query.

---

## Performance Risks

**Sub-500ms Vapi tool-call response — the hardest constraint in the system:**
- Problem: Requirement ACTN-12 mandates Edge Function responses to Vapi within 500ms. The pseudocode tool router executes actions synchronously before returning. A typical chain: Supabase DB lookup (~50ms) + org resolution (~50ms) + GoHighLevel API create contact (~300ms) + Cal.com availability check (~200ms) = ~600ms before the response. Add network jitter and cold start overhead and this regularly blows the budget.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 504-551), `.planning/REQUIREMENTS.md` (ACTN-12), `.planning/research/PITFALLS.md` (Pitfall 1)
- Cause: The pseudocode's `switch (toolConfig.action_type)` block is fully synchronous. The pattern "respond to Vapi immediately, process side effects with `EdgeRuntime.waitUntil()`" is described in the requirements but not reflected in the pseudocode.
- Improvement path: For tool-calls that must return data (availability check, knowledge base query): execute only the data-fetch action synchronously and return. For side-effect actions (create contact, send SMS): use `EdgeRuntime.waitUntil()` to fire-and-forget asynchronously after responding to Vapi.

**Edge Function region vs. Supabase region mismatch:**
- Problem: If the Vercel Edge Function deploys to a region geographically distant from the Supabase instance, each DB query adds 100-200ms of network latency. At 2-3 DB queries per tool-call, this alone can exhaust the 500ms budget before any external API is called.
- Files: `.planning/research/PITFALLS.md` (Pitfall 1, Performance Traps table), `.planning/research/STACK.md`
- Cause: The master prompt and project files specify no explicit region pinning for Edge Functions.
- Improvement path: Pin Vercel Edge Functions to the same region as the Supabase project using `export const preferredRegion = 'iad1'` (or equivalent). Decide on a single region at project setup.

**pgvector without HNSW index collapses at ~1,000 vectors:**
- Problem: The master prompt specifies an IVFFlat index. Even with IVFFlat, without HNSW, vector queries degrade from ~20ms to 5-30 seconds as the knowledge_chunks table grows. During a live call, a 10-second knowledge base lookup means the caller sits in silence.
- Files: `VOICEOPS_MASTER_PROMPT.md` (line 181), `.planning/research/PITFALLS.md` (Pitfall 7, Performance Traps table)
- Improvement path: Replace IVFFlat with HNSW index from initial migration. Always include `organization_id` filter before vector search to prevent scanning all tenants' data. Use `ORDER BY (embedding <=> query_embedding) ASC` (not a computed similarity column) to ensure the index is used.

**Supabase connection pool exhaustion from Edge Functions:**
- Problem: Serverless and Edge Functions create new database connections on each invocation. Without connection pooling via Supabase's transaction-mode pooler, the Postgres connection limit (25 on free tier, 500 on Pro) is exhausted at ~20 concurrent requests, causing 503 errors.
- Files: `.planning/research/PITFALLS.md` (Performance Traps table), `.planning/research/STACK.md`
- Improvement path: Always use the Supavisor transaction-mode pooler connection string (port 6543) in Edge Functions. Set `prepare: false` (prepared statements are incompatible with transaction pooling).

**Dashboard metrics calculated from raw log tables:**
- Problem: Requirements OBS-07 and the dashboard design show aggregated metrics (total calls today/week/month, tool success rate percentage). If these are calculated on-the-fly by counting rows in `call_logs` and `action_logs`, dashboard load time degrades from ~50ms to 3+ seconds at 10K+ rows.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 288-298), `.planning/REQUIREMENTS.md` (OBS-07), `.planning/research/PITFALLS.md` (Pitfall 8)
- Improvement path: Maintain a `daily_metrics` summary table updated via a Supabase Database Trigger or scheduled Edge Function. Dashboard queries read from the summary table, not raw logs.

---

## Scalability Concerns

**RLS policy performance degrades without proper index and `auth.uid()` wrapping:**
- Current capacity: Acceptable with < 10K rows per table per org.
- Limit: At ~10K rows, RLS policies using bare `auth.uid()` without `(select auth.uid())` wrapping cause sequential scans. Supabase benchmarks show unwrapped `auth.uid()` produces 179ms query time vs. 9ms wrapped — a 20x difference.
- Files: `.planning/research/PITFALLS.md` (Pitfall 5), `VOICEOPS_MASTER_PROMPT.md` (lines 271-282)
- Scaling path: Wrap all RLS policy calls in `(select auth.uid())`. Add B-tree indexes on `organization_id` for every table (`CREATE INDEX idx_tablename_org_id ON table_name USING btree (organization_id)`). Add `TO authenticated` to all policies to skip evaluation for `anon` requests.

**Campaign dialing race conditions at scale:**
- Current capacity: Sequential dialing of contacts is safe. Parallel dialing workers on the same campaign are not.
- Limit: When multiple invocations of the campaign engine run concurrently (e.g., a cron job fires twice, or a retry overlaps), the same contact can be dialed twice without database-level locking.
- Files: `.planning/research/PITFALLS.md` (Pitfall 9), `.planning/REQUIREMENTS.md` (CAMP-05, CAMP-06)
- Scaling path: Use `SELECT ... FOR UPDATE SKIP LOCKED` when picking the next batch of contacts. Set contact status to `dialing` atomically before making the Vapi API call. Add a unique constraint on `(campaign_id, contact_id)` to enforce idempotency. Use sequential batch approach for MVP — do not attempt parallel dialing until sequential is proven stable.

**Single `action_logs` table without partitioning:**
- Current capacity: Suitable for MVP with low call volume.
- Limit: Estimated 20-50 action log rows per call. At 2,000 calls/day, the table grows by 40K-100K rows/day. By month three of real traffic, it reaches 3M-9M rows and dashboard queries become sluggish even with indexes.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 241-253), `.planning/research/PITFALLS.md` (Technical Debt Patterns table)
- Scaling path: Acceptable to defer partitioning to Phase 3. When approaching 1M rows, add time-based range partitioning by month. Migrate existing rows during a maintenance window.

**pgvector performance ceiling for knowledge base:**
- Current capacity: pgvector with HNSW handles up to ~10M vectors per tenant before degrading significantly.
- Limit: If a single tenant uploads extremely large document sets (10M+ chunks), index quality degrades. For a small agency platform this is unlikely in the near term but worth planning.
- Files: `.planning/research/STACK.md` (Alternatives Considered), `.planning/research/PITFALLS.md` (Pitfall 7)
- Scaling path: If pgvector proves insufficient, migrate to Supabase Vector Buckets (currently in public alpha as of research date). Do not introduce a separate vector DB — keep the stack co-located.

---

## Known Issues & Pitfalls

**Vapi `assistant-request` hard 7.5-second timeout (non-configurable):**
- For inbound calls where the assistant is dynamically resolved, Vapi enforces a hard 7.5-second end-to-end limit that is not configurable via the Vapi dashboard timeout settings. If the `assistant-request` handler performs slow DB queries or external API calls, the call fails silently and the caller hears nothing.
- Files: `.planning/research/PITFALLS.md` (Pitfall 10)
- Mitigation: The assistant-request handler must perform a single indexed DB query (phone number → assistant mapping). Return an existing `assistantId` — never assemble a transient assistant config or fetch external data in this handler.

**Vapi webhook events are not deduplicated — duplicate webhooks will occur:**
- Vapi may send the same `end-of-call-report` or `status-update` webhook multiple times (network retries, Vapi infrastructure retries). Without idempotent upsert logic, this creates duplicate `call_logs` rows and double-counted metrics.
- Files: `.planning/research/PITFALLS.md` (Integration Gotchas table)
- Mitigation: Use `ON CONFLICT (vapi_call_id) DO UPDATE` (upsert) for `call_logs`. The `vapi_call_id TEXT UNIQUE NOT NULL` constraint in the schema (`VOICEOPS_MASTER_PROMPT.md` line 226) is correct — enforce it.

**Edge Function runtime compatibility — Node.js APIs unavailable:**
- The Edge Runtime (V8-based) does not support Node.js `crypto` module (`crypto.createHash`, `crypto.createCipheriv`), `fs`, `path`, `Buffer` in all contexts, or `require()`. Code that works in local Next.js dev (Node.js runtime) may fail silently or throw at runtime when deployed to the Edge.
- Files: `.planning/research/PITFALLS.md` (Pitfall 4), `.planning/research/STACK.md`
- Mitigation: Use Web Crypto API (`crypto.subtle`) exclusively in all Edge Functions. Use `fetch` directly for REST APIs (GoHighLevel, Twilio, Cal.com) instead of importing their full Node.js SDKs. Keep Edge Function bundle sizes well under 1MB (Vercel Hobby limit after gzip).

**GoHighLevel API rate limits — no retry logic currently planned:**
- GoHighLevel has aggressive rate limits on some endpoints. Under high call volume, GHL API calls from the Action Engine will receive 429 responses. Without exponential backoff, the tool-call fails immediately and the Vapi bot reads the fallback message to the live caller.
- Files: `.planning/research/PITFALLS.md` (Integration Gotchas table)
- Mitigation: Implement exponential backoff with jitter in `src/lib/actions/ghl.ts`. Log 429 responses to `action_logs` with status `rate_limited` (distinct from `error`). Consider request queuing for non-time-critical actions.

**Supabase views bypass RLS by default:**
- If any reporting or convenience views are created in Postgres, they use `security definer` semantics by default, bypassing RLS entirely. A view over `call_logs` would return all organizations' data to any authenticated user.
- Files: `.planning/research/PITFALLS.md` (Integration Gotchas table, Pitfall 2)
- Mitigation: If views are created (e.g., for dashboard aggregations), always add `WITH (security_invoker = true)` on PostgreSQL 15+. Default to materialized tables with scheduled refresh rather than views for aggregated metrics.

---

## Missing Pieces

**No automated multi-tenant isolation tests:**
- What's missing: There are no test cases that create two organizations, insert data as org A, then verify org B receives zero results. Without this, RLS regression can ship silently.
- Files: All RLS policies in `VOICEOPS_MASTER_PROMPT.md` (lines 259-282), `.planning/REQUIREMENTS.md` (TEN-02), `.planning/research/PITFALLS.md` ("Looks Done But Isn't" checklist)
- Risk: A future migration adds a table, forgets `ENABLE ROW LEVEL SECURITY`, and production data from one client becomes visible to another before anyone notices.
- Priority: High — add in Phase 1 alongside the first RLS-protected tables.

**No error alerting or failure notification system (deferred to v2):**
- What's missing: NOTF-01 and NOTF-02 (email alerts for tool execution failures, latency threshold alerts) are explicitly deferred to v2. In the MVP, the only signal that the Action Engine is failing is the admin manually checking the dashboard.
- Files: `.planning/REQUIREMENTS.md` (v2 Notifications section)
- Risk: If the GoHighLevel integration breaks (credentials rotate, API changes), the system silently fails on every call and the admin only discovers it when a client complains. During outbound campaigns, this means hundreds of failed contact attempts with no alert.
- Priority: Medium — acceptable for MVP with one client. Must be addressed before scaling to 5+ clients.

**No billing or usage tracking:**
- What's missing: Usage tracking (call minutes, tool executions, API calls per org) and Stripe integration are out of scope for MVP. Monthly invoicing is handled outside the platform.
- Files: `.planning/REQUIREMENTS.md` (Out of Scope table, v2 Billing section), `.planning/PROJECT.md`
- Risk: The admin has no in-platform visibility into which clients are consuming the most resources. There is no mechanism to enforce per-client usage limits or trigger billing. This is a manual operational burden that will not scale past ~5 clients.
- Priority: Low for MVP, medium for first growth phase.

**Client-facing panel deferred — clients cannot self-serve:**
- What's missing: CLNT-01 through CLNT-03 (client read-only panel showing their own calls, transcripts, metrics) are deferred to v2. In the MVP, all observability is admin-only.
- Files: `.planning/REQUIREMENTS.md` (v2 Client Panel section), `.planning/PROJECT.md` (Out of Scope)
- Risk: Clients cannot independently verify the platform is working on their behalf. The agency must manually pull reports or share admin credentials. Shared admin credentials create a security risk across tenants.
- Priority: Medium — implement the client role panel before onboarding clients who expect self-service access.

**No in-app notifications for real-time campaign monitoring:**
- What's missing: Real-time status updates during outbound campaigns (contact status changing from `pending` → `calling` → `completed`) rely on Vapi webhooks updating the database. The UI has no real-time push — the admin must manually refresh to see progress.
- Files: `.planning/REQUIREMENTS.md` (Out of Scope: In-app notifications), `.planning/research/STACK.md` (Supabase Realtime mentioned)
- Risk: Campaigns appear frozen in the UI. Admins may click "Start" multiple times believing the campaign did not begin, triggering the race condition described in Pitfall 9.
- Priority: Medium — Supabase Realtime (Postgres Changes) is already in the stack. Wire it to the campaign monitor and call list during Phase 5 rather than deferring fully.

**No end-to-end testing for full Vapi round-trip:**
- What's missing: There is no described test harness for simulating a Vapi tool-call webhook → Edge Function execution → result return → under 500ms. End-to-end tests are mentioned in Phase 6 ("Phase 6 — Polish") but are not defined.
- Files: `VOICEOPS_MASTER_PROMPT.md` (lines 864-870), `.planning/research/PITFALLS.md` ("Looks Done But Isn't" checklist)
- Risk: The Action Engine's core correctness and latency are not validated until Phase 6. If architectural decisions made in Phase 1 (e.g., synchronous execution chain) violate the 500ms budget, the rework cost is highest at that point.
- Priority: High — add a lightweight integration test for the tool-call round-trip in Phase 2 immediately after the core Action Engine is built, not in Phase 6.

---

*Concerns audit: 2026-04-02*
*Based on: `VOICEOPS_MASTER_PROMPT.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`*
