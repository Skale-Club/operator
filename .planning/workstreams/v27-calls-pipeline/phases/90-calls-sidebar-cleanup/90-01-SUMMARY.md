---
plan: 90-01
status: complete
completed_at: "2026-05-19"
requirements_satisfied: [CALL-09, CALL-10]
---

# Summary: 90-01 — Calls Sidebar Cleanup

## What was done

Pre-implemented sidebar consolidation replacing old Phone/Voice nav items with a single `{ icon: Phone, label: 'Calls', href: '/calls' }` entry in the `navItems` array of `app-sidebar.tsx`. The `/phone` page performs a tab-aware server redirect: `?tab=campaigns` routes to `/calls/campaigns`, `?tab=assistants` routes to `/calls/assistants`, and all other variants redirect to `/calls`. The `/voice` page performs a simple `redirect('/calls')`. Webhook routes (`/api/twilio/*`, `/api/vapi/*`) were left untouched.

## Key files

- `src/components/layout/app-sidebar.tsx` — single Calls nav item with Phone icon
- `src/app/(dashboard)/phone/page.tsx` — tab-aware redirect preserving deep links
- `src/app/(dashboard)/voice/page.tsx` — simple redirect to /calls

## Deviations from Plan

None - implementation pre-existed and was confirmed correct.
