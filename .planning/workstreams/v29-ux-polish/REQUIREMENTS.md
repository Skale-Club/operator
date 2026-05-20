# Requirements: v2.9 UX Polish & Feature Completeness

## Workflows Unification (Phase 102)

| ID | Requirement |
|----|-------------|
| FLOW-01 | Single "Workflows" entry in sidebar — remove separate Automations + Flows items |
| FLOW-02 | Unified `/workflows` route showing both automation tools and visual flows |
| FLOW-03 | All existing automation tool configs preserved and functional |
| FLOW-04 | All existing visual flows preserved and functional — no data loss |
| FLOW-05 | Folders, logs, run history, integrations all accessible in unified view |

## Notifications (Phase 103)

| ID | Requirement |
|----|-------------|
| NOTIF-01 | Notifications table in Supabase, per-org, per-user, with RLS |
| NOTIF-02 | Bell icon in header shows live unread count badge |
| NOTIF-03 | Dropdown popover panel with notification list |
| NOTIF-04 | Event types: new_conversation, missed_call, flow_failed |
| NOTIF-05 | Mark as read (individual + mark all), 30-day history |

## Light Theme (Phase 104)

| ID | Requirement |
|----|-------------|
| THEME-01 | Remove forcedTheme="dark" — use system preference as default |
| THEME-02 | Light CSS variables defined in globals.css |
| THEME-03 | Theme toggle persists via localStorage, no flash on load |
