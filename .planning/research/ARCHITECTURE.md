# Architecture: Google Reviews Widget + Meta Messaging Integration

**Project:** Operator v1.3
**Researched:** 2026-05-04
**Confidence:** HIGH — based on direct codebase inspection plus verified Meta and Google official docs

---

## 1. Database Schema Changes

### 1a. New Tables

#### `google_locations`
Stores a Google Place registered per org. One location per org is the expected MVP case; the schema allows many-to-one for future flexibility.

```sql
-- Migration 018: google_locations
CREATE TABLE public.google_locations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  place_id       TEXT        NOT NULL,                  -- Google Place ID (ChIJ...)
  name           TEXT        NOT NULL,                  -- display name from Places API
  address        TEXT,                                  -- formatted_address from Places API
  review_token   TEXT        UNIQUE NOT NULL             -- public embed token (like widget_token)
                             DEFAULT replace(gen_random_uuid()::text, '-', ''),
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, place_id)
);

CREATE INDEX idx_google_locations_org_id       ON public.google_locations(org_id);
CREATE INDEX idx_google_locations_review_token ON public.google_locations(review_token);

ALTER TABLE public.google_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON public.google_locations
  FOR ALL TO authenticated
  USING (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());
```

#### `google_reviews`
Stores up to 5 reviews per location (Google Places API hard limit). Upserted on sync using a stable dedup key derived from each review entry.

```sql
-- Migration 018 (continued)
CREATE TABLE public.google_reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID        NOT NULL REFERENCES public.google_locations(id) ON DELETE CASCADE,
  org_id           UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_name      TEXT        NOT NULL,
  author_photo_url TEXT,
  rating           INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text             TEXT,
  published_at     TIMESTAMPTZ,
  google_review_id TEXT        NOT NULL,              -- stable dedup key from Places API response
  display_order    INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, google_review_id)
);

CREATE INDEX idx_google_reviews_location_id ON public.google_reviews(location_id);
CREATE INDEX idx_google_reviews_org_id      ON public.google_reviews(org_id);

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON public.google_reviews
  FOR ALL TO authenticated
  USING (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());
```

#### `meta_channels`
One record per connected Facebook Page (Messenger) or linked Instagram account per org. Both Messenger and Instagram share the same table because they both flow through a Facebook Page connection — an Instagram account is always linked to a Page.

```sql
-- Migration 019: meta_channels
CREATE TABLE public.meta_channels (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_type                TEXT        NOT NULL CHECK (channel_type IN ('messenger', 'instagram')),
  page_id                     TEXT        NOT NULL,              -- Facebook Page ID
  page_name                   TEXT,
  ig_account_id               TEXT,                              -- populated only for instagram rows
  ig_username                 TEXT,                              -- populated only for instagram rows
  encrypted_page_access_token TEXT        NOT NULL,              -- AES-256-GCM (same pattern as integrations)
  token_expires_at            TIMESTAMPTZ,                       -- NULL = non-expiring page token
  is_active                   BOOLEAN     NOT NULL DEFAULT true,
  webhook_verified            BOOLEAN     NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, page_id, channel_type)
);

CREATE INDEX idx_meta_channels_org_id  ON public.meta_channels(org_id);
CREATE INDEX idx_meta_channels_page_id ON public.meta_channels(page_id);

ALTER TABLE public.meta_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON public.meta_channels
  FOR ALL TO authenticated
  USING (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());
```

**Why not reuse the `integrations` table?** The integrations table uses a typed enum (`integration_provider`) and is keyed for one credential blob per provider per org. Meta channels require per-page rows, type discrimination between messenger/instagram, and additional Meta-specific metadata (page_id, ig_account_id, token_expires_at, webhook_verified). A separate table is cleaner and avoids widening the existing enum with a non-symmetric value.

### 1b. Changes to Existing Tables

#### `conversations` — add channel columns (Migration 020, fully backward-compatible)

```sql
-- Migration 020: multi-channel conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel          TEXT NOT NULL DEFAULT 'widget'
                                            CHECK (channel IN ('widget', 'messenger', 'instagram')),
  ADD COLUMN IF NOT EXISTS channel_metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX idx_conversations_channel ON public.conversations(channel);
```

`channel` defaults to `'widget'` so every existing row gets the correct value with no data migration. The CHECK constraint enforces the allowed set; new channels can be added in a future migration by dropping and re-adding the constraint.

`channel_metadata` is a JSONB blob that carries channel-specific identifiers needed for reply routing:
- widget: `{}` (empty; reply goes through SSE session)
- messenger: `{ "page_id": "...", "psid": "..." }`
- instagram: `{ "page_id": "...", "igsid": "...", "ig_account_id": "..." }`

No RLS policy change needed — the existing `org_isolation` policy on `conversations` already covers all rows.

---

## 2. New API Routes

### Google Reviews Widget

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/reviews/[token]` | GET | Public (token) | Fetch cached reviews for embed. Returns JSON. CORS open. |
| `/api/reviews/[token]` | OPTIONS | None | CORS preflight |

The `token` is the `review_token` column on `google_locations`. This mirrors the existing `/api/widget/[token]/config` pattern exactly. The route uses `createServiceRoleClient()` to bypass RLS — no user session required. The widget script reads from this endpoint at load time.

Admin-triggered sync (re-fetching from Google Places API) is a server action on the dashboard page, not a public route. This keeps the Google API key server-side only.

### Meta Messaging

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/meta/webhook` | GET | None (Meta verification) | Webhook verification handshake |
| `/api/meta/webhook` | POST | None (Meta signature) | Receive Messenger and Instagram message events |
| `/api/meta/callback` | GET | Admin session cookie | OAuth authorization code callback |

All three Meta routes use `export const runtime = 'nodejs'`, matching the existing Vapi handler convention and required for `crypto` Node module access.

---

## 3. Meta OAuth Callback Flow (Next.js App Router)

### Step 1 — Initiate OAuth (Server Action)

The admin clicks "Connect with Facebook" on the Meta channel settings page. A server action:
1. Generates a random CSRF token
2. Stores it in a short-lived, encrypted, httpOnly cookie (e.g. `meta_oauth_state`)
3. Optionally encodes the current org_id in the state value (e.g. `${csrfToken}:${orgId}`)
4. Returns a `redirect()` to Meta's OAuth dialog:

```
https://www.facebook.com/dialog/oauth
  ?client_id={META_APP_ID}
  &redirect_uri=https://operator.skale.club/api/meta/callback
  &scope=pages_show_list,pages_messaging,instagram_manage_messages,pages_read_engagement
  &state={CSRF_TOKEN}
  &response_type=code
```

### Step 2 — Meta Redirects to `/api/meta/callback`

```
GET /api/meta/callback?code=AUTH_CODE&state=CSRF_TOKEN
```

This is a GET route handler (`src/app/api/meta/callback/route.ts`). It must be a GET handler, not a Server Action — Meta appends query parameters to the redirect URI, which is a GET request.

```typescript
export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // 1. Validate user session (getUser() — same pattern as dashboard pages)
  const user = await getUser()
  if (!user) return Response.redirect('/login')

  // 2. Validate CSRF state against cookie
  // compare state to cookie value; redirect to /integrations/meta?error=csrf on mismatch

  // 3. Exchange code for short-lived user access token
  //    POST https://graph.facebook.com/v21.0/oauth/access_token
  //      ?client_id=&client_secret=&redirect_uri=&code=

  // 4. Exchange short-lived user token for long-lived user token (60 days)
  //    GET https://graph.facebook.com/oauth/access_token
  //      ?grant_type=fb_exchange_token&client_id=&client_secret=&fb_exchange_token=SHORT_TOKEN

  // 5. GET https://graph.facebook.com/me/accounts to list pages
  //    — returns page_access_token per page (these do not expire for long-lived pages)

  // 6. For each page: GET /{page-id}?fields=instagram_business_account to find linked IG account

  // 7. Encrypt each page_access_token with lib/crypto.ts encrypt()

  // 8. Upsert into meta_channels (one 'messenger' row per page, one 'instagram' row if IG linked)

  // 9. Redirect to /integrations/meta?connected=true
}
```

**Token lifecycle:**
- Short-lived user token: 1 hour — not stored, used only to get long-lived token
- Long-lived user token: 60 days — not stored, used only to get page tokens
- Page access token (from `/me/accounts`): does not expire — this is what gets stored encrypted
- `token_expires_at` is NULL for page tokens; set to 60-day expiry only if using Instagram user tokens (a different, less common flow)

### Step 3 — Webhook Verification Handshake

During Meta App Dashboard setup, Meta sends:

```
GET /api/meta/webhook?hub.mode=subscribe&hub.verify_token=MY_TOKEN&hub.challenge=CHALLENGE_INT
```

The GET handler:

```typescript
export async function GET(request: Request): Promise<Response> {
  const url       = new URL(request.url)
  const mode      = url.searchParams.get('hub.mode')
  const token     = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}
```

The same file exports both GET and POST handlers. GET handles verification; POST handles event delivery.

---

## 4. Meta Webhook Receiver — Signature Verification

### HMAC-SHA256 Verification

Meta signs every POST event with the app secret. The header:

```
X-Hub-Signature-256: sha256=<HMAC_HEX>
```

Node.js verification (note: use `node:crypto`, same runtime as existing Vapi handler):

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = signatureHeader.slice(7)
  const computed = createHmac('sha256', process.env.META_APP_SECRET!)
    .update(rawBody, 'utf8')
    .digest('hex')
  return timingSafeEqual(Buffer.from(expected), Buffer.from(computed))
}
```

**Critical:** Read the raw body as text before JSON parsing. Use `await request.text()`, then `JSON.parse(rawBody)`. Do not use `request.json()` if you need the raw bytes for signature verification — the body stream can only be consumed once.

### Event Routing

Both Messenger and Instagram events arrive on the same `/api/meta/webhook` POST endpoint. Distinguish by payload shape:

```
// Messenger
entry[].messaging[].sender.id     → PSID (user identifier for that page)
entry[].messaging[].message.text

// Instagram
entry[].changes[].field === 'messages'
entry[].changes[].value.sender.id → IGSID (user identifier for that IG account)
entry[].changes[].value.message.text
```

`entry[].id` is the Page ID in both cases. Look it up in `meta_channels` using `createServiceRoleClient()` to find the org. The webhook handler must return HTTP 200 within 5 seconds — use `after()` from `next/server` for the database writes, exactly as the existing Vapi handlers do.

---

## 5. Outbound Reply Routing

The existing `handleSendMessage` in `AdminChatLayout` calls `POST /api/chat/conversations/{id}/messages`. That route currently persists the message and returns. For multi-channel, the route checks `conversations.channel` and routes accordingly:

```typescript
if (channel === 'widget') {
  // unchanged: persist to DB, SSE polling picks it up
  await persistMessage(conversationId, 'assistant', content)

} else if (channel === 'messenger') {
  const { page_id, psid } = channelMetadata
  const token = await getDecryptedPageToken(page_id, orgId)
  // POST to Messenger Send API
  await fetch(`https://graph.facebook.com/v21.0/${page_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text: content },
      messaging_type: 'RESPONSE',
      access_token: token,
    }),
  })
  await persistMessage(conversationId, 'assistant', content)

} else if (channel === 'instagram') {
  const { ig_account_id, igsid, page_id } = channelMetadata
  const token = await getDecryptedPageToken(page_id, orgId)
  // POST to Instagram Messaging API
  await fetch(`https://graph.instagram.com/v21.0/${ig_account_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text: content },
      messaging_type: 'RESPONSE',
      access_token: token,
    }),
  })
  await persistMessage(conversationId, 'assistant', content)
}
```

`getDecryptedPageToken(page_id, orgId)` queries `meta_channels` via service role client and calls `decrypt()` from `lib/crypto.ts`.

**24-Hour Messaging Window:** Meta's standard `messaging_type: 'RESPONSE'` only works within 24 hours of the last inbound user message. After that, only `HUMAN_AGENT` tag (7-day window, requires App Review) is permitted. The webhook handler must update `conversations.last_message_at` on every inbound message. The ChatArea component should display a warning banner when the conversation channel is not `widget` and the last message was more than 23 hours ago.

---

## 6. Component Extension Strategy

### `ConversationSummary` type (`src/types/chat.ts`)

Add two optional fields — existing consumers are unaffected:

```typescript
export interface ConversationSummary {
  // ... all existing fields unchanged
  channel?: string | null                              // 'widget' | 'messenger' | 'instagram'
  channelMetadata?: Record<string, unknown> | null
}
```

### `/api/chat/conversations` GET route

Add `channel` and `channel_metadata` to the SELECT and map them in the response. The change is additive — old callers simply receive extra fields they ignore.

### `ConversationList` component

Add a channel filter pill/dropdown beneath the search bar, above the Open/Archived/All tabs. Each conversation row gains a small icon (globe for widget, recognizable icon for messenger/instagram) beside the avatar. The filter is client-side — the component already filters the `conversations` prop and adding a `channel` dimension is a small addition.

### `ChatArea` component

1. Add a channel origin badge in the conversation header.
2. Show a dismissible warning banner when `channel !== 'widget'` and `lastMessageAt` is older than 23 hours.
3. The send form, keyboard shortcut, and optimistic append logic are unchanged.
4. Reply routing is entirely server-side — no new props on `ChatArea` are required.

---

## 7. New Dashboard Pages

### Google Reviews

```
src/app/(dashboard)/reviews/
  page.tsx          -- list google_locations for active org; trigger sync; preview reviews
  actions.ts        -- server actions: addLocation, syncReviews, deleteLocation
  loading.tsx
```

The admin enters a Google Place ID (or the page searches by name). On save, a server action calls the Places API with `X-Goog-FieldMask: id,displayName,formattedAddress,reviews` and upserts the results. The `GOOGLE_PLACES_API_KEY` never leaves server-side code.

### Meta Channels

```
src/app/(dashboard)/integrations/meta/
  page.tsx          -- list connected channels; "Connect with Facebook" button; disconnect
  actions.ts        -- server actions: initiateOAuth (set CSRF cookie + redirect), disconnectChannel
  loading.tsx
```

Placed under `/integrations/` because channel setup is a one-time credential act, parallel to the existing integrations page.

---

## 8. Google Reviews Widget Build Pipeline

Mirrors the existing chat widget exactly:

```
src/reviews-widget/index.ts   -- standalone vanilla TypeScript; no React imports
public/reviews-widget.js      -- esbuild output
```

Add to `package.json` scripts:

```json
"build:reviews-widget": "esbuild src/reviews-widget/index.ts --bundle --minify --platform=browser --format=iife --target=es2017 --outfile=public/reviews-widget.js",
"build": "npm run build:widget && npm run build:reviews-widget && next build"
```

Embed pattern on client sites:

```html
<script src="https://operator.skale.club/reviews-widget.js" data-token="REVIEW_TOKEN" data-layout="carousel" async></script>
```

The widget reads `data-token` from its own `<script>` element, calls `/api/reviews/[token]` (CORS open), and renders the chosen layout.

---

## 9. Environment Variables

```bash
# Existing — unchanged
ENCRYPTION_SECRET=...           # AES-256-GCM key used for meta_channels token encryption too

# New — Google Reviews (server-only)
GOOGLE_PLACES_API_KEY=...

# New — Meta Messaging (server-only)
META_APP_ID=...
META_APP_SECRET=...             # Used for HMAC-SHA256 webhook verification
META_VERIFY_TOKEN=...           # Arbitrary secret you configure in App Dashboard
```

None of these are prefixed `NEXT_PUBLIC_` — they are never sent to the browser.

---

## 10. Build Order and Phase Dependencies

| Phase | Deliverable | Hard Dependency | Can Parallelize With |
|-------|-------------|-----------------|----------------------|
| 1 | Migrations 018 + 019 + 020 (all schema) | None | Nothing — must ship first |
| 2 | Google Reviews admin page + Places API sync server action | Migration 018 | Phase 4 |
| 3 | Google Reviews embed widget + `/api/reviews/[token]` route | Migration 018 | Phase 4 |
| 4 | Meta OAuth flow (callback route, CSRF, meta_channels write) | Migration 019 | Phase 2, 3 |
| 5 | Meta webhook receiver + inbound conversation creation | Migrations 019 + 020, Phase 4 tokens | — |
| 6 | Multi-channel inbox UI (icons, filter bar, 24h warning) | Migration 020, Phase 5 | — |
| 7 | Outbound reply routing to Meta Send API | Phases 4 + 5 + 6 | — |

**Key dependency reasoning:**
- All three migrations (018, 019, 020) must land together in Phase 1, even though Google Reviews and Meta have no runtime dependency on each other, because the `conversations.channel` column (020) is required by both the Meta webhook writer (Phase 5) and the inbox UI (Phase 6).
- Phases 2 and 3 (Google Reviews) have zero runtime dependency on Phases 4–7 (Meta) and can be built and shipped independently after Phase 1.
- Phase 7 (outbound replies) is the highest-risk change because it modifies the existing `POST /api/chat/conversations/[id]/messages` route that widget chat already uses. It must be the last Phase built and tested.

---

## 11. Backward-Compatibility Matrix

| Existing behavior | Change | Risk | Mitigation |
|-------------------|--------|------|------------|
| Widget conversations (`channel = 'widget'`) | `ALTER TABLE ... ADD COLUMN channel DEFAULT 'widget'` | None | DEFAULT ensures all existing rows get correct value; no data migration |
| `ConversationSummary` TypeScript type | New optional `channel?` and `channelMetadata?` fields | None | Optional fields; all existing callers compile without changes |
| `ConversationList` filter logic | New channel filter added alongside existing status tabs | None | Additive; existing filter code path unchanged |
| `ChatArea` send form | Reply routing logic lives in the API route, not the component | None | Component interface props unchanged |
| `/api/chat/conversations` GET | New columns added to SELECT and mapped to response | None | Additive JSON fields; existing clients ignore unknown fields |
| Widget embed (`/api/widget/[token]/config`) | No changes | None | Separate route, separate table |
| Vapi webhook routes (`/api/vapi/*`) | No changes | None | Completely separate routes |
| `public/widget.js` build | Build command unchanged; reviews widget is a separate output | None | Two separate esbuild commands |
| `integrations` table | No changes | None | `meta_channels` is a separate table |

---

## Sources

- [Meta Webhooks for Messenger Platform](https://developers.facebook.com/docs/messenger-platform/webhooks) — GET verification handshake, X-Hub-Signature-256 format
- [Instagram Platform Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/) — IGSID, message event payload, entry.changes structure
- [Meta Messenger Send API](https://developers.facebook.com/docs/messenger-platform/reference/send-api/) — reply endpoint format, messaging_type
- [Meta Access Token Lifecycle](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/) — page tokens do not expire; user tokens are 60 days
- [Google Places API (New) Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details) — reviews field, X-Goog-FieldMask, 5-review limit
- Codebase: migrations 011–017, chat components, vapi handlers, crypto.ts, widget build pipeline (all read directly)
