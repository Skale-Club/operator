---
plan: 87-01
status: complete
completed_at: "2026-05-19"
requirements_satisfied: [CALL-05]
---

# Summary: 87-01 — Calls Sub-Routes

## What was done

Pre-implemented `/calls/campaigns` and `/calls/assistants` sub-routes within the `(tabs)` route group, inheriting the layout with tabs nav. The campaigns page is a thin server component delegating to `getCampaigns()` from the outbound actions module and rendering `CampaignList`. The assistants page queries the `assistant_mappings` Supabase table directly and renders `AssistantMappingsTable`, typed via the Database type.

## Key files

- `src/app/(dashboard)/calls/(tabs)/campaigns/page.tsx` — delegates to getCampaigns() + CampaignList
- `src/app/(dashboard)/calls/(tabs)/assistants/page.tsx` — queries assistant_mappings + AssistantMappingsTable

## Deviations from Plan

None - implementation pre-existed and was confirmed correct.
