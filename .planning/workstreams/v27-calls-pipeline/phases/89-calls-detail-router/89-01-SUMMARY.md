---
plan: 89-01
status: complete
completed_at: "2026-05-19"
requirements_satisfied: [CALL-07, CALL-08]
---

# Summary: 89-01 — Calls Detail Router

## What was done

Pre-implemented `/calls/[id]` detail page with a shared visual shell and type-based rendering. The page server component fetches the unified call via `getUnifiedCall(id)`, returns `notFound()` on null, and renders a shared PageHeader with caller avatar, direction icon (PhoneIncoming/PhoneOutgoing), and counterpart number. Based on `call.call_type`, it delegates to `CallDetailAi` or `CallDetailHuman`.

`CallDetailAi` is a server component that fetches the full Vapi call row from the `calls` table plus action logs, builds a merged transcript timeline via `buildTimeline()`, and renders summary/transcript in the main column with a metadata sidebar (type, duration, cost, assistant ID, Vapi ID, ended reason, started/ended timestamps).

`CallDetailHuman` is a server component that fetches the `call_logs` row for the ended_at timestamp, renders `CallWaveformPlayer` with the recording URL, `CallNotesEditor` for editable notes, and a contact link card in the sidebar.

## Key files

- `src/app/(dashboard)/calls/[id]/page.tsx` — shared shell, type detection, branching
- `src/components/calls/call-detail-ai.tsx` — AI variant: transcript, summary, cost, assistant metadata
- `src/components/calls/call-detail-human.tsx` — Human variant: waveform player, notes editor, contact card

## Deviations from Plan

None - implementation pre-existed and was confirmed correct.
