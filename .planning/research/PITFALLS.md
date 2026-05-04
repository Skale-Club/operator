# Pitfalls Research

**Domain:** Multi-tenant SaaS operations platform for Vapi.ai voice AI assistants
**Researched:** 2026-03-30 (v1.0–v1.2) · 2026-05-04 (v1.3 addendum)
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Vapi Tool-Call Webhook Timeout — Responding Too Slowly

**What goes wrong:**
Vapi expects a tool-call response within its timeout window. If your Edge Function takes too long — because it's doing sequential API calls to GoHighLevel, checking calendar availability, AND sending an SMS before returning — Vapi times out. The assistant on the call either hangs silently, retries (causing duplicate actions), or tells the caller "I'm having trouble." The live caller hears dead air. This is the #1 platform-killer because it directly breaks the core value proposition: "The Action Engine must work."

**Why it happens:**
Developers treat the webhook synchronously — run all actions, then return results. They underestimate cumulative latency: Supabase DB query (~50ms) + GoHighLevel API (~300ms) + Cal.com API (~200ms) + Twilio SMS (~150ms) = ~700ms before the response. Add network jitter and it blows past the 500ms budget. The Vapi `assistant-request` webhook has a hard 7.5-second limit (telephony provider enforces 15s, Vapi reserves ~7.5s for setup), and tool-calls have their own timeout. Edge Function cold starts add 50-200ms on top.

**How to avoid:**
1. **Respond immediately to Vapi** with a placeholder or partial result, then execute actions asynchronously using `EdgeRuntime.waitUntil()` or by returning a quick "processing" result.
2. For tool-calls that MUST return data (like "check availability"): do ONLY the data-fetch action synchronously (one API call), return the result, and defer side-effect actions (create contact, send SMS) to background tasks.
3. Use `EdgeRuntime.waitUntil()` (Supabase Edge Functions) or `waitUntil` (Vercel Edge) to fire-and-forget non-critical side effects.
4. Pin Edge Functions to a region close to your Supabase instance (preferably the same region) to minimize DB round-trips.

**Warning signs:**
- Vapi dashboard shows tool-call timeouts or retries
- Call transcripts show the assistant saying "Let me check..." followed by long pauses
- Action logs show execution times > 400ms end-to-end
- Edge Function cold starts visible in Vercel/Supabase logs

**Phase to address:** Phase 1 (Action Engine core) — this is the first thing that must work

---

### Pitfall 2: Multi-Tenant Data Leakage via Missing or Incorrect RLS Policies

**What goes wrong:**
One organization's data (call logs, contacts, credentials, transcripts) becomes visible to another organization. This is catastrophic for a B2B SaaS — it's an immediate trust violation, potential legal liability, and likely client churn. The most dangerous variant: `organization_id` exists as a column but either (a) RLS isn't enabled on the table, (b) a policy references the wrong column, or (c) the service_role key is used in a context where it shouldn't be, bypassing RLS entirely.

**Why it happens:**
- Developer creates a new table and forgets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Policy uses `auth.uid()` instead of looking up the user's organization via a join, so it checks the wrong thing
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is used in client-side code or in an Edge Function that should use the user's JWT context
- A new migration adds a table but doesn't include the RLS policy in the migration file
- Views are created that bypass RLS by default (Postgres views use `security definer` by default)

**How to avoid:**
1. **Create an event trigger** that auto-enables RLS on all new tables in the `public` schema (Supabase docs provide the exact SQL — included in research sources).
2. **Standardize the RLS pattern**: Every table gets `organization_id`. Every policy uses a helper function like `get_current_org_id()` that resolves `auth.uid() → user_organizations.organization_id`.
3. **Write the helper function as `security definer`** in a non-public schema (e.g., `private`) so it bypasses RLS on the lookup table itself, avoiding circular policy evaluation.
4. **Use `(select auth.uid())` wrapping** in all RLS policies — this causes Postgres to cache the result per statement instead of calling the function for every row (99.94% performance improvement per Supabase benchmarks).
5. **Never use the service_role key in browser code.** In Edge Functions receiving Vapi webhooks (which have no user JWT), use the service_role key but manually validate the Vapi secret AND manually filter by `organization_id` in every query.
6. **Add indexes on `organization_id`** for every table — RLS policies effectively add a WHERE clause on every query, and without an index this becomes a sequential scan.
7. **Write integration tests** that create two orgs, insert data as org A, then query as org B and assert zero results.

**Warning signs:**
- A table exists in `public` schema without `ENABLE ROW LEVEL SECURITY`
- RLS policies that don't reference `organization_id`
- Service role key appearing in frontend bundle or `.env` files with `NEXT_PUBLIC_` prefix
- Views created without `security_invoker = true`
- No automated tests for cross-org data isolation

**Phase to address:** Phase 1 (foundation) — RLS must be correct from the first table

---

### Pitfall 3: Credential Storage in Plain Text

**What goes wrong:**
GoHighLevel API keys, Twilio credentials, Cal.com tokens, and custom webhook secrets are stored as plain text in the database. If the database is compromised (SQL injection, leaked backup, insider threat), every client's third-party credentials are exposed. This is especially severe because these credentials grant access to client CRMs, phone systems, and calendars — not just your platform.

**Why it happens:**
- Speed: encrypting/decrypting adds complexity, and it "works" without it
- Misunderstanding: developers assume Supabase's TLS-in-transit and RLS are sufficient protection
- The encryption key management problem feels hard ("where do I store the encryption key?")

**How to avoid:**
1. **Encrypt credentials at rest** using AES-256-GCM before writing to the database.
2. **Use Supabase Edge Function secrets** for the encryption key (`ENCRYPTION_KEY` environment variable). This key is never in the database, never in the codebase, and never in the frontend.
3. **Decrypt only in Edge Functions** (server-side), never expose decrypted values to the client. The admin UI shows "••••••••" for credentials; only on "test connection" does the server-side code decrypt and use them.
4. **Use the Web Crypto API** (`crypto.subtle`) available in Edge Runtime for encryption — no external libraries needed.
5. Store IV/nonce alongside the ciphertext (they don't need to be secret, just unique).

**Warning signs:**
- `credentials` table has columns like `api_key TEXT` without any encryption/decryption logic
- Frontend code can read full credential values from API responses
- No `ENCRYPTION_KEY` in Edge Function secrets
- Credentials visible in Supabase dashboard table editor

**Phase to address:** Phase 1 (credential storage) — before any real credentials are saved

---

### Pitfall 4: Edge Function Limitations Breaking at Runtime

**What goes wrong:**
Code that works locally in Node.js fails in Edge Functions at runtime. Common failures: using `fs`, `path`, `crypto.createHash` (Node crypto, not Web Crypto), `Buffer` in unsupported ways, `require()` instead of `import`, or importing an npm package that relies on Node.js native APIs. The error appears only in production because local dev with Supabase CLI may behave slightly differently.

**Why it happens:**
- Edge Runtime is V8-based, not Node.js — it supports a subset of Web APIs + a small set of Node modules (`async_hooks`, `events`, `buffer`, `assert`, `util`)
- Code size limit: 1MB (Hobby) / 2MB (Pro) after gzip — importing heavy libraries (full ORM, large SDK) blows this limit
- Maximum CPU time: 2 seconds per request (wall clock is higher, but actual CPU time is capped)
- No `eval()`, no `new Function()`, no dynamic `WebAssembly.compile()`
- Vercel Edge functions must begin sending a response within 25 seconds

**How to avoid:**
1. **Test Edge Functions in the actual runtime early** — don't develop in Node and "convert later."
2. **Use Web Crypto API** (`crypto.subtle.encrypt`, `crypto.subtle.sign`) instead of Node's `crypto` module.
3. **Use ES module imports only** — no `require()`. Check that npm packages support ESM.
4. **Keep bundle size minimal** — avoid importing full SDKs; use `fetch` directly for REST APIs (GoHighLevel, Cal.com, Twilio all have simple REST APIs).
5. **Pin Edge Function regions** close to Supabase DB for lowest latency.
6. **Use `EdgeRuntime.waitUntil()`** for background tasks (logging, async actions) to stay within CPU time limits.

**Warning signs:**
- `import` statements for packages known to use native Node APIs (e.g., `pg` directly, `knex`, heavy ORM)
- Functions that work locally but return 500 errors when deployed
- Bundle size warnings during `vercel deploy` or `supabase functions deploy`
- Using `crypto` without checking if it's `crypto.subtle` (Web Crypto) vs `crypto.createHash` (Node)

**Phase to address:** Phase 1 (all Vapi webhook routes are Edge Functions)

---

### Pitfall 5: RLS Performance Degradation at Scale

**What goes wrong:**
As tables grow (especially `action_logs` and `call_logs` which accumulate rapidly), queries become slow because RLS policies are evaluated per-row. A policy like `auth.uid() = user_id` without wrapping `auth.uid()` in a subquery causes the function to be called for every row. Without indexes on the RLS filter columns, Postgres does sequential scans. At 100K+ rows, queries that took 10ms now take seconds.

**Why it happens:**
- Supabase's own benchmarks show unwrapped `auth.uid()` can be 179ms vs 9ms when wrapped — a 95% improvement
- Missing indexes on `organization_id` means the implicit WHERE clause from RLS does a full table scan
- Complex RLS policies with joins (e.g., checking team membership via a join table) compound the problem — a single join can go from 9ms to 9,000ms without optimization
- Developers don't notice in dev because they have 100 rows, not 100K

**How to avoid:**
1. **Always use `(select auth.uid())`** wrapping in policies — this is non-negotiable.
2. **Add B-tree indexes on `organization_id`** for every multi-tenant table: `CREATE INDEX idx_tablename_org_id ON table_name USING btree (organization_id);`
3. **Minimize joins in RLS policies** — restructure to use `IN (subquery)` instead of joining source to target tables.
4. **Use `security definer` helper functions** for complex lookups (e.g., "is user admin of org X") — these run as the creator (superuser) and bypass RLS on the lookup tables.
5. **Always add explicit filters in application queries** (e.g., `.eq('organization_id', orgId)`) even though RLS handles it — Postgres uses the explicit filter for better query planning.
6. **Specify `TO authenticated`** in all policies — this prevents policy evaluation for `anon` requests entirely.

**Warning signs:**
- RLS policies using `auth.uid()` without `(select ...)` wrapping
- No indexes on `organization_id` columns
- Query performance degrading as data grows
- Dashboard load times increasing over time

**Phase to address:** Phase 1 (schema design) — indexes and policy patterns set from day one

---

### Pitfall 6: Vapi Webhook Without User Context — RLS Bypass Pattern

**What goes wrong:**
Vapi webhooks arrive at your Edge Function without a user JWT — they come from Vapi's servers, not from a logged-in user. If the Edge Function uses the Supabase client with `SUPABASE_ANON_KEY` and tries to rely on RLS, all queries return nothing (because `auth.uid()` is null). If it uses `SUPABASE_SERVICE_ROLE_KEY`, it bypasses all RLS — meaning any bug in the query logic could return or modify the wrong organization's data.

**Why it happens:**
This is a fundamental architectural tension: Vapi doesn't know about Supabase Auth. The webhook payload contains assistant/call metadata but no Supabase user context. The only way to identify the organization is by mapping the `assistantId` (from Vapi payload) to an organization (via database lookup). This lookup itself must use the service_role key.

**How to avoid:**
1. **Accept that Vapi webhook Edge Functions MUST use the service_role key** — this is correct and necessary.
2. **Validate the Vapi webhook authenticity first** — check the `X-Vapi-Secret` header (or HMAC signature) to confirm the request actually came from Vapi.
3. **Always explicitly filter by `organization_id`** in every query — never do `SELECT * FROM action_logs` even with service_role; always `WHERE organization_id = $1`.
4. **Look up organization_id once** (from `assistantId` → `assistants` table → `organization_id`), then pass it explicitly to all subsequent queries.
5. **Never trust client-supplied `organization_id`** from the webhook payload — always derive it from the authenticated assistant mapping.
6. **Log the resolved organization_id** in every action for audit trail.

**Warning signs:**
- Edge Function code using `SUPABASE_ANON_KEY` for Vapi webhooks (queries return empty)
- Edge Function code using `SUPABASE_SERVICE_ROLE_KEY` without explicit `organization_id` filters
- No Vapi webhook signature validation
- `organization_id` read from request body instead of derived from assistant mapping

**Phase to address:** Phase 1 (webhook handler architecture)

---

### Pitfall 7: pgvector Performance Collapse Without Proper Indexing

**What goes wrong:**
Knowledge base semantic search works fine during development with 100 chunks. At production scale (10K+ chunks across multiple organizations), queries take 5-30 seconds because pgvector performs a sequential scan through every vector. The query is even slower if RLS is evaluating per-row against the vector table. During a live call, a 10-second knowledge base lookup means the caller sits in silence.

**Why it happens:**
- No HNSW index created on the embedding column
- Using IVFFlat index instead of HNSW (IVFFlat requires rebuilding when data changes significantly; HNSW handles changing data well)
- RLS policy on the vector table causing additional per-row overhead
- Using too many dimensions (e.g., 1536 from OpenAI `text-embedding-3-small`) when fewer dimensions would suffice
- Not filtering by `organization_id` before the vector search, forcing pgvector to scan all tenants' data

**How to avoid:**
1. **Create HNSW indexes from day one** — unlike IVFFlat, HNSW is safe to create immediately and handles changing data:
   ```sql
   CREATE INDEX idx_documents_embedding ON documents
     USING hnsw (embedding vector_cosine_ops);
   ```
2. **Always include `organization_id` filter** in the match function — filter tenants first, then do semantic search within the org's data.
3. **Consider fewer dimensions** — Supabase's own analysis shows fewer dimensions perform better. Test if 384 or 512 dimensions suffice for your use case (OpenAI's `text-embedding-3-small` supports reducing dimensions).
4. **Use the match function pattern** (RPC via `supabase.rpc()`) — PostgREST doesn't support pgvector operators directly.
5. **Order by the distance operator directly** (not by a computed similarity column) to ensure the index is used:
   ```sql
   ORDER BY (embedding <=> query_embedding) ASC  -- uses index
   -- NOT: ORDER BY similarity DESC               -- ignores index
   ```
6. **Partition or separate vector tables** if one tenant has massively more documents than others (prevents their data from dominating index structure).

**Warning signs:**
- No HNSW index on vector columns
- Knowledge base queries taking > 1 second
- Using IVFFlat instead of HNSW
- Match function scanning all organizations' vectors
- Knowledge base responses timing out during live calls

**Phase to address:** Phase 2 (Knowledge Base / RAG feature)

---

### Pitfall 8: Call Observability Data Volume Explosion

**What goes wrong:**
Every call generates: a transcript, multiple status updates, conversation updates (per message), speech updates, tool-call payloads, and the end-of-call report. For 100 calls/day at 20 clients, that's 2,000 calls/day generating potentially 20-50 database rows each (messages, tool logs, status events). Within months, the `call_logs` and `action_logs` tables have millions of rows. Queries slow down, storage costs increase, and the dashboard becomes sluggish.

**Why it happens:**
- Vapi sends many event types per call (status-update, transcript, speech-update, conversation-update, model-output, tool-calls, end-of-call-report) — storing all of them naively creates enormous tables
- Full request/response payloads for every tool call are stored verbatim
- No data retention policy or archiving strategy
- Dashboard queries do `SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 50` without time-bounded filters, forcing Postgres to scan recent data inefficiently

**How to avoid:**
1. **Be selective about what you store** — you don't need every `speech-update` or `transcript` (partial). Store: `end-of-call-report` (transcript + summary), `tool-calls` (action logs), and `status-update` (ended). Discard intermediate events or store them in a separate cold-storage table.
2. **Separate hot and cold data** — recent calls (last 30 days) in the main query table, older calls in an archive table or Parquet files in Supabase Storage.
3. **Add time-based indexes** on `created_at` for all log tables.
4. **Compress payloads** — store full request/response JSON in a `jsonb` column but consider truncating large payloads or storing only the essential fields.
5. **Paginate dashboard queries** with cursor-based pagination (not offset-based) for consistent performance.
6. **Pre-aggregate metrics** — don't calculate "total calls this month" by counting rows; maintain a daily summary table updated via a cron job or trigger.

**Warning signs:**
- Dashboard "recent calls" query taking > 500ms
- `call_logs` table growing by > 10K rows/day
- Storing every Vapi event type without filtering
- No `created_at` index or time-bounded queries
- Calculating aggregates on-the-fly from raw log tables

**Phase to address:** Phase 2 (Observability feature) — design schema with growth in mind

---

### Pitfall 9: Race Conditions in Campaign Contact Dialing

**What goes wrong:**
Outbound campaigns dial contacts via Vapi Outbound API. If multiple campaign workers or retries fire simultaneously, the same contact gets called twice. Or a contact who already answered gets queued again because the status update hasn't propagated yet. This results in angry recipients (called twice in 5 minutes) and wasted Vapi credits.

**Why it happens:**
- No database-level locking on contact status
- Status updates from Vapi webhooks (`status-update: ringing`, `status-update: ended`) arrive asynchronously — the "dial next batch" logic may execute before the previous batch's statuses are recorded
- Optimistic UI shows "dialing" but the actual dial hasn't completed yet, and the user clicks "dial" again
- Using `SELECT ... WHERE status = 'pending'` without `FOR UPDATE SKIP LOCKED` in concurrent execution

**How to avoid:**
1. **Use `SELECT ... FOR UPDATE SKIP LOCKED`** when picking the next batch of contacts to dial — this prevents two workers from grabbing the same contacts.
2. **Implement idempotency keys** for each dial attempt — Vapi call ID + contact ID as a unique constraint.
3. **Set contact status to 'dialing' atomically** when picked from the queue, before making the Vapi API call.
4. **Use a simple sequential batch approach** for MVP — don't try parallel dialing until the sequential version works perfectly.
5. **Add a cooldown period** per contact — don't retry a number within N minutes of any call attempt.
6. **Process Vapi status webhooks with `UPDATE ... WHERE call_id = $1`** — idempotent by design since Vapi may send duplicate webhooks.

**Warning signs:**
- Same contact appearing in call logs multiple times within minutes
- Campaign showing "50 contacts called" but only 40 unique phone numbers
- No `FOR UPDATE` or `SKIP LOCKED` in contact selection queries
- Concurrent function invocations selecting from the same pending queue
- No unique constraint on (campaign_id, contact_id, attempt_number)

**Phase to address:** Phase 3 (Campaigns feature)

---

### Pitfall 10: Vapi `assistant-request` Hard 7.5-Second Timeout

**What goes wrong:**
For inbound calls where the assistant must be dynamically resolved, the `assistant-request` webhook has a **hard 7.5-second end-to-end limit** (telephony provider enforces 15s, Vapi reserves ~7.5s for call setup). If your Edge Function takes too long to look up the assistant configuration (complex DB queries, slow external API calls), the call fails and the caller hears nothing or gets an error. This timeout is fixed and NOT configurable — the dashboard timeout setting does not apply to this webhook type.

**Why it happens:**
- Developers don't distinguish between `tool-calls` (configurable timeout) and `assistant-request` (7.5s hard limit)
- The assistant lookup involves multiple DB queries or an external API call
- Edge Function is deployed in a region far from the Supabase database
- Over-engineering the response: building a full transient assistant config with dynamic prompts fetched from external sources

**How to avoid:**
1. **Return an existing `assistantId` quickly** — do a simple lookup by phone number → assistant mapping. This should be a single indexed DB query.
2. **If you need dynamic context** (customer name, account info), return a minimal assistant immediately and enrich the context asynchronously using Vapi's Live Call Control API after the call starts.
3. **Pin the webhook Edge Function to a region close to both Vapi (us-west-2) and your Supabase instance.** If they're in different regions, you're spending 100-200ms on network latency alone.
4. **Pre-compute assistant configurations** — don't assemble them on-the-fly from multiple sources.
5. **Cache the phone number → assistant mapping** if possible (Edge Config, or a warm Edge Function instance variable).

**Warning signs:**
- Inbound calls failing silently or with errors
- `assistant-request` response time > 5 seconds
- Complex DB queries in the assistant-request handler
- Edge Function deployed in a region distant from both Vapi and Supabase
- Attempting to fetch external data (CRM, knowledge base) during assistant-request

**Phase to address:** Phase 1 (webhook handler) — but primarily affects inbound calls which may be Phase 2+

---

---

## v1.3 Addendum: Google Reviews Widget + Meta Messaging Pitfalls

**Researched:** 2026-05-04

### Risk Table

| # | Risk | Severity | Affects | Phase |
|---|------|----------|---------|-------|
| G1 | Google Places API caching ban — storing reviews violates ToS | CRITICAL | Google Reviews | Phase 1 (schema) |
| G2 | Hard 5-review cap — no workaround in official API | HIGH | Reviews widget | Phase 1 |
| G3 | Attribution requirements — missing "Powered by Google" | HIGH | Reviews widget | Phase 1 (widget render) |
| G4 | New vs Legacy Places API — legacy cannot be newly enabled | MEDIUM | Reviews feature | Phase 1 |
| G5 | Billing surprise — $200/month free credit, then per-call charges | MEDIUM | Reviews feature | Pre-development |
| M1 | Meta App Review blocks production for all real users | CRITICAL | Meta Messaging | Pre-development setup |
| M2 | Business Verification required separately from App Review | CRITICAL | Meta Messaging | Pre-development setup |
| M3 | Development mode restriction — only app-role users can message | HIGH | Meta Messaging | Phase 1 dev |
| M4 | Raw body consumed before HMAC — Next.js App Router pitfall | HIGH | Meta webhooks | Phase 1 |
| M5 | User Access Token → Page Access Token chain — wrong token type | HIGH | Meta token storage | Phase 1 |
| M6 | Page Access Token invalidated on password change | HIGH | Meta token storage | Phase 1 |
| M7 | 24-hour window — automation stops, Message Tags deprecated Feb 2026 | HIGH | Inbox reply engine | Phase 2 |
| M8 | Instagram inbox not marked read via API | MEDIUM | Inbox UI | Phase 2 |
| M9 | Instagram DM uses Messenger Platform architecture — not a separate API | MEDIUM | Architecture | Phase 1 |
| M10 | Multi-tenant token storage — one leaked token exposes one client | HIGH | Security | Phase 1 |
| V1 | Vercel Hobby 4.5 MB payload limit on webhook routes | MEDIUM | Meta webhooks | Phase 1 |
| V2 | Vercel Hobby 60-second function timeout — Meta events must ack fast | MEDIUM | Meta webhooks | Phase 1 |
| I1 | Channel routing collision — wrong reply sent to wrong channel | CRITICAL | Inbox extension | Phase 2 |
| I2 | Conversation deduplication — same sender on multiple channels creates duplicate threads | HIGH | Inbox extension | Phase 2 |

---

### G1: Google Places API Caching Ban

**What goes wrong:**
The project plan says "capture up to 5 reviews, store in DB." The Google Places API Terms of Service explicitly prohibit pre-fetching, caching, or storing Places API content beyond narrow exceptions. Storing reviews in a Supabase table, then serving them from that table to the embeddable widget, is caching — and it violates Google's ToS. Google can terminate API access without warning.

**Why it happens:**
The intent (store once, serve many times from DB to avoid API cost per widget load) makes engineering sense. The ToS prohibition is not obvious and is buried in the policy page, not the API quickstart.

**What is actually allowed:**
- `place_id` values can be stored indefinitely (explicitly exempt)
- Other data can be cached for up to 30 days (per Google policy as of 2026)
- Reviews must be fetched fresh or cached only transiently, not served statically from your DB

**The practical interpretation for this project:**
The project intends to store up to 5 reviews per location and serve them via widget embed. This is only compliant if:
1. Reviews are refreshed regularly (e.g., daily sync job), AND
2. Each widget load serves the cached DB copy only if it was fetched within 30 days
3. Attribution is preserved exactly as returned by the API (author name, photo, link)

**Prevention:**
- Store reviews with a `fetched_at` timestamp
- Run a daily refresh job (Supabase Edge Function cron or GitHub Actions) per location
- Never serve stale data older than 30 days without re-fetching
- Display the exact author attribution fields returned by the API — do not discard them
- Include `place_id` in the schema even if not displayed — it is the only field that can be stored long-term without restriction

**Detection:**
- Widget serving review data that doesn't change when Google reviews change
- Reviews older than 30 days being served without re-fetch

**Phase to address:** Phase 1 schema design — the `google_reviews` table must include `fetched_at` and the refresh mechanism must be planned before the table is created.

---

### G2: Hard 5-Review Cap on Places API

**What goes wrong:**
The Google Places API (both legacy and new) returns at most 5 reviews per place, ranked by "most relevant." There is no pagination, no offset, no way to get reviews 6–10. This is a hard platform limit, not a quota limit.

**Why it happens:**
Google restricts reviews to encourage use of Google Maps embed rather than third-party display. The Google My Business API can return more reviews but requires a separate approval process (weeks of review, written and video applications).

**Practical impact for this project:**
The target feature is "capture up to 5 reviews" — this is already aligned with the limit. The risk is if a client asks "can we show our 50 reviews?" — the answer is no via the official API. Any third-party scraping approach violates ToS and risks the API key being revoked.

**Prevention:**
- Document in the admin UI that the widget shows "up to 5 most relevant reviews as ranked by Google"
- Do not promise configurable review count beyond 5
- Do not implement any scraping fallback — it violates ToS and creates legal risk
- If a client needs more reviews, Google My Business API is the official path, but factor in the multi-week approval timeline

**Phase to address:** Phase 1 feature scope — establish the 5-review ceiling as a documented constraint before building.

---

### G3: Google Attribution Requirements — "Powered by Google" Branding

**What goes wrong:**
Places API data displayed outside a Google Map must include the Google logo. Missing or incorrectly placed attribution violates ToS and can trigger API key revocation. The most common mistake: displaying review stars and text without the "Powered by Google" logo, or using a custom "Google" text label without the official logo asset.

**Exact requirements (HIGH confidence — from official policy page):**
- Attribution must take the form of the Google Maps logo whenever possible
- In space-constrained situations, the text "Google Maps" is acceptable
- Attribution must be positioned near the content (top, bottom, or side)
- Attribution must maintain accessible contrast ratios
- The logo must not be modified or obscured
- Author name must be displayed in close proximity to each review
- Author photo and profile link must be included when available in the API response

**Prevention:**
- Use the official Google logo asset provided by Google's Brand Resource Center
- Position "Powered by Google" as part of the widget design from the first wireframe — retrofitting attribution is messy
- Preserve the full `author_name`, `author_url`, `profile_photo_url` fields from the API response — store them alongside review text in the DB
- Widget render must display author attribution per review, not just a blanket footer

**Phase to address:** Phase 1 widget design — attribution is a design constraint, not a later polish item.

---

### G4: New vs Legacy Places API — Legacy Cannot Be Newly Enabled

**What goes wrong:**
If the project tries to use the legacy Places API (the one that has been documented in most tutorials and StackOverflow answers for the past 5 years), it may find that new projects cannot enable it. Google has migrated to the Places API (New), which has different field names, requires field masking in requests, and has a different response structure for reviews.

**Key differences for review fields:**
- Legacy: `PlaceResult.reviews[]` with `text`, `rating`, `author_name`, `author_url`, `profile_photo_url`
- New: `Place.reviews[]` with `text.text`, `rating`, `authorAttribution.displayName`, `authorAttribution.uri`, `authorAttribution.photoUri`
- New API requires field masking: `&fields=id,reviews` — requests without a field mask return nothing or an error
- `place_id` is still the standard identifier and works in both versions

**Prevention:**
- Use the Places API (New) from the start — do not follow legacy tutorials
- The server-side fetch URL changes from `https://maps.googleapis.com/maps/api/place/details/json` to `https://places.googleapis.com/v1/places/{place_id}` with `X-Goog-FieldMask` header
- Map the new field paths in the DB schema: store `author_display_name`, `author_uri`, `author_photo_uri`

**Phase to address:** Phase 1 — set up against the new API from day one.

---

### G5: Google Places API Billing — The $200 Credit and What Happens After

**What goes wrong:**
Google provides a $200/month free credit across all Maps Platform products. For a multi-tenant SaaS with many client locations, each Place Details (New) call costs ~$0.017 (as of 2026). If 50 clients each have 5 locations and the daily refresh job runs once a day: 50 × 5 × $0.017 = $4.25/day = ~$127/month — under the credit. But if usage grows or the refresh runs more frequently, costs exceed the free tier and billing kicks in silently unless a budget alert is configured.

**What happens when quota is exceeded:**
If a daily cap is set in Google Cloud Console, the API returns HTTP 429 and the widget stops loading reviews. If no cap is set and billing is enabled, charges accrue. If billing is not enabled and the free tier is exhausted, the API returns HTTP 429.

**Prevention:**
- Set a daily quota cap in Google Cloud Console as a safety net
- Configure billing alerts at $50 and $150
- Design the refresh job to run once per day maximum per location
- Store `fetched_at` so the refresh job skips recently-updated locations
- Use `place_id` (free, exempt from caching restrictions) as the persistent identifier — only the review fetch call costs money

**Phase to address:** Pre-development setup — billing and quota configuration before the first API call.

---

### M1: Meta App Review Blocks All Real Users Until Approved

**What goes wrong:**
While the Meta app is in Development Mode, only users with an explicit role on the app (Developer, Tester, Admin) can interact with it. This means:
- Only those specific Facebook/Instagram accounts can send messages that the app receives
- Real clients' Instagram or Facebook pages cannot connect to the app
- Real end-users cannot send messages that the app processes

App Review is required before any user who does not have a role on the app can use it. For a multi-tenant SaaS where each client org connects their own Facebook Page and Instagram account, App Review is not optional.

**Timeline (MEDIUM confidence — based on Meta documentation and community reports):**
- App Review submission review time: typically 2–7 business days for first submission
- Rejections add 3–5 days per round-trip
- Business Verification (separate step): 2–5 business days after document submission
- Total realistic timeline before first real client can connect: 2–6 weeks if first submission passes; 4–10 weeks if rejected once

**What blocks development testing:**
During development, only app-role users can test. This means the developer must add their own Facebook/Instagram account as a Tester, connect their own Page, and test with messages sent from test accounts. You cannot test with a client's real production Page until App Review is approved.

**Prevention:**
- Submit the Meta app for review BEFORE writing the first line of inbox code — not after
- Business Verification must be done first (required before Advanced Access App Review)
- Add at minimum 2-3 test Instagram/Facebook accounts as Testers on the app during development
- Create a dedicated test Facebook Page and Instagram Business account for development
- The App Review submission requires: working demo screencast per permission, test user credentials for the reviewer, privacy policy URL, and a description of use case
- Request only the permissions actually implemented at time of submission — requesting unimplemented permissions causes rejection

**Permissions required for this project (HIGH confidence — from Meta docs):**
- `instagram_basic` — read IG profile info
- `instagram_manage_messages` — read and send IG DMs
- `pages_manage_metadata` — subscribe webhooks to the Page
- `pages_messaging` — for Messenger (Facebook Page messages)
- `pages_show_list` — list Pages the user manages

All of `instagram_manage_messages`, `pages_manage_metadata`, and `pages_messaging` require **Advanced Access**, which requires both App Review AND Business Verification.

**Phase to address:** Pre-development — this is the first action item before any Meta code is written. Submit for Business Verification immediately.

---

### M2: Business Verification is Separate From App Review — Both Required

**What goes wrong:**
Developers assume App Review is the only gate. Business Verification is a separate Meta process that must be completed before the App Review for Advanced Access permissions will be granted. You can submit an App Review without completing Business Verification, but it will be denied.

**What Business Verification requires:**
- Official business documentation (business license, certificate of incorporation, or tax registration)
- Must match the business name on the Meta Business Manager account
- Takes 2–5 business days after document submission
- Cannot be expedited

**Prevention:**
- Start Business Verification on day one of the milestone — it is a pure waiting game with no engineering dependency
- Ensure the Meta Business Manager account is set up under the correct legal entity
- Keep the verification documents ready (PDF format, clear/recent)

**Phase to address:** Pre-development setup — week 1 of the milestone, independent of any code.

---

### M3: Development Mode Restriction — Test User Limitation

**What goes wrong:**
In Development Mode, only users explicitly added to the app with a role (Developer, Tester, Admin) can authenticate and interact with it. The specific failure mode: a client tries to connect their Instagram Business account during your development/testing phase, and they see an error or the OAuth completes but their messages never arrive. This wastes client time and damages trust.

**Prevention:**
- During development, add the specific test Instagram/Facebook accounts as Testers in the app dashboard
- Only use these test accounts for all webhook testing
- Communicate clearly to any clients observing development: their real Pages cannot be connected until App Review approval
- Use ngrok or a stable public URL (operator.skale.club routes) for webhook testing — Meta webhook verification will fail on localhost

**Phase to address:** Phase 1 — document this constraint before inviting any client to test.

---

### M4: Raw Body Must Be Read Before JSON Parsing for HMAC Verification

**What goes wrong:**
Meta signs webhook payloads with HMAC-SHA256 using the app secret. The signature is in the `X-Hub-Signature-256` header as `sha256={hex}`. Verification requires computing HMAC-SHA256 over the **exact raw bytes** of the request body. In Next.js App Router, if you call `request.json()` first (which is the natural instinct), the body stream is consumed. You cannot then get the raw bytes. Attempting to re-serialize the parsed JSON and hash that will produce a different hash if there are any whitespace or key-ordering differences, causing all webhook verification to fail permanently.

**The correct pattern for Next.js App Router route handlers:**

```typescript
export async function POST(request: Request) {
  const rawBody = await request.text()           // read raw bytes first
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET!)
    .update(rawBody)
    .digest('hex')
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return new Response('Forbidden', { status: 403 })
  }
  
  const payload = JSON.parse(rawBody)            // parse after verification
  // ... handle payload
}
```

Note: This uses Node.js `crypto` (available in Next.js Node runtime route handlers, which is what `export const runtime = 'nodejs'` gives you). This is different from the Supabase Edge Function context.

**Additional verification detail:**
- Meta sends a GET request for webhook verification with `hub.mode=subscribe`, `hub.challenge={int}`, `hub.verify_token={your_token}` as query params
- Respond with the raw integer value of `hub.challenge` (not JSON-wrapped) and HTTP 200
- On POST events, respond with HTTP 200 quickly — Meta retries if no 200 is received within a short window

**Prevention:**
- Always use `request.text()` as the first body read operation in webhook handlers
- Use `crypto.timingSafeEqual()` — not string comparison — to prevent timing attacks
- Store the app secret in `process.env` (never `NEXT_PUBLIC_`)
- Return HTTP 200 on the POST even before processing is complete — then process asynchronously

**Phase to address:** Phase 1 webhook infrastructure — the first webhook route must get this right.

---

### M5: Wrong Token Type — User Access Token vs Page Access Token

**What goes wrong:**
After the OAuth flow, you receive a **User Access Token** (short-lived, 1–2 hours). This token must be exchanged for a **Long-Lived User Access Token** (60 days), which is then used to fetch **Page Access Tokens** (long-lived, non-expiring under normal conditions). Using the short-lived User Access Token directly to send messages or call the Graph API will work during development but will silently fail after an hour in production.

**Token chain:**
```
Short-lived User Access Token (1-2 hours)
  → exchange via /oauth/access_token with client_id, client_secret
  → Long-Lived User Access Token (60 days)
  → GET /{user-id}/accounts (returns Page Access Tokens)
  → Long-Lived Page Access Token (does not expire unless invalidated)
```

**What "does not expire" actually means:**
Long-lived Page Access Tokens do not have a set expiry date, BUT they are invalidated when:
- The user who authorized the app changes their Facebook password
- The user revokes the app's permissions
- The app's permissions change
- The user account is disabled or deactivated

**For a multi-tenant SaaS:**
Each org that connects a Facebook Page generates its own User Access Token → Page Access Token. These must be stored per org (encrypted with AES-256-GCM, same pattern as GHL credentials). The invalidation is unpredictable — the platform must detect it and prompt re-authorization.

**Token invalidation detection:**
When a Graph API call returns error code 190 (OAuthException, `token has expired or been revoked`), the stored token is invalid. The platform should:
1. Mark the channel connection as `status = 'token_expired'`
2. Surface a re-connect prompt in the admin UI for that org
3. Not crash or silently fail — surface the error clearly

**Prevention:**
- Implement the full token exchange chain in Phase 1
- Encrypt Page Access Tokens using the existing `lib/crypto.ts` (AES-256-GCM) before storing
- Add a `token_expires_at` column even for "non-expiring" tokens (set to NULL, but track the 60-day Long-Lived User token separately if needed for refresh)
- Add error code 190 detection in every Graph API call
- Build a re-auth UI flow before launching to clients

**Phase to address:** Phase 1 OAuth + token storage.

---

### M6: System User Tokens as an Alternative for Automation

**What goes wrong:**
The standard OAuth flow (user-delegated Page Access Token) ties the connection to a specific Facebook user. If that user leaves the client's organization or changes their password, the token is invalidated and the entire Meta integration for that org breaks. For an agency SaaS where the admin connecting the account may not be the permanent owner, this is a reliability risk.

**Alternative: System User Tokens**
Meta Business Manager supports System Users — non-human accounts that can be granted Page access. System User tokens can be set to either:
- Non-expiring (permanent): never expire, but can only be generated from within Meta Business Manager and require the business to have the System User installed on their Page
- 60-day expiring: must be refreshed

**The tradeoff for this project:**
System User tokens are ideal for owned/operated accounts (e.g., the agency's own Pages). For client Pages that the client owns and the agency manages, the standard user-delegated OAuth flow is more practical because it doesn't require the client to set up a System User in their Business Manager.

**Recommendation for v1.3:**
Use the standard user-delegated flow. Build token invalidation detection (error code 190) and re-auth UI. Document System User tokens as a future enhancement for enterprise clients who want token reliability without the invalidation risk.

**Phase to address:** Phase 1 architecture decision — document the tradeoff and implement detection.

---

### M7: The 24-Hour Messaging Window and Message Tag Deprecation

**What goes wrong:**
After 24 hours from the last user-initiated message, the Messenger Platform and Instagram Messaging API block automated/bot replies. Attempting to send a message outside the window returns a specific error. Additionally, Message Tags (the previous workaround for sending outside the 24-hour window) have been deprecated for Facebook Messenger as of February 9, 2026. Only the `HUMAN_AGENT` tag remains.

**Exact rules (HIGH confidence — from Meta docs and community sources):**
- Within 24 hours of last user message: any message type allowed, including promotional content and automation
- After 24 hours: only `HUMAN_AGENT` tagged messages from a real human agent are allowed (within a 7-day window)
- After 7 days: no messages can be sent at all (except via Marketing Messages API, which requires explicit user opt-in)
- Message Tags (except `HUMAN_AGENT`) are deprecated on Messenger since February 9, 2026
- Instagram follows the same 24-hour rule; the `HUMAN_AGENT` tag applies to Instagram as well

**Impact on this project's automation binding feature:**
The action engine can respond within the 24-hour window. Outside that window, automation must be blocked. The inbox UI should indicate when a conversation is outside the reply window.

**Prevention:**
- Store `last_user_message_at` on each conversation (already natural given the `conversation_messages` table)
- Before sending any message via the Meta Graph API, check if `now() - last_user_message_at > 24 hours`
- If outside the window, block automated sends; only allow human agent sends from the admin inbox
- Surface the window status in the admin inbox UI: "Reply window closes in 3h 20m" or "Window closed — only human agent replies allowed"
- Do NOT implement any Message Tags other than `HUMAN_AGENT` — they no longer work on Messenger

**Phase to address:** Phase 2 inbox reply engine — the 24-hour check must be in place before automation binding is enabled.

---

### M8: Instagram Inbox Not Marked as Read via API

**What goes wrong:**
When an admin reads and replies to an Instagram DM via the Operator inbox, the message is NOT marked as read in the native Instagram app inbox. This is an API limitation: the Messenger Platform API does not update read status in the Instagram app. Clients who also check their native Instagram inbox will see unread badges and may reply there too, creating duplicate/conflicting conversations.

**Prevention:**
- Document this limitation in the admin UI: "Replies sent via Operator will not mark conversations as read in the Instagram app"
- Recommend clients disable or mute native Instagram DM notifications if they're using Operator as their primary inbox
- This is not fixable at the API level — it is a Meta platform constraint

**Phase to address:** Phase 2 inbox extension — document in the feature, don't try to solve it.

---

### M9: Instagram DM API Uses Messenger Platform Architecture

**What goes wrong:**
Developers treat Instagram Messaging as a completely separate integration from Facebook Messenger, building separate webhook endpoints, separate token management flows, and separate send logic. In reality, Instagram DMs for Business accounts use the Messenger Platform's underlying infrastructure, the same `/me/messages` send endpoint, and the same webhook structure. The key difference is the channel identifier (`instagram` vs `messenger`) and the Page-to-Instagram account link.

**What is actually shared:**
- Webhook verification: same `hub.mode` / `hub.challenge` / `hub.verify_token` mechanism
- Webhook payload structure: same `entry[].messaging[]` shape, different `sender.id` namespace
- Message send endpoint: same `POST /{page-id}/messages` with different recipient ID format
- HMAC signature verification: same `X-Hub-Signature-256` with app secret
- Token type: same Page Access Token (the IG account is linked to the Page)

**What is different:**
- The Instagram Professional account must be linked to the Facebook Page in Business Manager
- Instagram sender IDs are IGSID (Instagram-scoped user IDs), not PSID (Page-scoped user IDs)
- Instagram has inbox folder limitations — API-delivered messages don't appear in the same inbox folders
- Subscribe to the `instagram` webhook object (not `page`) for IG-specific events

**Practical impact:**
A single webhook endpoint can handle both Messenger and Instagram events by inspecting the `sender.id` format and `messaging_product` field. Build one webhook handler, branch on channel type.

**Phase to address:** Phase 1 architecture — design a single unified Meta webhook handler from the start.

---

### M10: Multi-Tenant Token Storage Security

**What goes wrong:**
In a multi-tenant SaaS, Page Access Tokens are stored per org in the database. If the database is breached, every client's Facebook Page access is compromised. An attacker with a Page Access Token can read all messages, reply as the Page, and post content. Unlike API keys that can be rotated server-side, a compromised Page Access Token requires the Facebook Page admin to revoke app access manually.

**Prevention:**
- Store all Page Access Tokens encrypted with AES-256-GCM using the existing `lib/crypto.ts` pattern — this is not optional
- Never log Page Access Tokens in application logs or error tracking (Sentry, etc.)
- Never return the raw token in API responses — decrypt server-side only when making Graph API calls
- Apply the same RLS isolation to the `meta_connections` table as all other org-scoped tables
- Implement token invalidation detection (error code 190) so clients can re-auth quickly after a breach

**Phase to address:** Phase 1 schema + token storage.

---

### V1: Vercel Hobby 4.5 MB Payload Limit on Webhook Routes

**What goes wrong:**
Meta webhook payloads are typically small (a few KB per message event). However, if Meta batches multiple events into a single POST (which it does under high message volume), or if a message contains a large media attachment reference, the payload could theoretically approach the 4.5 MB limit. More practically: if the route handler tries to read the entire payload into memory and then processes it, and the route does multiple awaits (DB writes, Graph API calls) before returning 200, Vercel may time out.

**The actual constraint:**
- Max request/response body: 4.5 MB (Vercel Hobby)
- Max function duration: 60 seconds (Vercel Hobby, standard serverless)
- With Fluid Compute enabled: 300 seconds, but this is not the default

**Meta's expectation:**
Meta expects a 200 response quickly. If Meta does not receive a 200 within a short window, it will retry the webhook. Retries with the same payload can cause duplicate message processing.

**Prevention:**
- Return HTTP 200 immediately after HMAC verification, before any DB writes or Graph API calls
- Process the webhook payload asynchronously after responding (use `waitUntil` if available, or enqueue to a Supabase table for background processing)
- Given the existing pattern in this codebase (`return Response.json({ ok: true })` after try/catch), adapt Meta webhook handlers to the same pattern
- For media attachments: do not download the media in the webhook handler — store the media URL and fetch lazily when the admin views the message

**Phase to address:** Phase 1 webhook handler design.

---

### V2: Vercel Hobby 60-Second Timeout and Webhook Ack Pattern

**What goes wrong:**
Meta webhook routes that do: verify signature → parse payload → write to DB → call Graph API to fetch sender profile → write again → return 200 can easily exceed 5-10 seconds under DB or Graph API latency. While 60 seconds is the hard limit, any route taking more than 2-3 seconds risks timeouts under load and violates Meta's expectation of fast acks.

**Prevention:**
- Ack immediately: verify HMAC → return 200 → process asynchronously
- Store the raw webhook payload in a `meta_webhook_queue` table immediately on receipt
- A separate Supabase Edge Function (scheduled or triggered) processes the queue
- This pattern also solves idempotency: if Meta retries, the second payload with the same `mid` is deduplicated against the queue

**Phase to address:** Phase 1 — the ack-then-process pattern must be designed in before the first real payload arrives.

---

### I1: Channel Routing Collision — Wrong Reply Sent to Wrong Channel

**What goes wrong:**
When the admin inbox has conversations from three channels (widget chat, Instagram, Messenger), a reply entered in the UI must be routed to the exact API for that conversation's channel. A bug where `channel = 'instagram'` conversations get routed to the Messenger send endpoint (or vice versa) will send the reply to the wrong platform, or fail silently. Worse: if the bug routes a reply to the widget chat channel for a Meta conversation, it creates a ghost message in the wrong thread.

**Why it happens:**
- The reply function has a conditional branch on channel type — a typo in the string constant or a missing case causes fallthrough
- The `channel` field is set correctly on `conversations` but not propagated to the reply action
- The existing `conversations` table may need a non-nullable `channel` column with a `CHECK` constraint

**Prevention:**
- Add a `channel` column to `conversations` with a `CHECK (channel IN ('widget', 'instagram', 'messenger'))` constraint — not nullable
- The reply server action must read `conversation.channel` and route accordingly — never infer channel from other fields
- Write a test for each channel that verifies the correct send function is called
- Use TypeScript discriminated unions for the channel routing: `type Channel = 'widget' | 'instagram' | 'messenger'` — a switch with exhaustive checking will catch missing cases at compile time

**Phase to address:** Phase 2 inbox extension — the channel enum and routing logic must be correct from the first message sent.

---

### I2: Conversation Deduplication — Same Sender on Multiple Channels

**What goes wrong:**
A contact who messages via Instagram and also chats via the widget creates two separate conversation threads in the inbox. If the admin doesn't notice, they handle the same customer twice, give conflicting answers, and the customer experience is fragmented. More technically: the `conversations` table may create a new row for each channel, with no link between the same underlying contact.

**Why it matters:**
This is a known omission in v1.3 scope (the project is not building unified contact identity), but the schema decision made now will either make this easy or hard to add later.

**Prevention for v1.3:**
- Do not try to solve unified contact identity in this milestone — it's out of scope
- Add a `channel` label in the conversation list so admins can see "Instagram" vs "Widget" at a glance
- Store `external_sender_id` (Meta IGSID or PSID) on conversations so that future deduplication can match by sender ID
- Document this limitation clearly

**Phase to address:** Phase 2 inbox extension — design the schema with `external_sender_id` to enable future deduplication without a breaking migration.

---

## Pre-Development Checklist for v1.3

Items that must be done before writing any code, with no engineering dependency:

| Item | Owner | Blocks |
|------|-------|--------|
| Complete Meta Business Verification | Product/Admin | App Review submission |
| Create dedicated Facebook Page and Instagram Business account for testing | Developer | Development testing |
| Add test FB/IG accounts as Testers on the Meta app | Developer | Any Meta webhook testing |
| Configure Google Cloud billing alert at $50 and $150 | Developer | First API call |
| Set a daily quota cap in Google Cloud Console | Developer | First API call |
| Submit Meta App Review (after Business Verification) | Product/Admin | Any real client onboarding |
| Set `META_APP_SECRET`, `META_VERIFY_TOKEN`, `GOOGLE_PLACES_API_KEY` in Vercel env | Developer | Phase 1 implementation |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip credential encryption | Ship credential storage faster | Every credential exposed on DB breach; client trust destroyed | Never |
| Use Node.js runtime for webhook routes | Access to full npm ecosystem | Cold starts > 500ms, Vapi timeouts | Never for Vapi routes |
| Store all Vapi events | Complete audit trail | Table bloat, slow queries, high storage costs | MVP only — filter to essential events before real traffic |
| Skip RLS on internal-only tables | Faster schema setup | One code path exposes the table publicly → data leak | Never on any table in `public` schema |
| Use plain `auth.uid()` in policies | Simpler SQL | 20x slower queries at scale; table scans | Never — always wrap in `(select ...)` |
| No automated RLS tests | Ship features faster | Silent data leakage between organizations | Never — add test harness in Phase 1 |
| Single-table action_logs without partitioning | Simpler queries | Slow dashboard at 1M+ rows | MVP acceptable — add time-based partitioning by Phase 3 |
| Store Google reviews without `fetched_at` | Simpler schema | Cannot enforce 30-day refresh requirement; ToS violation | Never |
| Store Meta Page Access Token in plaintext | Simpler code | Full Facebook Page access exposed on DB breach | Never |
| Parse request.json() before HMAC verification | More readable code | HMAC verification always fails; all Meta webhooks rejected | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Vapi Webhooks** | Using `anon` key in Edge Function for webhook → empty query results | Use `service_role` key + manual `organization_id` filtering + Vapi secret validation |
| **Vapi Tool-Calls** | Running all actions synchronously before responding | Respond immediately, use `EdgeRuntime.waitUntil()` for side effects |
| **Vapi `assistant-request`** | Assuming configurable timeout | Hard 7.5s limit — return `assistantId` via simple indexed lookup |
| **Vapi Events** | Trusting all event types are reliable/deduplicated | Handle duplicate webhooks idempotently (upsert by `call_id`) |
| **Supabase RLS** | Creating views without `security_invoker = true` | Views bypass RLS by default — always set `security_invoker = true` on Postgres 15+ |
| **Supabase RLS** | Not adding indexes on `organization_id` | RLS is an implicit WHERE clause — index every filtered column |
| **Supabase Edge Functions** | Using Node.js `crypto` module | Use Web Crypto API (`crypto.subtle`) — Node crypto not available in Edge Runtime |
| **Supabase Connections** | Using direct connection string from Edge Functions | Use transaction-mode pooler (port 6543) for serverless/edge — disable prepared statements |
| **GoHighLevel API** | No retry logic for rate limits | Implement exponential backoff — GHL has aggressive rate limits on some endpoints |
| **pgvector** | Creating IVFFlat index on changing data | Use HNSW — it handles inserts/updates without rebuild |
| **pgvector** | Ordering by computed similarity instead of distance operator | Order by `(embedding <=> query_embedding) ASC` to use the index |
| **Google Places API** | Calling `request.json()` and caching result for the widget | Cache with `fetched_at` timestamp, refresh within 30 days, use Places API (New) endpoint |
| **Google Places API** | Omitting attribution fields from DB schema | Store `author_display_name`, `author_uri`, `author_photo_uri` — required for ToS compliance |
| **Meta OAuth** | Using short-lived User Access Token directly | Exchange for long-lived token, then fetch Page Access Token — store encrypted Page token |
| **Meta Webhooks** | `request.json()` before HMAC verification | `request.text()` first, verify HMAC, then `JSON.parse()` |
| **Meta Webhooks** | Doing DB writes/Graph API calls before returning 200 | Return 200 immediately after HMAC check, process asynchronously |
| **Meta Webhooks** | GET verification returning JSON instead of raw challenge | Return the raw `hub.challenge` integer value as plain text |
| **Meta Messaging** | Sending automated replies after 24-hour window | Check `last_user_message_at`; block automation after 24h; allow only `HUMAN_AGENT` tag |
| **Meta Messaging** | Implementing Message Tags on Messenger | Tags deprecated February 2026 — only `HUMAN_AGENT` remains |
| **Instagram DM** | Building separate webhook handler from Messenger | Same webhook structure — branch on channel type, share one handler |
| **Multi-tenant Meta tokens** | Storing one shared token for all orgs | Per-org Page Access Token, encrypted, with invalidation detection (error 190) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential scan on RLS tables | Dashboard queries slow down over weeks | Index `organization_id` on every table; wrap `auth.uid()` in `(select ...)` | ~10K rows per org |
| pgvector without HNSW index | Knowledge base queries > 2 seconds | Create HNSW index immediately; filter by `organization_id` first | ~1K vectors |
| Edge Function cold start + far DB region | P95 latency spikes > 500ms | Pin Edge Functions to same region as Supabase | Immediately on deployment |
| Storing all Vapi events without filtering | `call_logs` table grows 50x expected | Store only end-of-call + tool-call events | ~1K calls total |
| Offset-based pagination on call logs | Page 10 loads in 5 seconds; page 1 in 50ms | Cursor-based pagination (`WHERE created_at < last_seen`) | ~100K rows |
| No connection pooling from Edge Functions | Connection limit exhausted; 503 errors | Use Supavisor transaction mode (port 6543) with `prepare: false` | ~20 concurrent requests |
| Calculating dashboard metrics from raw logs | Dashboard takes 3+ seconds to load | Pre-aggregate daily/weekly metrics in summary tables | ~10K rows in log tables |
| Google reviews fetched on every widget load | API cost scales with widget traffic | Cache in DB, refresh daily, serve from cache | >10K widget loads/month |
| Meta webhook synchronous processing | Webhook timeout → Meta retries → duplicate messages | Return 200 immediately, process asynchronously | Any latency spike |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key in frontend code | Complete RLS bypass; full database access to anyone | Never use `SUPABASE_SERVICE_ROLE_KEY` in browser; only in Edge Functions/server routes |
| Storing credentials in plain text | All client CRM/phone/calendar credentials exposed on DB breach | AES-256-GCM encryption at rest; decrypt only server-side; use Web Crypto API |
| No Vapi webhook signature validation | Anyone can POST fake tool-calls to your endpoint | Validate `X-Vapi-Secret` header or HMAC signature on every webhook |
| `organization_id` from client request body | Attacker modifies payload to access other org's data | Always derive `organization_id` from authenticated context (JWT → user → org) or assistant mapping |
| No rate limiting on webhook endpoints | DDoS or repeated webhook replay attacks | Add rate limiting per IP / per assistant ID in Edge Function or via Vercel firewall |
| JWT secret leaked via `NEXT_PUBLIC_` env var | Anyone can forge valid JWTs and impersonate any user | Never prefix secrets with `NEXT_PUBLIC_`; audit env var names |
| Meta Page Access Token in plaintext DB | Full Facebook Page access (read/reply/post) on DB breach | AES-256-GCM encrypt Meta tokens, same as GHL credentials |
| String comparison for HMAC signatures | Timing attack extracts secret byte by byte | Use `crypto.timingSafeEqual()` always |
| Google API key without HTTP referrer restriction | Key used by anyone for billing abuse | Restrict server-side key to server IP; use separate key for client-side Maps embed |

## "Looks Done But Isn't" Checklist

- [ ] **RLS:** Table has RLS enabled AND has policies for all CRUD operations (SELECT, INSERT, UPDATE, DELETE) — not just SELECT
- [ ] **RLS:** UPDATE policies have both `USING` and `WITH CHECK` clauses — missing `WITH CHECK` allows changing `organization_id` to another org
- [ ] **Edge Functions:** Deployed and tested in production runtime, not just local dev — Node.js vs Edge Runtime differences surface in prod
- [ ] **Webhook Authentication:** Vapi secret validation works on the deployed Edge Function URL, not just localhost with ngrok
- [ ] **Multi-tenant Isolation:** Automated test exists that verifies org A cannot read org B's data for every table
- [ ] **Encryption:** Credential save → DB → decrypt cycle works end-to-end; encrypted blob is unreadable in DB
- [ ] **Campaign Dialing:** Contact called exactly once per attempt — verify with unique constraint and logs
- [ ] **Knowledge Base:** Semantic search filtered by organization — query org A's KB, confirm zero results from org B
- [ ] **Dashboard Metrics:** Pre-aggregated or properly indexed — loads in < 500ms with 10K+ calls
- [ ] **Tool Execution:** Full round-trip tested: Vapi triggers tool → Edge Function executes → result returns to Vapi within 500ms
- [ ] **Google Reviews:** `fetched_at` stored; refresh job exists; attribution fields stored; widget displays "Powered by Google"
- [ ] **Meta Tokens:** Page Access Token stored encrypted; error code 190 handled; re-auth UI exists
- [ ] **Meta Webhook HMAC:** Verified using `request.text()` before any other body read; `timingSafeEqual` used
- [ ] **Meta 24h Window:** `last_user_message_at` tracked; automation blocked after 24h; UI shows window status
- [ ] **Meta App Review:** Submitted and approved (or in review) before any real client connects their Page
- [ ] **Channel Routing:** Inbox reply routes to correct API per `conversation.channel`; TypeScript exhaustive switch in place

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing RLS on table | LOW | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + add policies — but audit for any data accessed during unprotected window |
| Plain text credentials | HIGH | Encrypt all existing credentials, rotate every client's API keys (clients must update their third-party credentials) |
| Slow pgvector queries | MEDIUM | Add HNSW index (builds online, table remains accessible), add `organization_id` filter to match function |
| Duplicate campaign calls | MEDIUM | Add `FOR UPDATE SKIP LOCKED`, add unique constraint, deduplicate existing data |
| Edge Function using Node APIs | MEDIUM | Rewrite to use Web Crypto API / fetch; test thoroughly in Edge Runtime |
| Call logs table too large | MEDIUM | Add time-based partitioning, create archive table, migrate old data |
| Wrong region for Edge Functions | LOW | Add `preferredRegion` config and redeploy |
| Google reviews ToS violation detected | HIGH | Add `fetched_at`, implement refresh job, audit all stored data for age |
| Meta token invalidated (error 190) | LOW | Client re-authenticates via OAuth flow; no data loss |
| Meta HMAC wrong (request.json() called first) | MEDIUM | Rewrite handler to call `request.text()` first; all Meta webhooks rejected until fixed |
| App Review rejected | MEDIUM | Address rejection reason, re-record screencasts, resubmit — adds 3–5 days per round-trip |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vapi tool-call timeout (P1) | Phase 1: Action Engine | Tool execution P95 < 400ms in load test |
| RLS data leakage (P2) | Phase 1: Foundation | Automated test: org A queries return zero org B data |
| Credential encryption (P3) | Phase 1: Credential storage | DB inspection shows only ciphertext; decrypt cycle works |
| Edge Function limitations (P4) | Phase 1: All webhook routes | All routes deployed and responding in Edge Runtime |
| RLS performance (P5) | Phase 1: Schema design | Query plan shows index scan, not sequential scan |
| Vapi webhook RLS pattern (P6) | Phase 1: Webhook handler | Every service_role query has explicit `organization_id` filter |
| pgvector performance (P7) | Phase 2: Knowledge Base | Semantic search < 200ms with 10K vectors |
| Observability data volume (P8) | Phase 2: Call logs | Dashboard loads < 500ms with 10K+ calls |
| Campaign race conditions (P9) | Phase 3: Campaigns | No duplicate calls in load test with concurrent batches |
| assistant-request timeout (P10) | Phase 1 (inbound) / Phase 2 | Response time < 5s for assistant lookup |
| Google Places caching ban (G1) | v1.3 Phase 1: DB schema | `fetched_at` column present; daily refresh job deployed |
| Google 5-review cap (G2) | v1.3 Phase 1: Feature scope | Admin UI documents the limit |
| Google attribution (G3) | v1.3 Phase 1: Widget render | "Powered by Google" visible in all widget layouts |
| Places API new vs legacy (G4) | v1.3 Phase 1: API setup | Using `places.googleapis.com/v1/places/` endpoint |
| Google billing surprise (G5) | Pre-development | Budget alert configured; quota cap set |
| Meta App Review block (M1) | Pre-development | App Review submitted before Phase 2 client onboarding |
| Meta Business Verification (M2) | Pre-development | Verification completed before App Review submission |
| Meta dev mode restriction (M3) | v1.3 Phase 1 | Test accounts added; dev flow documented |
| Meta raw body HMAC (M4) | v1.3 Phase 1: Webhook handler | Signature verification passing in production |
| Meta wrong token type (M5) | v1.3 Phase 1: OAuth flow | Page Access Token stored; short-lived token never persisted |
| Meta token invalidation (M6) | v1.3 Phase 1: Token storage | Error 190 handled; re-auth UI exists |
| Meta 24h window + tag deprecation (M7) | v1.3 Phase 2: Reply engine | 24h check in place; no Message Tags used |
| Instagram not marked read (M8) | v1.3 Phase 2: Inbox UI | Limitation documented in UI |
| Instagram = Messenger architecture (M9) | v1.3 Phase 1: Architecture | Single unified Meta webhook handler |
| Multi-tenant token security (M10) | v1.3 Phase 1: Token storage | Tokens encrypted; RLS on `meta_connections` |
| Vercel payload limit (V1) | v1.3 Phase 1: Webhook design | Async processing; 200 returned immediately |
| Vercel timeout (V2) | v1.3 Phase 1: Webhook design | Ack-then-process pattern; processing decoupled |
| Channel routing collision (I1) | v1.3 Phase 2: Inbox extension | TypeScript exhaustive switch; `channel` CHECK constraint |
| Conversation deduplication (I2) | v1.3 Phase 2: Schema | `external_sender_id` column present |

## Sources

**v1.0–v1.2 sources:**
- Supabase RLS official docs: https://supabase.com/docs/guides/database/postgres/row-level-security — HIGH confidence
- Supabase Edge Functions docs: https://supabase.com/docs/guides/functions — HIGH confidence
- Supabase pgvector docs: https://supabase.com/docs/guides/ai/vector-columns — HIGH confidence
- Vapi Server URL docs: https://docs.vapi.ai/server-url — HIGH confidence
- Vercel Edge Runtime limits: https://vercel.com/docs/functions/runtimes/edge — HIGH confidence

**v1.3 sources:**
- Google Places API Policies: https://developers.google.com/maps/documentation/places/web-service/policies — HIGH confidence
- Google Places API (New) Migration: https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-overview — HIGH confidence
- Google Places reviews 5-review limit: https://featurable.com/blog/google-places-more-than-5-reviews — MEDIUM confidence (verified against API behavior)
- Meta Permissions Reference: https://developers.facebook.com/docs/permissions/ — HIGH confidence
- Meta Instagram App Review: https://developers.facebook.com/docs/instagram-platform/app-review/ — HIGH confidence
- Meta Access Token Guide: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/ — HIGH confidence
- Meta Long-Lived Token Guide: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/ — HIGH confidence
- Meta Instagram Platform Webhooks: https://developers.facebook.com/docs/instagram-platform/webhooks/ — HIGH confidence
- Meta Message Tags Deprecation: https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010 — MEDIUM confidence (community source, consistent with Meta policy direction)
- Meta 24-hour messaging window: https://manychat.com/blog/an-updated-guide-to-facebooks-24-hour-rule-and-message-tags/ — MEDIUM confidence (verified against Meta platform policy)
- Vercel Hobby plan limits: https://vercel.com/docs/functions/limitations — HIGH confidence
- Next.js webhook raw body pattern: https://webhooks.cc/blog/nextjs-app-router-webhook-handler — MEDIUM confidence (community verified pattern)
- Meta App Review rejection reasons: https://www.saurabhdhar.com/blog/meta-app-approval-guide — MEDIUM confidence (community source, consistent with official docs)

---
*Pitfalls research for: Operator — multi-tenant SaaS (v1.0–v1.2: Vapi platform; v1.3 addendum: Google Reviews Widget + Meta Messaging)*
*v1.0–v1.2 researched: 2026-03-30 · v1.3 addendum researched: 2026-05-04*
