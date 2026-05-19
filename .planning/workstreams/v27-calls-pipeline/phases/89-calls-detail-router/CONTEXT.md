# Phase 89: Calls Detail Router - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Pre-implemented (merged from claude branch before v2.7 milestone creation)

<domain>
Delivers the `/calls/[id]` detail page that detects whether a call is AI (Vapi) or Human (Twilio) via `call_type` and renders the appropriate variant: `CallDetailAi` (transcript, summary, cost, assistant info) or `CallDetailHuman` (recording player, notes, contact link). A shared visual shell (PageHeader + avatar + metadata) is used for both variants.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices already made — phase was built prior to milestone formalization.

- `getUnifiedCall(id)` called server-side; `notFound()` returned on null
- Shared header shows caller name with avatar, direction icon, and phone number
- `CallDetailAi` is a server async component — fetches full Vapi call row and action logs, uses `buildTimeline()` for merged transcript+actions
- `CallDetailHuman` is a server async component — fetches full `call_logs` row for ended_at; shows `CallWaveformPlayer` + `CallNotesEditor` + contact card
- Both variants use a 3-column grid layout (2 wide + 1 narrow sidebar)
</decisions>

<specifics>
Key files implementing this phase:
- `src/app/(dashboard)/calls/[id]/page.tsx` — detail router page with shared shell and type-based branching
- `src/components/calls/call-detail-ai.tsx` — AI variant: transcript via buildTimeline, summary, cost, assistant ID, Vapi ID
- `src/components/calls/call-detail-human.tsx` — Human variant: recording player, notes editor, call_logs ended_at, contact link
</specifics>

<deferred>
None
</deferred>
