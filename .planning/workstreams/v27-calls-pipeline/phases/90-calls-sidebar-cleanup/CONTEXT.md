# Phase 90: Calls Sidebar Cleanup - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Pre-implemented (merged from claude branch before v2.7 milestone creation)

<domain>
Consolidates the sidebar navigation by replacing the old "Phone" and "Voice" entries with a single "Calls" item pointing to `/calls`, and adds server-side redirects from `/phone` and `/voice` to the new unified hub.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices already made — phase was built prior to milestone formalization.

- Sidebar `navItems` array now contains a single `{ icon: Phone, label: 'Calls', href: '/calls' }` entry (no Phone/Voice entries)
- `/phone` redirect is tab-aware: `?tab=campaigns` → `/calls/campaigns`, `?tab=assistants` → `/calls/assistants`, default → `/calls`
- `/voice` redirect is a simple server-side `redirect('/calls')`
- Webhooks (`/api/twilio/*`, `/api/vapi/*`) were left untouched
</decisions>

<specifics>
Key files implementing this phase:
- `src/components/layout/app-sidebar.tsx` — navItems with single Calls entry, Phone icon from lucide-react
- `src/app/(dashboard)/phone/page.tsx` — tab-aware redirect to /calls, /calls/campaigns, or /calls/assistants
- `src/app/(dashboard)/voice/page.tsx` — simple redirect to /calls
</specifics>

<deferred>
None
</deferred>
