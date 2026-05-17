---
phase: 60
plan: 01
title: TwilioPhoneNumbers component + section reorg
status: complete
completed: 2026-05-17
---

# Plan 60-01 Summary

## What landed

- `src/components/integrations/twilio-phone-numbers.tsx` (NEW, ~430 LOC)
  - List view: friendly_name + E.164 + capability badges + Default pill + kebab menu (Set default / Edit / Remove)
  - Empty state (EmptyState primitive): "No phone numbers yet" with primary CTA + secondary Twilio console link
  - Dialog (create + edit): friendly_name, e164, phone_sid, three capability checkboxes, default_routing_mode select (None/Browser/SIP/Forward), conditional forward_to_number, is_default switch, notes textarea
  - Client-side validation: E.164 regex, PN regex, at-least-one capability, forward requires forward_to_number
  - Optimistic `setNumbers` + `router.refresh()` after each mutation
  - Soft-delete uses native `confirm()` (matches existing patterns in the codebase)
- `src/components/integrations/twilio-settings.tsx` (refactor)
  - Removed the legacy `from_number` Input + state
  - Embedded `<TwilioPhoneNumbers initial={view.numbers} />` between the SMS section and Voice SDK section
  - Refactored `setView` to compute `smsConfigured`/`voiceConfigured` via `numbers.some(active+capability)`
  - Added `getDefaultE164(view)` helper for `TestSmsRow`'s default destination
  - Updated header comment from "v2.1 (3 sections)" to "v2.3 (5 sections including Phone numbers)"

## Verification

- `npx tsc --noEmit` filtered to non-chat files returns zero errors. All shadcn primitives + server-action imports resolve.
- Section order matches CONTEXT decision: Connection status → SMS & basics → Phone numbers → Voice SDK → SIP
- New component uses canonical primitives (`SectionCard` styling via the section wrapper, `EmptyState`, `StatusPill`, `Button`, `Input`, `Label`, `Checkbox`, `Switch`, `Select`, `Textarea`, `Dialog`, `DropdownMenu`)

## Out of scope

- Index page numbers count badge → Phase 61
- Extracting SectionCard to shared component + visual unification → Phase 62
- Vitest coverage → Phase 63
- Per-number "Send test SMS" from inside the dialog → deferred enhancement (test row at section level uses default number)
