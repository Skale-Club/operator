---
gsd_state_version: 1.0
milestone: null
milestone_name: null
status: Between milestones
last_updated: "2026-04-19T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Operator — State

## Current Position

No active milestone. v1.2 archived 2026-04-19.

Next step: `/gsd:new-milestone` to scope v1.3.

## Progress

- v1.0 MVP: ✅ Shipped 2026-04-03
- v1.1 Knowledge Base: ✅ Shipped 2026-04-03
- v1.2 Operator + Embedded Chatbot: ✅ Shipped 2026-04-05, archived 2026-04-19

## Project Reference

See `.planning/PROJECT.md` (updated 2026-04-19 after v1.2 archival)

**Core value:** The Action Engine must work reliably for every tenant
**App name:** Operator
**Canonical origin:** `https://operator.skale.club`

## Accumulated Context

Shipped milestones are archived in `.planning/milestones/`. See `.planning/MILESTONES.md` for the summary index.

Active known tech debt carried into v1.3+:
- No HMAC validation on Vapi webhooks (v1.0 carry-over)
- `send_sms` / `custom_webhook` are stubs (v1.0 carry-over)
- Campaign calls don't auto-appear in Observability (v1.0 carry-over)
- No widget analytics, visitor identity, human-agent handoff, or widget i18n (v1.2 deferred)
