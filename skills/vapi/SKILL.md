---
name: vapi
description: Use when working with the Vapi Voice AI platform, including creating or updating assistants, making outbound calls, listing calls, managing phone numbers, squads, and workflows, or implementing and testing Vapi integrations. Prefer this skill whenever Vapi API requests, endpoint lookup, or Vapi-specific conventions are involved.
---

# Vapi

Use Vapi as the system of record for assistants, calls, phone numbers, squads, and workflows.

## Quick Start

- Use base URL `https://api.vapi.ai`.
- If `http_request` is available, always set `service="vapi"` so auth is injected automatically.
- Look up unfamiliar endpoints in Context7 before implementing.
- Prefer official Vapi endpoints and payloads over guessed shapes.

## Workflow

1. Identify the Vapi resource involved: `assistant`, `call`, `phone-number`, `squad`, or `workflow`.
2. If the endpoint or payload is unfamiliar, query Context7:
   - general docs: `/websites/vapi_ai`
   - API reference: `/websites/vapi_ai_api-reference`
3. Send requests to `https://api.vapi.ai/...`.
4. When using `http_request`, always include `service="vapi"`.
5. Return the important identifiers in your answer, especially assistant IDs, call IDs, phone number IDs, squad IDs, and webhook-relevant fields.

## Core Endpoints

| Resource | Method | Path |
|----------|--------|------|
| Assistants | GET | `/assistant` |
| Assistants | POST | `/assistant` |
| Assistants | PATCH | `/assistant/{id}` |
| Assistants | DELETE | `/assistant/{id}` |
| Calls | GET | `/call` |
| Calls | POST | `/call` |
| Calls | GET | `/call/{id}` |
| Phone Numbers | GET | `/phone-number` |
| Phone Numbers | POST | `/phone-number` |
| Phone Numbers | PATCH | `/phone-number/{id}` |
| Squads | GET | `/squad` |
| Squads | POST | `/squad` |
| Workflows | GET | `/workflow` |

## Common Operations

### List assistants

```json
{
  "method": "GET",
  "url": "https://api.vapi.ai/assistant",
  "service": "vapi"
}
```

### Create outbound call

```json
{
  "method": "POST",
  "url": "https://api.vapi.ai/call",
  "service": "vapi",
  "body": {
    "assistantId": "<assistant-id>",
    "phoneNumberId": "<phone-number-id>",
    "customer": {
      "number": "+15551234567"
    }
  }
}
```

### List calls

```json
{
  "method": "GET",
  "url": "https://api.vapi.ai/call",
  "service": "vapi"
}
```

### List phone numbers

```json
{
  "method": "GET",
  "url": "https://api.vapi.ai/phone-number",
  "service": "vapi"
}
```

## Notes

- Always query Context7 before implementing unfamiliar Vapi endpoints.
- For detailed API reference, use `/websites/vapi_ai_api-reference`.
- Call status values include `queued`, `ringing`, `in-progress`, `forwarding`, and `ended`.
- Pagination on list endpoints commonly uses `?limit=` and `?createdAtGt=` query params.
- When wiring webhooks or server URLs that point back to VoiceOps production, use `https://voiceops.skale.club`.
- When linking a Vapi assistant into VoiceOps, use a human-friendly assistant name as the VoiceOps label. The UUID is for routing only.
- The canonical dashboard URL for a specific assistant is `https://dashboard.vapi.ai/assistants/{assistantId}`.
