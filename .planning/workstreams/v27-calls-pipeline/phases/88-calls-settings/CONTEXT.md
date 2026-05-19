# Phase 88: Calls Settings - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Pre-implemented (merged from claude branch before v2.7 milestone creation)

<domain>
Delivers `/calls/settings` page consolidating call routing modes (phone forward, SIP, browser), dialer configuration, and Twilio configuration banners into a single settings sub-route accessible via the Calls tab nav.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices already made — phase was built prior to milestone formalization.

- Page fetches `getCurrentCallSettings()`, `getSipDomain()`, and `getTwilioIntegration()` in parallel
- Conditional warning banners shown when routing mode is browser/SIP but Twilio is not configured
- `CallSettingsForm` receives initial settings and sipDomain as props; handles its own mutations
- Banner links directly to `/integrations/twilio` for Twilio config
- `export const dynamic = 'force-dynamic'` to ensure fresh settings on each request
</decisions>

<specifics>
Key files implementing this phase:
- `src/app/(dashboard)/calls/(tabs)/settings/page.tsx` — settings page with routing mode display, Twilio banners, and CallSettingsForm
</specifics>

<deferred>
None
</deferred>
