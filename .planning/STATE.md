---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Google Reviews Widget + Meta Messaging
status: Planning
last_updated: "2026-05-04T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Operator - State

## Current Position

Milestone: v1.3 Google Reviews Widget + Meta Messaging
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-04 — Milestone v1.3 started

## Progress

- v1.0 MVP: ✅ Shipped 2026-04-03
- v1.1 Knowledge Base: ✅ Shipped 2026-04-03
- v1.2 Operator + Embedded Chatbot: ✅ Shipped 2026-04-05
- v1.3: 🔲 In planning

## Project Reference

See `.planning/PROJECT.md` (updated 2026-05-04)

**Core value:** The Action Engine must work reliably for every tenant
**App name:** Operator
**Production origin:** https://operator.skale.club
**Current focus:** v1.3 — Google Reviews Widget + Meta Messaging

## Accumulated Context

- v1.0 shipped 2026-04-03 — 6 phases, 30 plans, full MVP
- v1.1 shipped 2026-04-03 — LangChain vector pipeline, schema migration 010
- v1.2 shipped 2026-04-05 — Operator brand, embeddable widget, chat inbox; 6 phases, 21 plans
- Active known tech debt: no HMAC validation on Vapi webhooks, campaign calls don't appear in Observability, send_sms/custom_webhook are stubs
- v1.2 chat inbox: conversations/conversation_messages tables; AdminChatLayout/ConversationList/ChatArea components; bot_status per conversation
- Module 2 must extend existing chat inbox — NOT create a new one
- Conversations table has `channel` column to be extended: "widget" | "instagram" | "messenger"
