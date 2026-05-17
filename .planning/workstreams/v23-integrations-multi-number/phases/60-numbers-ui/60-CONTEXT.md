# Phase 60: NUMBERS-UI - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-number CRUD UI inside `/integrations/twilio`. Operators can add, edit, soft-delete, and set-default per-org Twilio phone numbers, all without leaving the page.

Out of scope: the visual unification work (extracting SectionCard, migrating Google Reviews). That's Phase 62. This phase keeps SectionCard internal to twilio-settings.tsx for now.

</domain>

<decisions>
## Implementation Decisions

### Component shape

- `src/components/integrations/twilio-phone-numbers.tsx` — client component, renders the list + dialog. Receives `initial: TwilioPhoneNumberRow[]` from server and manages its own state.
- Uses the existing `numbers-actions.ts` server actions for all mutations.
- Optimistic UI: after a mutation succeeds, update local state immediately + call `router.refresh()` so server-side data resyncs.

### List row layout

Each row shows:
- Friendly name (primary, text-[14px] font-semibold)
- E.164 (font-mono text-[12.5px] text-text-secondary)
- Capability badges (SMS/MMS/Voice, only shown when enabled)
- "Default" pill (StatusPill tone="success") when `is_default=true`
- Kebab menu (DropdownMenu): Set default / Edit / Delete

### Dialog (create + edit)

- Modal Dialog (not Sheet) — denser, more form-shaped
- Fields in this order:
  1. Friendly name (required, max 64)
  2. Phone number E.164 (required, mono, regex hint)
  3. Phone SID (optional, mono, "PN..." pattern hint)
  4. Capabilities — three checkboxes inline (SMS / MMS / Voice)
  5. Routing mode (Select: None / Browser dialer / SIP / Forward to number)
  6. Forward target (conditional, shown only when routing = Forward)
  7. Set as default (Switch)
  8. Notes (Textarea, optional)
- Footer: Cancel + Save buttons
- Client-side validation: required fields, E.164 regex, at-least-one capability, forward requires forward_to_number
- Server validation (Zod) provides the safety net + clear error toast on failure

### Section reorganization in twilio-settings.tsx

New section order:
1. Connection status (existing top summary card — unchanged)
2. SMS & account basics (existing — but remove the "From number" field; webhook URL stays)
3. **Phone numbers (NEW)** — embeds `<TwilioPhoneNumbers />` here
4. Voice SDK (existing — unchanged)
5. SIP (existing — unchanged)

The "Test SMS" row at the bottom of the SMS & account basics section moves into Phase 60's TwilioPhoneNumbers component since it's now per-number (need a From picker if multiple numbers exist).

Actually — to keep scope minimal: leave the test SMS row in the SMS section but make it use the default number (no per-number picker in this phase). A per-number test from inside the dialog can be a later enhancement.

### Tone / typography

Match the canonical dedicated-page voice already in twilio-settings.tsx:
- Section headers: `text-[15px] font-medium`
- Body: `text-[12.5px]`
- Hints: `text-[11.5px] text-text-tertiary`
- Buttons / pills: existing shadcn defaults

</decisions>

<code_context>
## Existing Code Insights

### Reusable
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/dialog`
- `DropdownMenu` from `@/components/ui/dropdown-menu` (example in `src/components/chat/conversation-list.tsx`)
- `Checkbox` from `@/components/ui/checkbox`, `Switch` from `@/components/ui/switch`, `Select*` from `@/components/ui/select`, `Textarea` from `@/components/ui/textarea`
- `Button`, `Input`, `Label` standard usage
- `StatusPill` from `@/components/design-system/status-pill` — used heavily in twilio-settings.tsx
- `EmptyState` from `@/components/empty-states/empty-state` — canonical empty-state primitive
- `toast` from `sonner` for success/error feedback
- `useRouter` from `next/navigation` for `router.refresh()`

### Server actions (Phase 59)
- `listTwilioNumbers`, `createTwilioNumber`, `updateTwilioNumber`, `softDeleteTwilioNumber`, `setDefaultTwilioNumber` from `@/app/(dashboard)/integrations/twilio/numbers-actions`

</code_context>

<specifics>
## Specific Ideas

- The "From number" field in the existing twilio-settings.tsx SMS section is removed (lines 163-170 of the file as of Phase 59). Replace with a placeholder text directing operators to the Phone numbers section below.
- Empty state copy: "No phone numbers yet" / "Add your Twilio number to start sending SMS and receiving calls"
- Default pill copy: "Default" (not "Default ✓" — the pill itself communicates state)
- Delete confirmation: use a simple `confirm()` for now (matches existing patterns); avoid building a full AlertDialog flow

</specifics>

<deferred>
## Deferred Ideas

- Per-number "Send test SMS" button inside the dialog → enhancement; this phase keeps the test row at the section level
- Inline edit (double-click on friendly name to rename) → not in scope
- Drag-to-reorder → not in scope (alpha ordering by friendly_name is fine)
- Bulk import → not in scope

</deferred>
