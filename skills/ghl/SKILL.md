---
name: ghl
description: Use when working with GoHighLevel integrations, including contact creation, calendar availability lookup, appointment booking, location-scoped credentials, or implementing and testing GHL actions inside VoiceOps. Prefer this skill whenever GHL API behavior, endpoints, or VoiceOps GHL executor patterns are involved.
---

# GHL

Use GoHighLevel through the patterns already established in VoiceOps.

## Quick Start

- Use GHL API v2 base URL `https://services.leadconnectorhq.com`.
- Send the `Authorization: Bearer <token>` header with the private integration token.
- Send the `Version: 2021-07-28` header.
- Treat `locationId` as required context for tenant-scoped operations in VoiceOps.
- Keep Action Engine responses short and single-line when they are returned back to Vapi.

## VoiceOps Patterns

The current project already supports these GHL-backed action types:

- `create_contact`
- `get_availability`
- `create_appointment`

Relevant implementation files:

- `src/lib/ghl/client.ts`
- `src/lib/ghl/create-contact.ts`
- `src/lib/ghl/get-availability.ts`
- `src/lib/ghl/create-appointment.ts`

Reuse those patterns before inventing a new integration shape.

## Workflow

1. Confirm whether the task is about contacts, availability, or appointments.
2. Use the GHL v2 base URL and required headers.
3. Preserve the VoiceOps credential model:
   - API key is stored encrypted per organization.
   - `locationId` comes from the integration record.
4. Match the existing response style for Vapi-facing executions:
   - concise
   - single line
   - no unnecessary formatting
5. If adding a new executor, keep it compatible with the Action Engine latency and error-handling model.

## Current Endpoints Used In VoiceOps

| Operation | Method | Path |
|-----------|--------|------|
| Create contact | POST | `/contacts/` |
| Get free slots | GET | `/calendars/{calendarId}/free-slots` |
| Create appointment | POST | `/calendars/events/appointments` |

## Current Request Shapes

### Create contact

```json
{
  "locationId": "<ghl-location-id>",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+15551234567",
  "email": "jane@example.com"
}
```

### Get availability

Query params:

```text
startDate=2026-04-10
endDate=2026-04-11
timezone=America/New_York
```

### Create appointment

```json
{
  "calendarId": "<calendar-id>",
  "contactId": "<contact-id>",
  "startTime": "2026-04-10T09:00:00Z",
  "endTime": "2026-04-10T09:30:00Z",
  "title": "Appointment",
  "appointmentStatus": "confirmed"
}
```

## Notes

- In this repo, GHL calls run through a hard timeout budget in `src/lib/ghl/client.ts` to protect the Vapi hot path.
- Prefer `https://services.leadconnectorhq.com` over the legacy `rest.gohighlevel.com` host.
- Do not log plaintext GHL tokens.
- If the task is a client-specific workflow built on GHL, model it as tenant-specific orchestration on top of VoiceOps primitives rather than as a universal product flow.
