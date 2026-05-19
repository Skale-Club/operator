---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Unified Calls Hub + Pipeline UX
status: in_progress
last_updated: "2026-05-19T00:00:00.000Z"
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 14
  completed_plans: 0
---

# Xphere - State (v2.7 Unified Calls Hub + Pipeline UX)

## Current Position

Phase: 85 — UNIFIED-CALLS-DB
Plan: not started
Next: Plan and execute phase 85
Status: 0/8 phases complete

## Milestone Progress

- v2.6 Admin Landing SEO: ✅ Shipped 2026-05-19
- v2.7 Unified Calls Hub + Pipeline UX: 🔄 In Progress

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| VIEW-based unification (no materialized table) | DB handles RLS automatically via SECURITY INVOKER | Pending |
| call_type discriminator column ('ai' \| 'human') | Clean filter without JOIN complexity | Pending |
| OpportunityDetailSheet over new route | Consistent with ContactDetailSheet pattern | Pending |
| DnD activationConstraint distance+delay combo | Eliminates accidental drags while preserving responsiveness | Pending |

## Decisions Log

- Seeds SEED-014 and SEED-015 promoted to v2.7 milestone on 2026-05-19

## Blockers / Concerns

None

## Accumulated Context

- SEED-014 provides full decomposition: 6 phases (C1–C6) → mapped to phases 85–90
- SEED-015 provides full bug list: B1–B6 → mapped to phases 91–92
- Existing `/phone` and `/voice` routes must remain functional until phase 90 cleanup
- `call_logs` table is for Human/Twilio calls; `calls` table is for AI/Vapi calls
