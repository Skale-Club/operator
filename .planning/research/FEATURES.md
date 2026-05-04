# Feature Landscape: v1.3 — Google Reviews Widget + Meta Messaging

**Domain:** Agency SaaS platform modules — embeddable review display + messaging channel integration
**Researched:** 2026-05-04
**Milestone context:** Subsequent milestone added to existing platform (v1.2 shipped). Existing
primitives available for reuse: esbuild widget pipeline, multi-tenant RLS, action engine
(executeAction), chat inbox (conversations/conversation_messages), per-org tokens, AES-256-GCM
credential storage.

---

## Module 1: Google Reviews Widget

### API Reality Check (read this first)

**Places API (New) — v1. Confidence: HIGH (verified against official REST reference and billing docs)**

Endpoint: `GET https://places.googleapis.com/v1/places/{placeId}?fields=reviews,...`

**Hard limit: 5 reviews per request.** This is an API-level ceiling with no pagination and no
workaround within the official Places API. Google's relevance algorithm selects which 5 reviews
to return — the caller has no control over ordering or selection. The project goal of "capture up
to 5 reviews" maps exactly to what the API delivers.

**Review object fields (from official REST reference `/v1/places`):**

| Field | Type | Notes |
|-------|------|-------|
| `rating` | number | 1.0–5.0 |
| `text` | LocalizedText | Review body (`text` + `languageCode`) |
| `originalText` | LocalizedText | Review in original language when translated |
| `authorAttribution.displayName` | string | Reviewer name — **mandatory to display per ToS** |
| `authorAttribution.uri` | string | Link to reviewer Google profile — recommended to display |
| `authorAttribution.photoUri` | string | Profile photo URL — available; recommended to display |
| `publishTime` | timestamp | ISO 8601 |
| `relativePublishTimeDescription` | string | Human-readable, e.g. "3 months ago" |
| `visitDate` | Date | Optional; often absent |
| `googleMapsUri` | string | Deep link to this review on Google Maps |
| `flagContentUri` | string | Link to report the review |
| `name` | string | API resource identifier (not display name) |

Author photos are available via `photoUri` but not always populated. Fallback to initials or
generic icon is required.

**Billing — Place Details Enterprise + Atmosphere SKU (HIGH confidence, verified against pricing table):**

| Monthly events | Price per 1,000 |
|---------------|-----------------|
| 0–1,000 | Free |
| 1,001–100,000 | $25.00 |
| 100,001–500,000 | $20.00 |
| 500,001–1,000,000 | $15.00 |

Requesting the `reviews` field (or `reviewSummary`, or atmosphere fields like seating/dining options)
triggers the Enterprise + Atmosphere SKU — the most expensive Place Details tier. Each call to the
Place Details endpoint = 1 billable event, regardless of how many reviews are returned.

With 10 registered locations refreshed daily: ~300 events/month — well within the 1,000/month
free cap. With 50+ locations or high-frequency refreshes, cost becomes a factor.

For the overall rating and review count (`rating`, `userRatingCount`), these are in the Basic or
Pro SKU tier — significantly cheaper. Fetching these separately from review text is not practical
but worth knowing.

**Caching and storage policy — CRITICAL COMPLIANCE RISK (MEDIUM confidence):**

Google Maps Platform Terms explicitly prohibit pre-fetching, caching, or storing Places API content
beyond narrow exceptions. The confirmed exceptions are: place IDs (indefinitely) and lat/lng
coordinates (up to 30 days). No explicit exception was found for review text, author names, ratings,
or photos.

The project plan calls for "store in DB" — this likely means a **time-bounded cache**, not durable
storage. Framing DB rows as an ephemeral cache (with `last_fetched_at`, a TTL, and a refresh
mechanism) is the practical implementation path. Do not design the schema as if reviews are a
first-class system of record; design it as a cache that becomes stale.

Attribution is mandatory: author name in close proximity to review text is required by Google
policy. Author photo and profile link are recommended. Showing how reviews are sorted (by relevance,
which is all the API supports) is also documented guidance.

**Getting more than 5 reviews — not feasible in v1.3:**
The Google Business Profile (GBP) API can return paginated review sets (up to 50/page). However
it requires a formal written + video application, 2–4 week approval, and only works for locations
the authenticated user owns or manages. Out of scope for this milestone.

---

### Table Stakes

Features users expect from a "Google Reviews widget." Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Display up to 5 reviews per location | This is all the API provides; every review widget shows the top reviews | Low | Hard API ceiling; set expectation in UI copy |
| Star rating, review text, author name, relative date | Minimum viable review card | Low | All available in API response; attribution is ToS-required |
| Author profile photo | Every Google review widget shows this | Low | `photoUri` is available; requires fallback for missing photos |
| Overall place rating + review count | Users expect aggregate alongside individual reviews | Low | `rating` + `userRatingCount` on Place Details (cheaper SKU) |
| 4 embed layouts: carousel, grid, list, compact | Widget must fit different site contexts | Medium | Reuses esbuild pipeline from existing chat widget |
| Embeddable via single `<script>` tag (no framework dependency) | Existing platform pattern | Medium | Directly reusable: public token, esbuild, Shadow DOM isolation |
| Per-location admin registration (search by name → resolve Place ID) | Admin must register a location before the widget works | Medium | Text Search (New) endpoint + confirmation step + store `place_id` |
| Unique embed token per location | Platform pattern — matches chat widget model | Low | Same per-org token approach, scoped to a `locations` table row |
| Admin embed code generation page | Agency needs a copy-paste installation snippet | Low | Follows existing widget config page pattern (`/dashboard/widget`) |
| Org-scoped location management | Multi-tenant: each org manages its own locations | Low | Standard RLS on a new `locations` table |
| Attribution display: author name adjacent to review | Required by Google ToS — non-optional | Low | Enforce in widget template; this is not a configurable option |

### Differentiators

Features not universally expected but that add meaningful value for agencies.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual customization (brand color, card background, font size) | Agencies embed on client sites — must match brand | Medium | CSS custom properties injected via Shadow DOM |
| Layout preview in admin before embed | Reduces install-then-fix iteration | Medium | Server-rendered preview card in dashboard |
| Manual refresh trigger + "last refreshed" timestamp | Agencies want to know data is current; useful when a new review comes in | Low | Store `last_fetched_at`; add refresh button that re-calls Places API |
| Google logo + "Powered by Google" attribution footer | Required by policy — but well-styled it reads as professional trust signal | Low | Zero extra cost to implement; already required |
| Widget locale setting (display `originalText` vs `text`) | Multi-region agency clients may want reviews in the reviewer's original language | Medium | Toggle between `text` and `originalText` in widget config |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Storing reviews as durable first-class DB records | ToS conflict (no storage exception found for review content) + reviews can be edited or deleted by the author | Model DB row as ephemeral cache with `last_fetched_at` + TTL; refresh on schedule or on-demand |
| Getting more than 5 reviews | GBP API requires 2–4 week formal approval and ownership verification; incompatible with v1.3 scope | Document the 5-review ceiling clearly in admin UI; defer GBP API integration to future milestone |
| New review alerts / notifications | Places API has no webhook for new review events; polling would require frequent API calls | Scheduled low-frequency refresh only; do not promise real-time alerts |
| Review responses (writing replies via API) | Places API does not support writing review responses | Out of scope; requires GBP API (same approval barrier) |
| Filtering or sorting reviews (by date, rating, keyword) | Google returns up to 5 by relevance; the caller cannot sort | Accept API-determined order; do not build sort or filter UI |
| Star rating submission or "Leave a review" with click tracking | Cannot submit ratings via Places API | If needed: link to Google Maps review page only (no tracking needed) |
| SEO structured data (JSON-LD) in widget script | Widget uses Shadow DOM — crawlers cannot see Shadow DOM content | Skip JSON-LD; this is the responsibility of the host site |
| Real-time widget updates via WebSocket/SSE | Reviews change infrequently; live updates add infra complexity with no practical benefit | Static render on load; manual refresh trigger is sufficient |

### Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DB schema for reviews | Designing as a permanent record violates ToS intent | Add `last_fetched_at` + `expires_at`/TTL; write in ADR that this is a cache, not storage |
| Place ID resolution | Text Search returns multiple candidates — admin must confirm the correct one | Build a confirmation step: show name, address, and business photo before saving `place_id` |
| Attribution display | Missing author name adjacent to review text is a ToS violation | Hardcode attribution into widget template; not user-configurable |
| Missing author photo | `photoUri` is not always present | Implement initials fallback in widget renderer |
| Enterprise SKU cost at scale | Each location refresh = 1 billable event at $25/1K beyond 1,000 free/month | Default to manual or infrequent scheduled refresh; document cost model in admin |
| `visitDate` field | Often absent in API responses | Treat as optional display element; do not use as primary date signal |

---

## Module 2: Meta Messaging (Instagram + Facebook Messenger)

### API Reality Check (read this first)

**Architecture note:** The Instagram Messaging API is accessed through the Messenger Platform
infrastructure, not as a standalone API. A Facebook App must be configured, a Facebook Page must
be connected, and an Instagram Business or Creator account must be linked to that Page. There is
no "Instagram-only" path that bypasses Facebook Page setup.

**Confirmed Instagram Messaging webhook events (HIGH confidence — official Meta developer docs):**

| Webhook Field | Trigger |
|--------------|---------|
| `messages` | Incoming DM: text, media, story reply, quick reply, message deletion, unsupported content |
| `message_reactions` | User reacts or unreacts to a message |
| `messaging_postbacks` | User selects an Icebreaker option or Generic Template button |
| `messaging_seen` | Message marked as read by recipient |
| `messaging_referral` | User clicked an ig.me link with referral parameters (existing conversations only) |
| `message_echoes` | Echo of messages sent by the page |
| `messaging_handover` | Conversation control transferred between apps (multi-app handover protocol) |
| `messaging_optins` | User opt-in events |
| `messaging_policy_enforcement` | Policy violation notifications |
| `standby` | Events while another app controls the conversation |
| `response_feedback` | User thumbs up/down feedback |

**"New follower" webhook event: DOES NOT EXIST.**
Instagram deprecated follower list API access in 2018. There is no webhook event for follow
actions. No polling workaround exists through the official API. Any product plan that includes
"new follower" as a trigger must be revised. This is a hard blocker to communicate to stakeholders.

**Facebook Messenger webhook events (HIGH confidence — Messenger Platform reference):**
Messenger supports a superset of the above including:
- `messages` — incoming messages (text + attachments: image, audio, video, file, reel, ig_reel, post, ig_post, appointment_booking)
- `message_deliveries` — delivery receipts
- `message_reads` — read receipts
- `messaging_postbacks` — button clicks
- `message_echoes` — sent message echoes

Note: GIFs and stickers sent by users do NOT trigger webhook events on Instagram Messaging.
Disappearing media has limited webhook support.

**24-hour messaging window (HIGH confidence):**
- After a user's last inbound message, the business has **24 hours** to send any automated or
  human response.
- After 24 hours: automated responses are blocked. Only messages tagged with `HUMAN_AGENT` can
  be sent, and only within a **7-day** window from the last user message.
- After 7 days: no outbound messages of any type until the user messages again.
- This policy applies identically to both Instagram Messaging and Facebook Messenger.
- Sending outside the window results in an API error and repeated violations can trigger policy
  enforcement (account restriction/ban).

**HUMAN_AGENT tag (HIGH confidence):**
- Allows a human agent (not a bot) to respond up to 7 days after the last user message.
- Requires the `human_agent` permission — this requires a separate App Review submission.
- Legitimate use cases: business closed for weekend, issue requiring extended resolution.
- Cannot be applied to automated/bot-generated messages — only human-authored replies.

**Permissions and App Review requirements (HIGH confidence):**

| Permission | Purpose | Access Level | App Review Required? |
|------------|---------|--------------|---------------------|
| `instagram_basic` | Basic IG account read | Standard | No |
| `instagram_manage_messages` | Receive + send DMs (Facebook Login flow) | Advanced | YES — Advanced Access + Business Verification |
| `instagram_business_basic` | IG Business account metadata | Standard | No |
| `instagram_business_manage_messages` | DMs for Instagram Business Login flow | Advanced | YES — Advanced Access + Business Verification |
| `pages_manage_metadata` | Webhook subscription management | Standard | No |
| `pages_show_list` | List user's Pages | Standard | No |
| `pages_messaging` | Core Messenger messaging | Advanced | YES — App Review required |
| `human_agent` | Reply beyond 24h window | Advanced | YES — separate App Review submission |

**Critical App Review constraint for a multi-tenant SaaS:**
Advanced Access is required whenever your app accesses Facebook Pages or Instagram accounts that
are not owned by you (i.e., accounts belonging to your customers). For Operator, this means every
tenant connecting their own Facebook Page or Instagram account requires Advanced Access. App Review
takes weeks and requires: a documented use case, a working screencast of the end-to-end flow,
at least one successful API call from the app, Business Verification of the developer entity, and
a demonstrated human-agent escalation path.

**App Review is a project-phase blocker** — it must be started before the feature can go to production
with real tenant accounts. Development and testing can proceed using Facebook Developer/Tester role
accounts before Advanced Access is granted.

**Token model (HIGH confidence):**

| Token type | Expiry | Notes |
|------------|--------|-------|
| Short-lived User Access Token | ~1 hour | From OAuth callback |
| Long-lived User Access Token | 60 days | Exchanged server-side using app secret |
| Page Access Token (derived from long-lived User token) | Does not expire | Only invalidated on revocation or permission change |
| Instagram User Access Token (Instagram Login path) | 60 days | Refreshable via `/refresh_access_token` (must refresh before expiry) |

The system must track `expires_at` for user tokens and IG tokens, auto-refresh before expiry,
and surface a re-auth prompt to the admin when a token is invalidated or cannot be refreshed.

**Rate limits (MEDIUM confidence — community-reported, not precisely documented officially):**
~200 DMs/hour per Instagram account. Messenger has its own rate limits not precisely documented
for this use case.

---

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Receive inbound Instagram DMs in existing chat inbox | Core value of the integration | High | Webhook + Advanced Access App Review required before production |
| Receive inbound Messenger messages in existing chat inbox | Core value of the integration | High | Webhook + pages_messaging App Review required |
| Admin reply to DMs and Messenger messages from inbox | Without outbound, inbox is read-only and valueless | Medium | POST to Send API; must enforce 24h window before allowing send |
| Meta OAuth connect flow (Facebook Login) | Only supported way to connect a Page/IG account | High | Standard OAuth 2.0 → page selection → IG account link |
| Channel type labels in inbox (instagram / messenger / webchat) | Conversations must be distinguishable; operators need to know which channel to prioritize | Low | Extend existing channel enum; add icons per channel type |
| Inbox filter by channel (instagram, messenger, webchat) | Operators scope their view by channel | Low | Extend existing filter bar |
| Token expiry detection + re-auth prompt | IG tokens expire in 60 days; must not silently fail | Medium | Store `expires_at`; background check; surface warning in dashboard |
| 24h window enforcement on send UI | Sending after window = API error + policy risk | Medium | Track `last_user_message_at`; disable/warn in reply input after 24h |
| Webhook signature verification (X-Hub-Signature-256) | Security baseline; same requirement as Vapi HMAC (currently a known debt) | Low | Verify `X-Hub-Signature-256` on all incoming Meta webhook requests |
| Webhook challenge handshake (GET verification) | Meta sends a GET with `hub.challenge` before delivering events | Low | Implement GET handler alongside POST on the webhook route |
| Org-scoped channel credentials (encrypted) | Multi-tenant: each org has its own Page connection | Medium | New `meta_channels` table; AES-256-GCM on token — same pattern as existing integrations |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automation binding per Meta channel | Core platform differentiator — existing `executeAction()` reused from new trigger source | Medium | Map incoming `messages` event → resolve org + tool config → `executeAction()`; new `meta_automations` config per channel |
| Story reply identification | Story replies arrive as `messages` events — surfacing them distinctly adds context for the agent | Low | Check `message.reply_to.story` in webhook payload; add "story reply" badge in conversation thread |
| `messaging_seen` read receipt display | Shows whether the IG/Messenger user read the reply — adds inbox situational awareness | Low | Update conversation record on `messaging_seen` webhook; show "seen" indicator in UI |
| Human agent mode toggle | Lets admin mark a conversation as human-handled, enabling 7-day window via `HUMAN_AGENT` tag | Medium | Requires `human_agent` App Review; also useful as App Review proof-of-concept |
| Referral source on conversation | `messaging_referral` events reveal which ig.me link or ad drove the message | Low | Store referral data on conversation record; display in conversation detail panel |
| `messaging_postbacks` handling | Allows bot-initiated quick replies / Icebreakers to feed back into automation | Medium | Forward postback payload to action engine as a structured trigger |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| "New follower" automation trigger | DOES NOT EXIST as a webhook event (deprecated 2018) | Remove from any feature plan entirely; communicate this to stakeholders proactively |
| Proactive outbound DMs (broadcast / cold message to users who haven't messaged) | Blocked by 24h window; violates Meta TOS; risk of account ban | Never build; restrict all outbound to replies within the window |
| Message scheduling | No safe path to send at a future time without user re-engagement; 24h window makes pre-scheduling meaningless | Out of scope; focus on real-time response within window |
| Automated replies without 24h window awareness | Bot responds after window → API error + escalating policy enforcement | Enforce window check before every send attempt in the API route |
| WhatsApp integration in this module | Entirely different API (WhatsApp Business API) with separate Business Manager and WABA setup | Separate future milestone if needed |
| Bulk messaging to existing DM threads | Rate-limited (~200/hr) + policy-violating at scale | Out of scope |
| Rich media sending from admin inbox (images, video attachments) | Significant implementation surface area; not required for MVP inbox | Text-only replies in v1.3; defer rich media to future milestone |
| Comment-to-DM automation | Requires `instagram_manage_comments` — additional App Review scope beyond messaging | Separate feature if ever needed; do not bundle into v1.3 |
| Full conversation history import from Meta | Meta does not expose historical conversation data via API — only real-time webhook events populate the inbox | Only conversations started after webhook activation will appear; document this clearly in onboarding |
| Instagram Stories viewing / creation | Completely separate API surface; no relevance to messaging inbox | Out of scope |

### Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| App Review timing | Review takes weeks; without Advanced Access, only developer/tester-role accounts can connect | Start App Review in the first phase of this module; build and test against sandbox accounts during review |
| Advanced Access requirement | Without it, app works only for accounts with a Developer or Tester role on the Meta app | Make this a documented prerequisite in the setup guide; do not promise production readiness before approval |
| Instagram account link requirement | Instagram Business or Creator account must be linked to a Facebook Page — no standalone Instagram API | Validate and surface this as a clear prerequisite in the connect flow UI |
| OAuth token refresh | IG user tokens expire in 60 days; no refresh = silent auth failure on next webhook send | Store `expires_at`; auto-refresh at least 7 days before expiry; invalidate and prompt if refresh fails |
| 24h window enforcement gaps | Missing the check causes real API errors and risks policy enforcement action | Derive and store `last_user_message_at` per conversation; check on every send path including admin manual reply |
| Action engine credential coupling | `executeAction()` currently requires `GhlCredentials` as third argument | Pass nullable/empty credentials for non-GHL actions; the switch statement already handles this via `case` specificity — no rewrite needed, just ensure the call site handles null credentials gracefully |
| Webhook GET challenge | Meta sends a GET verification before starting webhook delivery; missing this blocks all events | Implement `GET` handler on the same webhook route path |
| "New follower" stakeholder expectation | Agency users familiar with ManyChat may expect follower triggers | Document proactively: "Meta webhooks do not include follow events; this is an API-level limitation, not a platform limitation" |
| Human agent escalation for App Review | Meta requires proof of a human escalation path in the app review screencast | Build the "mark as human-handled" toggle early — needed for App Review submission, not just UX |
| Multi-app handover complexity | If another app (e.g., Instagram's native inbox) is also receiving messages, `standby` events fire instead of `messages` | Document that Primary Receiver role must be configured in Meta App settings; `standby` events should be logged but not processed as new messages |

---

## Cross-Module Notes

**Action engine compatibility with Meta events:**
The existing `executeAction()` in `src/lib/action-engine/execute-action.ts` takes
`(actionType, params, credentials, ctx?)`. Triggering it from a Meta webhook event is
architecturally sound. The webhook handler extracts the org, resolves tool config, and calls
`executeAction()` with the existing interface. The only structural gap is that `GhlCredentials`
is currently the third parameter. For actions that do not use GHL (e.g., `knowledge_base`), the
credentials argument can be passed as an empty object — the switch case already handles
`knowledge_base` independently. No action engine rewrite is needed for v1.3.

**Existing widget pattern reuse for reviews widget:**
The esbuild pipeline, public token model, Shadow DOM isolation, and
`GET /api/widget/[token]/config` endpoint pattern from the chat widget are directly applicable.
New work specific to the reviews widget: (1) `locations` table scoped by org, (2) a public
`GET /api/reviews/[token]` endpoint that fetches from Places API and returns the cached/fresh
review data, and (3) the widget JS bundle with 4 layout renderers.

---

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Google Places API review object fields | HIGH | Official REST reference (`/v1/places` schema) |
| Google Places API 5-review hard limit | HIGH | Official docs + multiple secondary sources |
| Google Places API billing (Enterprise + Atmosphere SKU pricing) | HIGH | Official pricing table |
| Google ToS prohibition on caching review content | MEDIUM | Policy docs confirmed general prohibition; specific review carve-out not found |
| Meta Instagram webhook events (full list) | HIGH | Official Meta developer docs |
| "New follower" event non-existence | HIGH | Confirmed absent from official docs; deprecated 2018; Make.com community confirmation |
| Meta 24h messaging window policy | HIGH | Official policy docs + multiple verified secondary sources |
| Meta App Review requirements (Advanced Access) | HIGH | Official App Review docs |
| Meta token types, expiry, and refresh model | HIGH | Official token reference docs |
| Human agent 7-day window + permission requirement | HIGH | Official docs + secondary sources |
| Instagram rate limits (~200 DM/hr) | MEDIUM | Community-reported; not precisely documented officially |

---

## Sources

- [Google Places API REST Reference (v1/places)](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Google Places API Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google Maps Platform Core Services Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Places API Policies and Attributions](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google Maps Platform SKU Details](https://developers.google.com/maps/billing-and-pricing/sku-details)
- [How to Get More than 5 Reviews from Google Places API (Featurable)](https://featurable.com/blog/google-places-more-than-5-reviews)
- [Google Maps Reviews API: Everything You Need to Know (WiserReview)](https://wiserreview.com/blog/google-maps-reviews-api/)
- [Instagram Platform Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/)
- [Webhooks for Instagram Messaging (Messenger Platform)](https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/)
- [Meta App Review — Instagram Platform](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [Instagram Messaging API Overview](https://developers.facebook.com/docs/instagram-messaging/)
- [Meta Access Token Reference](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
- [Meta Messenger Platform Webhook Events Reference](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/)
- [Messenger Platform and IG Messaging API Policy Overview](https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/)
- [Instagram Messaging API 24-Hour Window Policy (KeyAPI)](https://www.keyapi.ai/blog/instagram-messaging-api-policy)
- [Meta Response Window Policy (Vista Social)](https://support.vistasocial.com/hc/en-us/articles/37238898853915-Meta-s-Response-Window-Policy)
- [Human Agent Tag in Instagram/Messenger Channel (Chatwoot)](https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel)
- [Instagram Business "New Follower" Webhook — Make Community Discussion](https://community.make.com/t/instagram-business-module-webhooks-new-follower-event-trigger/16511)
- [Google Maps API Pricing 2026 (Woosmap)](https://www.woosmap.com/blog/google-maps-api-pricing-breakdown)
- [Instagram API Rate Limits (CreatorFlow)](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)
