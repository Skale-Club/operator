# Phase 5: Outbound Campaigns - Research

**Researched:** 2026-04-02
**Domain:** Vapi Outbound API, campaign orchestration, CSV import, real-time status updates
**Confidence:** HIGH (core stack verified), MEDIUM (Vapi campaign API details — docs truncated, supplemented by official search)

---

## Summary

Phase 5 implements outbound calling campaigns on top of the existing VoiceOps stack. Admins create a campaign, import contacts via CSV, start the campaign, and monitor per-contact call status in real time.

**Key architectural insight:** Vapi has a native Campaigns API (`POST /campaign`) that handles contact list management, call scheduling, concurrency, and retry logic natively. This project should use Vapi's campaign API rather than building custom scheduling with pg_cron. The platform's job is: (1) store campaign and contact data in Supabase, (2) create the campaign in Vapi via API, (3) receive end-of-call webhooks and update per-contact status in real time.

The real-time status display uses Supabase Realtime (Postgres Changes) on the client — the same webhook infrastructure already built in Phase 2 (`/api/vapi/tools` pattern) extends naturally to a `/api/vapi/campaigns` webhook route for end-of-call reports.

**Primary recommendation:** Use Vapi's Campaigns API for call scheduling and concurrency management. Store campaign state locally in Supabase. Wire Vapi end-of-call webhooks to update `campaign_contacts.status`. Use Supabase Realtime on the client for live status updates.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAMP-01 | Admin can create campaigns with name, selected assistant, and schedule (start/end time) | Vapi Campaign API `POST /campaign` accepts `name`, `assistantId`, and `schedulePlan.startedAt` |
| CAMP-02 | Admin can import contact lists via CSV upload (name, phone, custom data) | Parse CSV client-side with papaparse; store in `campaign_contacts` table; pass to Vapi campaign as `customers` array |
| CAMP-03 | Admin can configure call cadence (calls per minute) per campaign | Vapi enforces concurrency at org level (default 10 simultaneous); no native CPM — store as metadata, enforce via concurrency setting |
| CAMP-04 | Admin can start, pause, and stop campaigns with real-time control | Vapi Campaign API supports `PATCH /campaign/:id` with `status` transitions (scheduled → in-progress → ended) |
| CAMP-05 | Platform dials contacts via Vapi Outbound API respecting configured cadence | Vapi campaign handles dialing natively after creation; alternatively individual `POST /call` per contact for more control |
| CAMP-06 | Admin can monitor per-contact status (pending, calling, completed, failed, no answer) in real-time | Supabase Realtime on `campaign_contacts` table — webhook updates row, client receives change |
| CAMP-07 | Campaign status tracked and updated via Vapi end-of-call webhook | `end-of-call-report` event carries `call.metadata.campaign_contact_id` for row lookup and status update |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | 5.5.3 | CSV parsing (client-side) | De facto standard; handles edge cases (quotes, escapes, BOM); streaming support |
| @supabase/supabase-js | ^2.101.1 (already installed) | Realtime channel subscriptions | Already in project; Postgres Changes works OOB |
| zod | ^3.25.76 (already installed) | CSV row validation schema | Already in project; validates phone format, required fields |
| lucide-react | ^1.7.0 (already installed) | Status indicator icons | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (already installed) | Schedule datetime formatting | Format ISO dates for Vapi `schedulePlan.startedAt` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse (client-side) | server-side csv-parser | Client-side avoids file size limits in Next.js server actions (4.5MB default); papaparse handles all standard CSV edge cases |
| Vapi Campaign API | Custom pg_cron scheduling | Vapi handles retries, concurrency, and no-answer detection natively — less code, better reliability |
| Supabase Realtime | SSE polling | Realtime is event-driven and already in the stack; SSE would require a dedicated Next.js route with state management complexity |

**Installation:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

**Version verification (confirmed 2026-04-02):**
- papaparse: 5.5.3 (npm registry)
- All other libraries already installed in project

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   └── outbound/
│   │       ├── page.tsx               # Campaign list
│   │       ├── new/
│   │       │   └── page.tsx           # Create campaign form
│   │       └── [id]/
│   │           └── page.tsx           # Campaign detail + contact status
│   └── api/
│       └── vapi/
│           └── campaigns/
│               └── route.ts           # End-of-call webhook for campaign contacts
├── lib/
│   └── campaigns/
│       ├── actions.ts                 # Server actions: createCampaign, startCampaign, pauseCampaign, stopCampaign
│       ├── vapi-client.ts             # Vapi API calls: POST /campaign, PATCH /campaign/:id
│       └── csv-parser.ts             # papaparse wrapper + Zod validation
└── types/
    └── database.ts                    # Extended with campaigns + campaign_contacts tables
```

### Pattern 1: Vapi Campaigns API Integration
**What:** Create a campaign in Vapi with a customers array; Vapi handles scheduling and dialing.
**When to use:** Always — this is the correct way to do bulk outbound with Vapi.
**Example:**
```typescript
// Source: https://docs.vapi.ai/api-reference/campaigns/campaign-controller-create
const response = await fetch('https://api.vapi.ai/campaign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: campaign.name,
    assistantId: campaign.assistant_id,
    phoneNumberId: campaign.phone_number_id,
    customers: contacts.map(c => ({
      number: c.phone,
      name: c.name,
      // variableValues available for dynamic assistant content
    })),
    schedulePlan: {
      startedAt: campaign.scheduled_start_at, // ISO 8601
    },
  }),
})
const vapiCampaign = await response.json()
// Store vapiCampaign.id in campaigns.vapi_campaign_id
```

### Pattern 2: Call Metadata for Contact Tracking
**What:** Pass `metadata.campaign_contact_id` on each Vapi call so end-of-call webhooks can identify which contact to update.
**When to use:** When using individual `POST /call` per contact (alternative to Campaigns API).
**Example:**
```typescript
// Source: https://vapi.ai/community/m/1235962603566661672 (confirmed pattern)
const callPayload = {
  assistantId: campaign.vapi_assistant_id,
  phoneNumberId: campaign.vapi_phone_number_id,
  customer: { number: contact.phone, name: contact.name },
  metadata: {
    campaign_contact_id: contact.id,  // roundtripped in end-of-call webhook
    campaign_id: contact.campaign_id,
  },
}
```

### Pattern 3: Supabase Realtime for Live Status
**What:** Subscribe to `campaign_contacts` table changes on the client; update UI when webhook writes new status.
**When to use:** Campaign detail page — real-time per-contact status board.
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
'use client'
const supabase = createClient()

useEffect(() => {
  const channel = supabase
    .channel(`campaign-contacts-${campaignId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'campaign_contacts',
        filter: `campaign_id=eq.${campaignId}`,
      },
      (payload) => {
        // payload.new contains updated contact row
        setContacts(prev =>
          prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
        )
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [campaignId])
```

### Pattern 4: CSV Import Flow
**What:** Parse CSV client-side with papaparse, validate rows with Zod, preview before import.
**When to use:** Always — avoids server upload size limits and gives immediate validation feedback.
**Example:**
```typescript
// Source: https://www.papaparse.com/docs
import Papa from 'papaparse'

const ContactRowSchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'E.164 format required'),
  // additional custom fields stored in JSONB
})

function parseContactCSV(file: File): Promise<ContactRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row, i) => {
          const result = ContactRowSchema.safeParse(row)
          if (!result.success) throw new Error(`Row ${i+1}: ${result.error.message}`)
          return result.data
        })
        resolve(parsed)
      },
      error: reject,
    })
  })
}
```

### Anti-Patterns to Avoid
- **Building a custom dial scheduler with pg_cron:** Vapi's Campaign API handles this natively — including retry logic, no-answer detection, and concurrency. Don't reinvent it.
- **Polling for status updates:** Use Supabase Realtime channels instead. Polling at any useful frequency creates unnecessary load and feels laggy.
- **Storing Vapi phone number in the campaign form:** The admin should select a phone number by its Vapi ID, not free-type it. Fetch available phone numbers from Vapi API when building the form.
- **Initiating calls without storing `vapi_call_id`:** The webhook roundtrip requires knowing which DB contact matches the incoming call. Always store `vapi_call_id` on `campaign_contacts` when the call is created.
- **No deduplication guard:** CAMP-07 requires no duplicate dials. Use `UNIQUE(campaign_id, phone)` on `campaign_contacts` to enforce this at the DB level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outbound call scheduling | Custom queue with pg_cron + interval timer | Vapi Campaign API | Vapi handles concurrency slots, no-answer retry, call window expiry |
| CSV parsing | Manual string.split(',') | papaparse 5.5.3 | Handles quoted fields, escaped commas, BOM, encoding, streaming |
| Phone number validation | Regex you write yourself | Zod + libphonenumber pattern | E.164 has edge cases; international formats vary; papaparse + Zod catches them at import time |
| Real-time push | SSE route handler + polling fallback | Supabase Realtime Postgres Changes | Already in stack; RLS-aware; handles reconnect automatically |
| Call retry logic | Custom retry counter + cron | Vapi Campaign API (built-in retry) | Vapi retries automatically within the schedule window |

**Key insight:** The platform's value is the UI layer and webhook routing — Vapi handles the telephony orchestration. Phase 5 is primarily: data model + UI + webhook handler, not a dialing engine.

---

## Database Schema

This is the critical design decision for this phase. The schema must support:
- Multi-tenant RLS (organization_id on all tables)
- Per-contact status tracking with `vapi_call_id` for webhook correlation
- Deduplication constraint
- Campaign state machine transitions

### Recommended Schema (Migration 005)

```sql
-- campaigns table
CREATE TABLE public.campaigns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  vapi_assistant_id TEXT        NOT NULL,   -- assistant_mappings.vapi_assistant_id
  vapi_phone_number_id TEXT     NOT NULL,   -- Vapi phone number ID for outbound
  vapi_campaign_id  TEXT,                   -- set after Vapi campaign is created
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','in_progress','paused','completed','stopped')),
  scheduled_start_at TIMESTAMPTZ,
  calls_per_minute  INTEGER     NOT NULL DEFAULT 5,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- campaign_contacts table
CREATE TABLE public.campaign_contacts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT,
  phone             TEXT        NOT NULL,
  custom_data       JSONB       NOT NULL DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','calling','completed','failed','no_answer')),
  vapi_call_id      TEXT,                   -- set when call is initiated; used for webhook correlation
  error_detail      TEXT,
  called_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, phone)               -- CAMP-07: deduplication
);
```

**RLS pattern:** Same as existing tables — use `(SELECT public.get_current_org_id())` subquery wrapper on all policies. Service-role key in the webhook route bypasses RLS to write status updates.

**Supabase Realtime requirement:** Enable Realtime on `campaign_contacts` table via the Supabase dashboard or `ALTER TABLE public.campaign_contacts REPLICA IDENTITY FULL`. This is required for Postgres Changes subscriptions to include the full new row.

---

## Vapi API Reference (Verified)

### Initiate Campaign
```
POST https://api.vapi.ai/campaign
Authorization: Bearer {VAPI_API_KEY}
```

Payload (verified structure from official docs):
```json
{
  "name": "Campaign Name",
  "assistantId": "assistant-uuid",
  "phoneNumberId": "phone-number-uuid",
  "customers": [
    { "number": "+15551234567", "name": "Contact Name" }
  ],
  "schedulePlan": {
    "startedAt": "2026-04-10T09:00:00Z"
  }
}
```

Response includes `id` (Vapi campaign UUID) — store as `campaigns.vapi_campaign_id`.

### Vapi Concurrency Model
- Default: 10 simultaneous calls per Vapi org
- Not per-campaign, not per-minute — it is concurrent active calls
- "calls_per_minute" in the requirements maps to Vapi's concurrency setting (how many can be in-flight at once)
- For MVP: store `calls_per_minute` as metadata on the campaign, document that actual rate is controlled by Vapi concurrency setting

### Campaign Status Values (from Vapi API)
- `scheduled` — queued, not yet active
- `in-progress` — currently dialing
- `ended` — done (success, user-stopped, or expired)

### End-of-Call Report Webhook
The existing `/api/vapi/tools` pattern extends to a new route `/api/vapi/campaigns/route.ts`. The `end-of-call-report` event payload includes:
- `type`: `"end-of-call-report"`
- `call.type`: `"outboundPhoneCall"` — distinguishes from inbound
- `call.metadata`: Object you passed at call creation — contains `campaign_contact_id`
- `call.endedReason`: Maps to contact status
- `call.id`: Vapi call ID

**endedReason → contact status mapping:**
```typescript
function mapEndedReasonToStatus(reason: string): ContactStatus {
  if (['customer-ended-call', 'assistant-ended-call', 'exceeded-max-duration'].includes(reason)) {
    return 'completed'
  }
  if (['customer-did-not-answer', 'customer-busy', 'voicemail'].includes(reason)) {
    return 'no_answer'
  }
  // All error reasons → failed
  return 'failed'
}
```

---

## Common Pitfalls

### Pitfall 1: Vapi end-of-call webhook not fired for unanswered calls
**What goes wrong:** When `customer-did-not-answer`, Vapi may not consistently send end-of-call-report (known intermittent issue confirmed in community discussions).
**Why it happens:** Vapi's webhook system has an edge case where unanswered outbound calls sometimes don't trigger the report.
**How to avoid:** Store `vapi_call_id` on `campaign_contacts` when the call is created. Add a background reconciliation: periodically call `GET /call/{vapi_call_id}` to check status for contacts that have been in `calling` state for > 5 minutes.
**Warning signs:** Contacts stuck in `calling` status after campaign ends.

### Pitfall 2: Supabase Realtime requires REPLICA IDENTITY FULL
**What goes wrong:** Postgres Changes subscriptions for UPDATE events only return the primary key (id) in the payload, not the changed fields, unless `REPLICA IDENTITY FULL` is set.
**Why it happens:** Postgres default replica identity is `default` (primary key only on UPDATE/DELETE).
**How to avoid:** Include `ALTER TABLE public.campaign_contacts REPLICA IDENTITY FULL;` in the migration. Document this requirement in the plan.
**Warning signs:** `payload.new` only has `id` — all other fields are undefined.

### Pitfall 3: CSV phone number format variance
**What goes wrong:** Users upload CSVs with phone numbers in various formats: `(555) 123-4567`, `555-123-4567`, `+15551234567`. Vapi requires E.164 (`+15551234567`).
**Why it happens:** No standard CSV phone format; users copy from various CRMs.
**How to avoid:** Validate at import time with Zod; display per-row errors in a preview table before allowing import to proceed. Accept and normalize common US formats.
**Warning signs:** Vapi returns 400 errors on call creation for malformed numbers.

### Pitfall 4: Missing `organization_id` on campaign_contacts breaks RLS
**What goes wrong:** The webhook route (service-role) updates a `campaign_contacts` row. If `organization_id` is not stored on the row itself, the admin client's SELECT policy (which filters by `get_current_org_id()`) won't be able to join through the campaign — it needs a direct column.
**Why it happens:** Lazy schema design — normalizing through campaign is convenient but breaks RLS performance.
**How to avoid:** Always include `organization_id` directly on `campaign_contacts` (denormalized), as shown in the schema above.

### Pitfall 5: Vapi campaign vs individual calls — tracking gap
**What goes wrong:** If using the Vapi Campaign API (batch), Vapi generates call IDs internally. To correlate end-of-call webhooks back to specific contacts, you need the Vapi call ID. The Vapi campaign doesn't directly tell you which of your customer rows maps to which call.
**Why it happens:** The Vapi campaign API abstracts away individual call IDs during creation.
**How to avoid:** Two options: (a) Use individual `POST /call` per contact instead of the Campaign API — this gives you the call ID immediately and you store it on `campaign_contacts.vapi_call_id`. (b) Use the Vapi Campaign API but match incoming webhooks by `call.customer.number`. Option (a) is cleaner for status tracking.

**Recommendation: Use individual `POST /call` per contact with a server action loop** for MVP, rather than the Vapi Campaign API. This gives: immediate `vapi_call_id` per contact, simpler webhook correlation, and explicit per-contact state control. Use `setInterval` respecting `calls_per_minute` in a server action, with AbortController for pause/stop.

### Pitfall 6: Concurrent server actions for campaign control
**What goes wrong:** Start/pause/stop actions need to atomically update campaign status and potentially cancel pending calls.
**Why it happens:** Race condition between webhook writes and admin control actions.
**How to avoid:** Use optimistic locking via `status` check in UPDATE:  `UPDATE campaigns SET status = 'paused' WHERE id = $1 AND status = 'in_progress'`. If 0 rows updated, the status transition was invalid.

---

## Architecture Decision: Vapi Campaign API vs Individual Calls

| Approach | Pros | Cons |
|----------|------|------|
| **Vapi Campaign API** | Less code, Vapi handles retry | Can't easily correlate calls to contacts via webhook; opaque contact → call ID mapping |
| **Individual POST /call** | Full control, immediate vapi_call_id, clear webhook correlation | Must implement cadence limiting ourselves |

**Decision for MVP:** Use individual `POST /call` per contact. Cadence: a Next.js server action fires calls in a batch loop with `Promise.all` batching at `calls_per_minute` rate. Campaign start triggers the loop; pause/stop sets a DB flag the loop checks.

This aligns with how Phase 2 already works — the webhook route pattern is proven. Individual calls give cleaner observability (calls appear in the OBS-01 call log pipeline as well).

---

## Webhook Route Design

The campaign end-of-call webhook follows the same pattern as `/api/vapi/tools`:

```typescript
// src/app/api/vapi/campaigns/route.ts
// Edge Function — same pattern as /api/vapi/tools

export const runtime = 'edge'

export async function POST(request: Request) {
  const body = await request.json()

  // Only handle end-of-call-report for outbound campaign calls
  if (body.type !== 'end-of-call-report') {
    return Response.json({ received: true })
  }
  if (body.call?.type !== 'outboundPhoneCall') {
    return Response.json({ received: true })
  }

  const campaignContactId = body.call?.metadata?.campaign_contact_id
  if (!campaignContactId) {
    return Response.json({ received: true })
  }

  // Use EdgeRuntime.waitUntil for async DB write (same pattern as Phase 2)
  // @ts-ignore
  EdgeRuntime.waitUntil(updateContactStatus(campaignContactId, body.call))

  return Response.json({ received: true })
}
```

**Important:** Register this server URL on the Vapi assistant or phone number used for campaigns. The existing `/api/vapi/tools` server URL handles tool calls — campaigns need the `end-of-call-report` event, which can go to the same or a separate URL.

---

## Real-Time Update Strategy

**Chosen: Supabase Realtime (Postgres Changes)**

The campaign detail page subscribes to `campaign_contacts` table changes filtered by `campaign_id`. When the webhook handler updates a contact's status, Supabase broadcasts the change to all connected clients.

```
Vapi calls → end-of-call webhook → /api/vapi/campaigns → 
  service-role UPDATE campaign_contacts → 
  Supabase Realtime broadcasts → 
  client channel receives payload.new → 
  React state update → status badge re-renders
```

**Why not SSE:** Supabase Realtime is already in the stack and handles WebSocket reconnect, RLS-aware filtering, and is simpler to implement than a custom SSE route + polling fallback.

**Realtime limitations to know:**
- RLS policies are NOT applied to DELETE payloads (not relevant here — no DELETEs on contacts)
- Requires `REPLICA IDENTITY FULL` for full row data on UPDATE events
- Free/Pro tier: 500 concurrent realtime connections; sufficient for MVP

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vapi API key (`VAPI_API_KEY`) | POST /call, POST /campaign | Assumed (already used in Phase 2) | — | — |
| Supabase Realtime | CAMP-06 live status | Enabled on all Supabase projects | — | Polling every 5s |
| papaparse | CAMP-02 CSV import | Not yet installed | 5.5.3 | — |
| @types/papaparse | Type safety | Not yet installed | — | — |

**Missing dependencies with no fallback:**
- papaparse + @types/papabase — needs `npm install` in Wave 0

**Missing dependencies with fallback:**
- Supabase Realtime — if unavailable in dev, fall back to 5-second polling on the contact list

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (already installed) |
| Config file | `vitest.config.ts` — exists from Phase 1 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAMP-01 | createCampaign server action writes to DB + calls Vapi API | Unit (mocked Vapi fetch) | `npx vitest run tests/campaigns.test.ts` | ❌ Wave 0 |
| CAMP-02 | CSV parser validates rows; rejects bad phone formats | Unit | `npx vitest run tests/csv-parser.test.ts` | ❌ Wave 0 |
| CAMP-03 | Campaign stores calls_per_minute; respected in start action | Unit | `npx vitest run tests/campaigns.test.ts` | ❌ Wave 0 |
| CAMP-04 | startCampaign / pauseCampaign / stopCampaign state transitions | Unit | `npx vitest run tests/campaigns.test.ts` | ❌ Wave 0 |
| CAMP-05 | Individual POST /call per contact with correct payload | Unit (mocked fetch) | `npx vitest run tests/campaigns.test.ts` | ❌ Wave 0 |
| CAMP-06 | Webhook handler maps endedReason → contact status correctly | Unit | `npx vitest run tests/campaign-webhook.test.ts` | ❌ Wave 0 |
| CAMP-07 | Duplicate phone in same campaign rejected at DB level | Integration (DB) | `npx vitest run tests/campaigns.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/campaigns.test.ts` — covers CAMP-01, CAMP-03, CAMP-04, CAMP-05, CAMP-07
- [ ] `tests/csv-parser.test.ts` — covers CAMP-02
- [ ] `tests/campaign-webhook.test.ts` — covers CAMP-06
- [ ] `npm install papaparse @types/papaparse` — required before implementation

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual call loop with setInterval | Vapi native Campaign API | 2024 | Vapi now handles batch dialing natively — but individual call approach still valid for tracking |
| Polling for call status | Supabase Realtime Postgres Changes | 2023 | Zero-latency push updates; already in Supabase stack |
| CSV upload to server | Client-side papaparse parse | 2022 | Avoids Next.js 4.5MB body limit; immediate validation UX |

**Note on Vapi Campaign API maturity:** The Campaign API endpoints (`/campaign`) exist and are documented, but the Dashboard UI focuses on them. The API is production-ready per the official docs but was relatively recent (2024-2025). The individual-call approach (`POST /call` per contact) is older and battle-tested — recommended for MVP to ensure webhook correlation reliability.

---

## Open Questions

1. **Vapi server URL configuration for campaign webhooks**
   - What we know: End-of-call-report can be sent to a server URL configured on the assistant or phone number
   - What's unclear: Does the server URL need to be on the assistant, the phone number, or the Vapi org level? Can it differ from the tool-call server URL?
   - Recommendation: Configure a dedicated server URL on the campaign's phone number pointing to `/api/vapi/campaigns`. Test with a single contact before bulk run.

2. **Vapi phone number ID availability**
   - What we know: `phoneNumberId` is required for outbound calls
   - What's unclear: Does the admin already have a Vapi phone number provisioned? Is there a UI to list available numbers?
   - Recommendation: Add a `GET /api/vapi-phone-numbers` proxy route that calls `GET https://api.vapi.ai/phone-number` and lists available numbers for the form dropdown.

3. **Pause campaign behavior**
   - What we know: Vapi campaign API supports `ended` status via PATCH; no explicit `paused` state in Vapi
   - What's unclear: Can a Vapi campaign be paused and resumed, or only stopped?
   - Recommendation: Implement pause as a local DB flag only — the platform stops firing new calls; Vapi-side the campaign may need to be stopped and re-created to resume. For MVP, "pause" = stop new calls from being dispatched; "resume" = restart from pending contacts.

---

## Sources

### Primary (HIGH confidence)
- https://docs.vapi.ai/calls/outbound-calling — Outbound call payload structure, phoneNumberId, customers array
- https://docs.vapi.ai/api-reference/campaigns/campaign-controller-create — Campaign API endpoint exists and is documented
- https://docs.vapi.ai/api-reference/campaigns/campaign-controller-find-all — Campaign status enums (scheduled, in-progress, ended)
- https://docs.vapi.ai/calls/call-ended-reason — Complete list of call ended reasons mapped to contact statuses
- https://docs.vapi.ai/api-reference/calls/get — Call object fields including `type` enum (outboundPhoneCall)
- https://supabase.com/docs/guides/realtime/postgres-changes — Supabase Realtime channel subscription code pattern
- https://www.papaparse.com/ — papaparse CSV parsing API

### Secondary (MEDIUM confidence)
- https://docs.vapi.ai/outbound-campaigns/overview — Vapi native campaign feature overview; concurrency model
- https://vapi.ai/community/m/1235962603566661672 — Confirmed `metadata` field on call object passes through to webhook (community post)
- https://supabase.com/blog/realtime-row-level-security-in-postgresql — RLS + Realtime interaction, REPLICA IDENTITY requirement

### Tertiary (LOW confidence — flag for validation)
- Community reports of intermittent missing end-of-call webhooks for unanswered calls — needs validation in testing
- Vapi Campaign API individual contact → call ID correlation behavior — needs empirical testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are production-grade, versions verified from npm registry
- Vapi API integration: MEDIUM — endpoint structure confirmed via official docs, but full schema was truncated; individual field behavior needs empirical testing
- Architecture patterns: HIGH — follows established Phase 2 patterns (Edge Function webhooks, service-role writes, RLS)
- Pitfalls: HIGH — REPLICA IDENTITY FULL is a documented requirement; webhook correlation design is based on Vapi's confirmed metadata roundtrip

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (Vapi API is actively developed; verify campaign API schema before execution)
