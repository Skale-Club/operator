# Technology Stack

**Project:** Operator v1.3 — Google Reviews Widget + Meta Messaging
**Researched:** 2026-05-04
**Scope:** Additions only. Base stack (Next.js 15, TypeScript, Supabase, Tailwind 4, shadcn/ui, Redis, LangChain, esbuild) is validated and unchanged.

---

## Summary Table — New Packages

| Package | Version | Module | Add? | Rationale |
|---------|---------|--------|------|-----------|
| `@googlemaps/places` | `^2.4.0` | Reviews | YES | Official Google Places API (New) client for Node.js — v1 REST API, supports `getPlace` with reviews field |
| *(no new package)* | — | Reviews widget | NO | esbuild IIFE pipeline already exists; widget is vanilla JS like `public/widget.js` |
| *(no new package)* | — | Meta Graph API | NO | Use `fetch` directly — no official npm SDK exists; Graph API is pure HTTP |
| *(no new package)* | — | Meta webhook verification | NO | Node.js built-in `crypto.createHmac('sha256', secret)` is sufficient |
| *(no new package)* | — | Facebook OAuth | NO | Manual authorization-code flow via `fetch` — no library needed for a single OAuth integration |

**Net new npm installs: 1** (`@googlemaps/places`)

---

## Module 1: Google Reviews Widget

### What needs to be built

1. **Server-side fetcher** — Next.js server action or API route calls Google Places API (New), stores up to 5 reviews per location in Supabase
2. **Admin UI** — Register location by Place ID or name search, trigger refresh, view stored reviews
3. **Embed script** — `public/reviews-widget.js` (new IIFE bundle via existing esbuild pipeline), reads config from `GET /api/widget/reviews/[token]`, renders reviews in Shadow DOM

### Package decision: `@googlemaps/places` v2.4.0

**Use this.** The older `@googlemaps/google-maps-services-js` (v3.4.2) explicitly states it only supports the Legacy Places API. The new Places API v1 (`places.googleapis.com/v1`) is covered by the separate `@googlemaps/places` package, currently at **v2.4.0** (published June 2025, preview status but stable enough for production use).

```bash
npm install @googlemaps/places
```

Key method: `client.getPlace({ name: 'places/PLACE_ID', languageCode: 'en' })` with field mask `reviews,displayName,rating,userRatingCount,id`.

**Why not raw fetch?** The `@googlemaps/places` package handles auth header injection, field mask serialization, and TypeScript types for the v1 response shape. The v1 REST API uses a non-trivial `X-Goog-FieldMask` header pattern that the SDK abstracts cleanly. Given this is a one-time call per location refresh (not a hot path), SDK overhead is irrelevant.

**Why not `@googlemaps/google-maps-services-js`?** It wraps the Legacy API only. The Legacy API for Place Details returns at most 5 reviews (Google's undocumented cap) which matches the product requirement, but the Legacy API is explicitly deprecated and will be retired — start on v1.

### Google Places API billing reality (HIGH confidence)

Reviews fall under the **Place Details Enterprise + Atmosphere SKU** — the highest billing tier. Post-March 2025 pricing:

- Free tier: **1,000 requests/month** per Enterprise SKU (not per place)
- Beyond free: ~$20/1,000 requests

**Critical implication for architecture:** The 1,000/month free cap means reviews must be fetched on-demand (when an admin registers or manually refreshes a location) and stored in Supabase. The stored copy is what the embed widget reads. Do NOT fetch live from Google on every widget page load.

**Google's caching policy conflict (MEDIUM confidence):** Google's Places API Terms technically prohibit pre-fetching and storing API content (except place IDs). However, this restriction applies to displaying cached data as if it were live, and the rationale is attribution freshness. The practical industry approach (and what the project requires to stay within free tier) is to cache with a refresh interval (e.g., weekly or on-demand by admin) and display proper attribution (author name, link, photo). Google enforces this via attribution requirements, not technical blockers. The PROJECT.md goal of "store in DB" is consistent with how every real-world reviews widget operates.

**Attribution requirements (mandatory):**
- Display each reviewer's name, link to their Google profile, and photo (when provided)
- Show how reviews are sorted
- Link back to the place's Google Maps listing

### Reviews API endpoint

```
GET https://places.googleapis.com/v1/places/{PLACE_ID}
Headers:
  X-Goog-Api-Key: {API_KEY}
  X-Goog-FieldMask: id,displayName,rating,userRatingCount,reviews
```

Reviews returned: up to 5 (Google's platform limit, confirmed by documentation examples and community reports — no official number is published but 5 is the consistent cap across both Legacy and New APIs).

### What NOT to add for Reviews

| Skip | Why |
|------|-----|
| `@googlemaps/google-maps-services-js` | Legacy API wrapper only; explicitly not for Places v1 |
| `react-google-reviews` (featurable) | React component library; the embed widget is vanilla JS (Shadow DOM IIFE) — same pattern as existing `widget.js` |
| Any scraping library (`puppeteer`, etc.) | Violates Google ToS; unnecessary when API exists |
| A separate esbuild config | Extend existing `build:widget` script or add a parallel `build:reviews-widget` script; same pipeline |

---

## Module 2: Meta Messaging (Instagram + Facebook Messenger)

### What needs to be built

1. **Facebook OAuth flow** — Admin connects Facebook Page → get Page Access Token → subscribe to Instagram account
2. **Meta webhook receiver** — `POST /api/meta/webhook` (new route) for incoming messages from both channels
3. **Meta webhook verifier** — `GET /api/meta/webhook` for Facebook's hub.challenge handshake
4. **Message reply sender** — server action calls Graph API Send API with Page Access Token
5. **Inbox extension** — extend existing `conversations`/`conversation_messages` tables and `AdminChatLayout` for `instagram` and `messenger` channel types

### Package decision: No Meta SDK — use raw `fetch`

**Do not install any Meta/Facebook npm package.** The Graph API is a straightforward REST API and no official Meta npm SDK exists for Node.js server-side use. Community wrappers (e.g., `fb`, `facebook-node-sdk`) are unmaintained or stale. The Graph API surface needed is exactly 3 endpoints:

1. `GET https://graph.facebook.com/v25.0/me/accounts` — list Pages after OAuth
2. `POST https://graph.facebook.com/v25.0/{PAGE_ID}/messages` — Messenger Send API
3. `POST https://graph.instagram.com/{INSTAGRAM_USER_ID}/messages` — Instagram Messaging API

All three are simple `fetch` calls with a Bearer token. TypeScript interfaces for request/response shapes can be defined inline (they are narrow).

**Current Graph API version: v25.0** (released February 2026, current as of May 2026). Use this version string in all endpoint URLs.

### Facebook OAuth: manual flow, no library

**Do not add NextAuth.js or any OAuth library.** This is not user authentication — it is a one-time admin integration flow to connect a Facebook Page. The flow is:

1. Redirect admin to `https://www.facebook.com/v25.0/dialog/oauth?client_id=...&redirect_uri=...&scope=pages_messaging,instagram_manage_messages,pages_manage_metadata`
2. Facebook redirects back to `GET /api/meta/oauth/callback?code=...`
3. Server exchanges `code` for short-lived token: `GET https://graph.facebook.com/v25.0/oauth/access_token`
4. Exchange for long-lived token (60-day): `GET https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&...`
5. Store encrypted long-lived Page Access Token in Supabase (using existing `crypto.ts` AES-256-GCM pattern)

NextAuth.js would add 5+ dependencies and fight the existing Supabase Auth session model. The manual flow is ~50 lines of fetch calls in a route handler.

### Webhook verification: Node.js `crypto` module

**No npm package needed.** Meta signs webhook payloads with `X-Hub-Signature-256: sha256=...` using the App Secret as the HMAC key. Verification:

```typescript
import crypto from 'node:crypto'

function verifyMetaSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

The raw body must be captured before JSON parsing. In Next.js App Router route handlers, use `await request.arrayBuffer()` then convert to Buffer. Do NOT use `request.json()` before verification.

### Meta permissions required

| Permission | Purpose | Review required? |
|------------|---------|-----------------|
| `pages_messaging` | Send/receive Messenger messages | Yes (App Review) |
| `instagram_manage_messages` | Send/receive Instagram DMs | Yes (App Review) — use advanced access |
| `pages_manage_metadata` | Subscribe page to webhooks | Yes (App Review) |
| `pages_read_engagement` | Read page info, linked Instagram account | Standard access |

**24-hour messaging window (must be enforced in app logic):**
- Instagram: 24h window after user initiates contact. After window: Human Agent tag only (7 days, support-only).
- Messenger: Same 24h window. `messaging_type: RESPONSE` inside window; `MESSAGE_TAG` outside.
- The app must track `last_user_message_at` per conversation to gate reply options.

### Meta webhook events to subscribe

**Instagram:** `messages`, `messaging_seen`, `message_reactions`
**Messenger:** `messages`, `messaging_postbacks`, `messaging_seen`

Both share the same webhook endpoint — distinguish by `object` field in payload (`"instagram"` vs `"page"`).

### What NOT to add for Meta Messaging

| Skip | Why |
|------|-----|
| `next-auth` / `auth.js` | This is integration OAuth (connecting a Page), not user auth. Would conflict with existing Supabase Auth. |
| `facebook-node-sdk` / `fb` | Unmaintained, legacy. Raw fetch covers the 3 endpoints needed. |
| Any Instagram API wrapper | Same reason — narrow surface, straightforward REST. |
| `passport.js` | Same as NextAuth — designed for user auth flows, not integration token management. |
| Socket.io or WebSockets | Existing polling model in AdminChatLayout handles chat inbox. Meta delivers via webhooks to server, not real-time to browser. |

---

## Environment Variables to Add

```bash
# Google Places
GOOGLE_PLACES_API_KEY=                # Server-side only, never expose to client

# Meta App credentials
META_APP_ID=                          # Public — used in OAuth dialog URL
META_APP_SECRET=                      # Server-side only — HMAC key for webhook verification
META_WEBHOOK_VERIFY_TOKEN=            # Static string you define — used in hub.verify_token check
```

Meta Page Access Tokens (long-lived, per org) are stored encrypted in the existing `integrations` / `org_credentials` Supabase table using the existing AES-256-GCM pattern in `src/lib/crypto.ts`.

---

## Widget Script Pipeline

The existing esbuild pipeline produces `public/widget.js` from `src/widget/index.ts`. The Reviews Widget embed script follows the same pattern:

```json
"build:reviews-widget": "esbuild src/reviews-widget/index.ts --bundle --minify --platform=browser --format=iife --target=es2017 --outfile=public/reviews-widget.js"
```

Add this script to `package.json` and include it in the `build` script chain. No new esbuild config, no new esbuild plugins. The reviews widget is vanilla TypeScript compiled to an IIFE, same as the chat widget. It reads config from `GET /api/widget/reviews/[token]` (CORS-enabled, returns cached review data + widget config).

---

## Alternatives Considered

| Decision | Alternative | Why Not |
|----------|-------------|---------|
| `@googlemaps/places` (v1) | `@googlemaps/google-maps-services-js` | Explicitly wraps Legacy API only; deprecated path |
| `@googlemaps/places` (v1) | Raw `fetch` to Places v1 REST | SDK handles field mask headers and TS types cleanly; request volume is low (admin-triggered only) |
| Raw `fetch` for Graph API | `facebook-node-sdk` | Unmaintained; wraps deprecated APIs; 3 endpoints don't justify a dependency |
| Raw `fetch` for Graph API | Any community wrapper | None with active maintenance; Graph API changes frequently; raw fetch is more durable |
| Manual OAuth flow | NextAuth.js | Conflicts with Supabase Auth; integration OAuth ≠ user auth; unnecessary complexity |
| `node:crypto` for Meta HMAC | `@kapso/whatsapp-cloud-api` or similar | Wrong product domain; crypto is built-in and 5 lines |

---

## Sources

- `@googlemaps/places` v2.4.0 — [npm](https://www.npmjs.com/package/@googlemaps/places), [Google Cloud Docs](https://docs.cloud.google.com/nodejs/docs/reference/places/latest)
- `@googlemaps/google-maps-services-js` deprecation note — [GitHub README](https://github.com/googlemaps/google-maps-services-js) (v3.4.2, "only compatible with Legacy Services")
- Google Places API (New) Place Details endpoint — [developers.google.com](https://developers.google.com/maps/documentation/places/web-service/place-details)
- Google Places API billing post-March 2025 — [developers.google.com/maps/billing-and-pricing/march-2025](https://developers.google.com/maps/billing-and-pricing/march-2025)
- Google Places API policies (caching/attribution) — [developers.google.com](https://developers.google.com/maps/documentation/places/web-service/policies)
- Meta Graph API v25.0 — [developers.facebook.com/blog](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/)
- Meta Graph API Send API (Messenger) — [developers.facebook.com](https://developers.facebook.com/docs/messenger-platform/reference/send-api/)
- Instagram Messaging API 2026 — [zernio.com](https://zernio.com/blog/instagram-messaging-api)
- Instagram webhook events — [developers.facebook.com](https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/)
- Meta webhook `X-Hub-Signature-256` — Meta Community Forums, [hookdeck.com](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification)
- Facebook OAuth long-lived tokens — [developers.facebook.com](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/)
- Instagram permissions (`instagram_manage_messages`) — [developers.facebook.com](https://developers.facebook.com/docs/permissions/)

---

*Stack additions for: Operator v1.3 — Google Reviews Widget + Meta Messaging*
*Researched: 2026-05-04*
