# Phase 87: Calls Sub-Routes - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Pre-implemented (merged from claude branch before v2.7 milestone creation)

<domain>
Delivers `/calls/campaigns` and `/calls/assistants` sub-routes that reuse existing campaign and assistant mapping logic previously found under the `/phone` tabs.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices already made — phase was built prior to milestone formalization.

- `/calls/campaigns` delegates to `getCampaigns()` + `CampaignList` component (same as the outbound campaigns flow)
- `/calls/assistants` queries `assistant_mappings` table directly and renders `AssistantMappingsTable`
- Both pages are server components within the `(tabs)` route group, inheriting the layout with tabs nav
</decisions>

<specifics>
Key files implementing this phase:
- `src/app/(dashboard)/calls/(tabs)/campaigns/page.tsx` — fetches campaigns via `getCampaigns()`, renders `CampaignList`
- `src/app/(dashboard)/calls/(tabs)/assistants/page.tsx` — queries `assistant_mappings`, renders `AssistantMappingsTable`
</specifics>

<deferred>
None
</deferred>
