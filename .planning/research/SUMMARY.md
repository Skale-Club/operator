# Research Summary: v1.3 Google Reviews Widget + Meta Messaging

**Synthesized:** 2026-05-04
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Critical Decisions (must be made before planning)

**1. Google Reviews caching strategy**
The project plan says "store in DB." Google Places API ToS prohibits durable storage of review content beyond place IDs. Safe approach: design `google_reviews` rows as an ephemeral cache with a mandatory `fetched_at` column and a daily refresh job. The schema must encode this from day one. Decision needed: what is the maximum cache age before a widget refuses to serve stale reviews? 30 days is the ToS-safe boundary.

**2. Meta App Review timeline**
All three permissions required for the inbox (`instagram_manage_messages`, `pages_messaging`, `pages_manage_metadata`) require Advanced Access = Business Verification (2-5 days) + App Review (2-7 days, often longer on first submission). Until approved, only Developer/Tester-role accounts can connect. Decision needed: is there a client-facing launch date commitment? If yes, App Review submission must happen before Phase 1 code, not after.

**3. Human Agent mode timing**
The `HUMAN_AGENT` message tag is the only remaining way to reply after the 24-hour window (all other Messenger Message Tags deprecated February 9, 2026). Meta requires a working human escalation path in the App Review screencast. Decision needed: build the human agent toggle in Phase 1 (required for App Review) or Phase 2 (natural UX order)?

**4. Outbound reply route modification scope**
The existing `POST /api/chat/conversations/[id]/messages` is in production. Decision needed: modify it with a channel branch (simpler), or create a new parallel route (zero risk to existing widget chat but near-duplicate routes)?

**5. Webhook async processing pattern**
Two valid patterns: (a) verify HMAC, return 200, use `after()` from `next/server` to process asynchronously - simpler, no new table; or (b) write raw payload to a `meta_webhook_queue` table, return 200, process via Supabase cron - idempotent deduplication on Meta retries by `mid`. Decision needed before migration 019 is written.

---

## Stack Additions

| Package | Version | Purpose | Why not X |
|---------|---------|---------|-----------|
| `@googlemaps/places` | `^2.4.0` | Official Node.js client for Places API (New) v1 - handles `X-Goog-FieldMask` header and TypeScript types | `@googlemaps/google-maps-services-js` wraps Legacy API only, which is deprecated |
| *(none)* | - | Meta Graph API calls via `fetch` | No maintained official Meta npm SDK; only 3 endpoints needed |
| *(none)* | - | Meta webhook HMAC via `node:crypto` (built-in) | 5-line implementation; no package justified |
| *(none)* | - | Facebook OAuth via manual `fetch` flow | NextAuth conflicts with Supabase Auth; this is integration OAuth not user auth |
| *(none)* | - | Reviews widget IIFE via existing esbuild pipeline | New `build:reviews-widget` script added to `package.json`; no new tooling |

**Net new npm installs: 1**

---

## Module 1: Google Reviews Widget

### Table Stakes

- Display up to 5 reviews per location (hard API ceiling, no workaround)
- Star rating, review text, author name, relative date, author photo (with initials fallback when photoUri absent)
- Overall place rating and total review count (`rating` + `userRatingCount`)
- Four embed layouts: carousel, grid, list, compact
- Single `<script>` tag embed, Shadow DOM isolation, same pattern as existing `widget.js`
- Admin location registration: search by name, confirm Place ID, save
- Unique `review_token` per location (same model as `widget_token`)
- Admin embed code generation page
- "Powered by Google" attribution footer - mandatory per ToS, not a configurable option
- Per-review attribution: author name adjacent to review text - mandatory per ToS

### Differentiators

- Visual customization (brand color, card background, font size) via CSS custom properties in Shadow DOM
- Layout preview in admin dashboard before embed
- Manual refresh trigger with "last refreshed" timestamp
- Locale toggle: `originalText` (reviewer original language) vs `text` (translated)

### API Reality Check

| Constraint | Detail |
|-----------|--------|
| Hard review limit | 5 reviews per location - no pagination, no offset, no workaround in the official Places API |
| Review selection | Google relevance algorithm picks which 5; the caller has no control over ordering or selection |
| Billing SKU | Place Details Enterprise + Atmosphere - 1,000 requests/month free, then $25/1,000. Each location sync = 1 billable event |
| Caching ToS | ToS prohibits storing API content beyond place IDs. Safe approach: time-bounded cache with `fetched_at`, refresh within 30 days, preserve all attribution fields exactly as returned |
| Attribution required | Author name adjacent to review text, author photo and profile link when available, "Powered by Google" logo, link to Google Maps listing - all required by policy |
| Sorting/filtering | Not possible - Google returns reviews ranked by relevance only; the caller cannot sort |
| More than 5 reviews | Requires Google Business Profile API: 2-4 week approval, ownership verification - out of scope for v1.3 |
| New review alerts | Places API has no webhook for new reviews - scheduled refresh only |
| Field format (New API) | `authorAttribution.displayName`, `authorAttribution.uri`, `authorAttribution.photoUri` - different from legacy field names |

---

## Module 2: Meta Messaging

### Table Stakes

- Receive inbound Instagram DMs in existing chat inbox
- Receive inbound Facebook Messenger messages in existing chat inbox
- Admin reply to both channel types from the inbox
- Meta OAuth connect flow: Facebook Login, page selection, Instagram account link
- Channel type labels in inbox (instagram / messenger / webchat) with icons
- Inbox filter by channel
- Token expiry detection + re-auth prompt
- 24-hour messaging window enforcement on the send UI - disable or warn after 24h from last inbound
- Webhook HMAC signature verification (`X-Hub-Signature-256`) on all incoming Meta payloads
- Webhook GET challenge handshake
- Org-scoped encrypted channel credentials (`meta_channels` table, AES-256-GCM)

### Differentiators

- Automation binding per Meta channel - existing `executeAction()` reused from new trigger source
- Story reply identification - `message.reply_to.story` check, story reply badge in thread
- `messaging_seen` read receipt display
- Human agent mode toggle - marks conversation as human-handled, enables `HUMAN_AGENT` tag for 7-day reply window
- Referral source on conversation - `messaging_referral` events reveal which ig.me link or ad drove the message

### API Reality Check

| Constraint | Detail |
|-----------|--------|
| "New follower" event | Does not exist. Deprecated by Meta in 2018. Cannot be approximated by polling. Any plan referencing this trigger must be removed before planning begins |
| 24-hour window | After last inbound message, automated replies allowed for 24 hours. After 24h, only `HUMAN_AGENT`-tagged messages within a 7-day window. After 7 days, no outbound of any type |
| Message Tags deprecation | All Message Tags except `HUMAN_AGENT` deprecated on Messenger since February 9, 2026. Do not build any tag-based workarounds |
| App Review gate | `instagram_manage_messages`, `pages_messaging`, `pages_manage_metadata` all require Advanced Access = Business Verification + App Review. Without approval, only Developer/Tester-role accounts can connect |
| Development Mode restriction | Real client Pages and Instagram accounts cannot connect until App Review is approved |
| Instagram architecture | Instagram DMs use Messenger Platform infrastructure - no standalone Instagram API. Requires a Facebook Page linked to an Instagram Business or Creator account |
| Token model | OAuth produces short-lived User token (1h) -> exchange for long-lived User token (60 days) -> fetch Page Access Token (non-expiring unless revoked). Only Page Access Token is stored, encrypted |
| Token invalidation | Page tokens invalidated by: password change, permission revocation, account deactivation. Detect via Graph API error code 190 |
| Rate limits | ~200 DMs/hour per Instagram account (community-reported; not precisely documented by Meta) |
| Webhook payload | Messenger and Instagram events arrive on the same endpoint. Distinguish by `object` field ("page" vs "instagram") |
| Historical messages | Meta does not expose historical conversations via API. Only conversations started after webhook activation appear in the inbox |
| Instagram not marked read | Sending a reply via API does not mark the thread as read in the native Instagram app. Platform limitation, not fixable |

---

## Architecture Summary

### DB Migrations Needed

Three migrations must land as Phase 1, before any feature code:

**Migration 018 - google_locations + google_reviews**
- `google_locations`: org-scoped, stores `place_id`, `review_token` (public embed token), `last_synced_at`
- `google_reviews`: up to 5 rows per location, stores all attribution fields (`author_name`, `author_photo_url`, `author_uri`), `google_review_id` as dedup key, `display_order`, `fetched_at`
- Both tables: RLS enabled with `get_current_org_id()` policy, indexed on `org_id`

**Migration 019 - meta_channels**
- One row per connected Facebook Page per channel type per org
- Columns: `channel_type` (messenger | instagram), `page_id`, `ig_account_id`, `encrypted_page_access_token`, `token_expires_at`, `webhook_verified`, `is_active`
- RLS enabled, indexed on `org_id` and `page_id`

**Migration 020 - conversations column additions**
- `channel TEXT NOT NULL DEFAULT 'widget' CHECK (channel IN ('widget', 'messenger', 'instagram'))`
- `channel_metadata JSONB NOT NULL DEFAULT '{}'` - carries psid/igsid/page_id for reply routing
- `external_sender_id TEXT` - stores Meta IGSID or PSID for future deduplication
- `last_user_message_at TIMESTAMPTZ` - drives 24-hour window enforcement
- Default 'widget' ensures zero data migration for existing rows

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| /api/reviews/[token] | GET + OPTIONS | Public CORS-open endpoint; returns cached reviews for embed widget |
| /api/meta/webhook | GET | Meta hub.challenge verification handshake |
| /api/meta/webhook | POST | Receive Messenger + Instagram message events |
| /api/meta/callback | GET | Facebook OAuth authorization code callback |

All Meta routes: `export const runtime = 'nodejs'`

### Component Changes

- `ConversationSummary` type: add optional `channel`, `channelMetadata`, `lastUserMessageAt`
- `ConversationList`: add channel filter pill; add per-row channel icon
- `ChatArea`: add channel origin badge; add 24h window warning banner when channel is not widget and last inbound is older than 23h
- `/api/chat/conversations` GET route: add `channel` and `channel_metadata` to SELECT - additive, no breaking change
- Reply route: branch on `channel` to route to Messenger or Instagram Send API (see Decision 4)

### New Dashboard Pages

- `src/app/(dashboard)/reviews/` - list locations, trigger sync, preview reviews, generate embed code
- `src/app/(dashboard)/integrations/meta/` - list connected channels, connect/disconnect, token status, re-auth prompt

### Widget Build Pipeline Addition

Add to package.json scripts:

```
"build:reviews-widget": "esbuild src/reviews-widget/index.ts --bundle --minify --platform=browser --format=iife --target=es2017 --outfile=public/reviews-widget.js"
```

### Build Order

| Phase | Deliverable | Hard Dependency |
|-------|-------------|-----------------|
| 1 | Migrations 018 + 019 + 020 | None - must ship first |
| 2 | Reviews admin page + Places API sync server action | Migration 018 |
| 3 | Reviews embed widget + /api/reviews/[token] | Migration 018 |
| 4 | Meta OAuth flow (callback, CSRF, meta_channels write) | Migration 019 |
| 5 | Meta webhook receiver + inbound conversation creation | Migrations 019 + 020, Phase 4 tokens |
| 6 | Multi-channel inbox UI (icons, filter, 24h warning) | Migration 020, Phase 5 |
| 7 | Outbound reply routing to Meta Send API | Phases 4 + 5 + 6 |

Phases 2-3 and Phase 4 can be built in parallel after Phase 1. Phase 7 is highest-risk (touches the production reply route) and must be last.

---

## Watch Out For (Top 5 Pitfalls)

**1. Meta App Review is a phase blocker, not a launch detail (M1 + M2 - CRITICAL)**
Without Advanced Access approval, zero real clients can connect their Pages. Business Verification must be submitted on day one of the milestone - it has no engineering dependency and takes 2-5 days. App Review must be submitted as soon as a working end-to-end screencast can be recorded, ideally after Phase 4. Any client-facing launch date must account for 2-10 weeks of review time. The human agent toggle may need to be built in Phase 1 to satisfy the App Review screencast human escalation requirement.

**2. Raw body consumed before HMAC verification (M4 - HIGH)**
In Next.js App Router, `request.json()` consumes the body stream. If called before HMAC verification, the raw bytes for signature computation are gone and all webhook verification fails permanently. Correct pattern: `await request.text()` first, verify HMAC with `crypto.timingSafeEqual`, then `JSON.parse(rawBody)`. Must be correct from the first commit of the webhook handler.

**3. Google reviews caching without fetched_at violates ToS (G1 - CRITICAL)**
The `google_reviews` table must include `fetched_at` from migration 018. A daily refresh mechanism must be part of Phase 1 planning, not a later enhancement. Serving data older than 30 days without re-fetching violates Google Places API ToS. Schema and refresh strategy must be settled before the table is created.

**4. Channel routing collision in the reply path (I1 - CRITICAL)**
Extending the reply route to branch on `channel` creates a path where a typo or missing case sends a reply to the wrong platform or drops it silently. Use a TypeScript discriminated union with an exhaustive switch on `Channel = 'widget' | 'messenger' | 'instagram'`. The `conversations.channel` column must have a database-level CHECK constraint. Phase 7 must include a unit test per channel that verifies the correct send function is invoked.

**5. Wrong token stored in the Meta OAuth flow (M5 - HIGH)**
The OAuth flow produces a short-lived User Access Token (expires ~1 hour). This must be exchanged for a long-lived User Access Token (60 days), then used to fetch Page Access Tokens (non-expiring). Storing the short-lived token directly will work during development and silently fail in production. The full three-step token chain must be implemented in Phase 4. Detect token invalidation via Graph API error code 190 in every outbound call and surface a re-auth prompt.

---

## Pre-Development Checklist

Items with no engineering dependency that must be complete before Phase 1 code starts:

- [ ] Submit Meta Business Verification - required before App Review for Advanced Access; takes 2-5 business days; start immediately
- [ ] Create dedicated test Facebook Page and Instagram Business account for development testing; real client accounts cannot be used in Development Mode
- [ ] Add test FB/IG accounts as Developers/Testers on the Meta app
- [ ] Configure Google Cloud billing alerts at $50 and $150; set a daily quota cap in Google Cloud Console
- [ ] Set environment variables in Vercel production: GOOGLE_PLACES_API_KEY, META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN
- [ ] Plan the App Review submission - prepare privacy policy URL, document use case, plan screencast of end-to-end OAuth + messaging flow; submit after Phase 4 is functional
- [ ] Confirm ENCRYPTION_SECRET is set in Vercel production - Meta Page Access Tokens use the same AES-256-GCM key as existing integration credentials

---

## Open Questions

1. **Maximum cache age for Google reviews** - 30 days is the ToS-safe boundary; a shorter default (e.g., 7 days) may be better UX. What is the agreed TTL?

2. **Async webhook processing pattern** - `after()` from `next/server` (simpler, no new table) vs. `meta_webhook_queue` table + Supabase cron (idempotent, deduplicates by mid)? This affects whether migration 019 includes a queue table.

3. **Modify existing reply route vs. new route** - extend `POST /api/chat/conversations/[id]/messages` with a channel branch (simpler) or create a parallel route (safer, zero risk to existing widget chat)?

4. **Human agent toggle in Phase 1 or Phase 2?** - App Review screencast may require demonstrating a human escalation path before the inbox UX is built.

5. **Scheduled review refresh mechanism** - Supabase Edge Function cron vs. GitHub Actions scheduled workflow?

6. **Multi-location support scope in v1.3** - schema supports many locations per org; is the MVP one location per org, or do agencies need multiple from day one?

7. **Token invalidation UX for Meta** - when error code 190 is detected: silent dashboard warning, or immediate inline re-auth prompt in the affected conversation?

---

## Confidence Assessment

| Area | Level | Basis |
|------|-------|-------|
| Google Places API constraints (5-review limit, billing SKU, field names) | HIGH | Official REST reference + official pricing table |
| Google ToS on caching review content | MEDIUM | Policy docs confirm general prohibition; 30-day boundary is a practical interpretation, not an explicit documented exception |
| Meta webhook events (full list, absence of new follower) | HIGH | Official Meta developer docs |
| Meta 24-hour window + HUMAN_AGENT tag | HIGH | Official policy docs + multiple secondary sources |
| Meta App Review requirements (Advanced Access, Business Verification) | HIGH | Official App Review docs |
| Meta token lifecycle (short-lived to long-lived to Page token) | HIGH | Official token reference docs |
| Message Tags deprecation (Feb 2026) | MEDIUM | Community source consistent with Meta policy direction; not from official changelog |
| Instagram rate limits (~200 DM/hr) | MEDIUM | Community-reported; not precisely documented by Meta |
| Architecture fit with existing codebase | HIGH | Based on direct codebase inspection in ARCHITECTURE.md |

---

## Sources (aggregated)

- Google Places API (New) REST Reference - developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Google Maps Platform billing post-March 2025 - developers.google.com/maps/billing-and-pricing/march-2025
- Google Places API policies - developers.google.com/maps/documentation/places/web-service/policies
- @googlemaps/places v2.4.0 - npmjs.com/package/@googlemaps/places
- Meta Graph API v25.0 changelog - developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/
- Meta Instagram Platform Webhooks - developers.facebook.com/docs/instagram-platform/webhooks/
- Meta Messenger Platform Webhook Events - developers.facebook.com/docs/messenger-platform/reference/webhook-events/
- Meta App Review (Instagram Platform) - developers.facebook.com/docs/instagram-platform/app-review/
- Meta Permissions Reference - developers.facebook.com/docs/permissions/
- Meta Access Token Lifecycle - developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
- Meta Send API (Messenger) - developers.facebook.com/docs/messenger-platform/reference/send-api/
- Meta 24-hour messaging window policy - developers.facebook.com/docs/messenger-platform/policy/policy-overview/
- Vercel Hobby plan function limits - vercel.com/docs/functions/limitations
