---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Chat System Refactor
status: executing
stopped_at: defining requirements
last_updated: "2026-05-05T03:00:00.000Z"
last_activity: 2026-05-05
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Operator - State

## Current Position

Milestone: v1.4 Chat System Refactor
Phase: 14
Plan: Not started
Status: defining requirements
Last activity: 2026-05-05
Stopped at: defining requirements

## Progress Bar

```
v1.4: [ ][ ][ ][ ][ ]  0/5 phases complete
```

## Milestone Progress

- v1.0 MVP: ✅ Shipped 2026-04-03
- v1.1 Knowledge Base: ✅ Shipped 2026-04-03
- v1.2 Operator + Embedded Chatbot: ✅ Shipped 2026-04-05
- v1.3 Google Reviews Widget + Meta Messaging: ✅ Shipped 2026-05-05
- v1.4: 🚧 In progress — Phase 14 next

## Project Reference

See `.planning/PROJECT.md` (updated 2026-05-05)

**Core value:** The Action Engine must work reliably for every tenant
**App name:** Operator
**Production origin:** https://operator.skale.club
**Current focus:** Phase 14 — TESTFIX (restore green test baseline before refactor)

## Phase Map (v1.4)

| Phase | Name | Status |
|-------|------|--------|
| 14 | TESTFIX | Not started |
| 15 | REFACTOR | Not started |
| 16 | BOUNDARY | Not started |
| 17 | REALTIME | Not started |
| 18 | SEARCH | Not started |

## Accumulated Context

- v1.0 shipped 2026-04-03 — 6 phases, 30 plans, full MVP
- v1.1 shipped 2026-04-03 — LangChain vector pipeline, schema migration 010
- v1.2 shipped 2026-04-05 — Operator brand, embeddable widget, chat inbox; 6 phases, 21 plans
- v1.3 shipped 2026-05-05 — Google Reviews Widget + Meta Messaging; 7 phases (7–13), 18 plans
- v1.4 milestone scope: refactor + UX polish only — no schema migrations, no widget bundle changes
- `src/lib/chat/stream.ts` is currently 480 lines (SSE + OpenAI/Anthropic providers + RAG + tool dispatch all in one file)
- `src/components/chat/chat-area.tsx` is currently 408 lines (header + message list + 24h banner + composer)
- Two known broken tests at milestone start: `tests/chat-persist.test.ts` (2 failing — schema renames) and `tests/action-engine.test.ts` ACTN-02
- `chat_sessions` table exists in code (`src/lib/chat/session.ts` references it via Redis context type) but production writes go to `conversations`/`conversation_messages` — boundary is unclear and warrants documentation
- Active known tech debt unchanged from v1.3: no HMAC validation on Vapi webhooks, campaign calls don't appear in Observability, send_sms/custom_webhook are stubs

## Key Decisions

| Decision | Status |
|----------|--------|
| Phase 14 (TESTFIX) runs first so subsequent phases verify on a green baseline | Decided |
| Phase 16 (BOUNDARY) is doc-only and may execute in parallel with Phases 15/17 | Decided |
| Refactor preserves public API — `createChatStream` signature and `ChatArea` props remain unchanged | Decided |
| No schema migrations in v1.4 — refactor must work with the current `conversations`/`conversation_messages` schema | Decided |
| Conversation search is client-side over loaded conversations (server-side tsvector deferred) | Decided |

## Blockers

- 2 failing tests in `tests/chat-persist.test.ts` and 1 in `tests/action-engine.test.ts` (ACTN-02) — handled by Phase 14
- Realtime in Phase 17 depends on RLS policies already covering `conversations` and `conversation_messages` for SELECT; verify before subscription wiring

## Latest Completed Work

- v1.3 shipped 2026-05-05 — Phase 13 (Outbound Reply Routing) completed; full Meta Messaging + Reviews milestone delivered
- v1.4 roadmap created 2026-05-05 — 5 phases (14–18), 15 requirements mapped 100% to phases
