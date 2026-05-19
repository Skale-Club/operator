# Phase 76: DB-FOUNDATION - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Create the Supabase database schema for the v2.5 Tasks & Notes CRM system. Two migrations:
- Migration 067: `tasks` table + `task_priority` + `task_status` + `crm_entity_type` enums + RLS policies
- Migration 068: `notes` table + RLS policies + TypeScript types updated in src/types/database.ts

No UI, no server actions — purely DB + types. All downstream phases (77–81) depend on this.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from STATE.md:
- Next migration number: 067
- Shared `crm_entity_type` enum (contact/account/opportunity) used by both tasks and notes
- `task_priority` enum: low/medium/high/urgent
- `task_status` enum: todo/in_progress/done/cancelled
- Both tables need `org_id UUID NOT NULL` + RLS policies using `get_current_org_id()`
- `assigned_to` (tasks) and `created_by` (both) reference `auth.users.id` — nullable
- Polymorphic association: `entity_type crm_entity_type`, `entity_id UUID` — both nullable (task/note can be unlinked)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/064_accounts.sql` — reference for RLS policy pattern with `get_current_org_id()`
- `supabase/migrations/065_custom_field_definitions.sql` — reference for ENUM type creation
- `src/types/database.ts` — updated manually after each migration

### Established Patterns
- RLS pattern: `USING (org_id = get_current_org_id())` for SELECT/UPDATE/DELETE, `WITH CHECK (org_id = get_current_org_id())` for INSERT
- Timestamp: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()` + trigger for auto-update
- UUID primary key: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- Enum creation: `CREATE TYPE enum_name AS ENUM ('val1', 'val2')`

### Integration Points
- `src/types/database.ts` — Tables.tasks.Row, Tables.notes.Row must be added
- `supabase/migrations/` — next file is `067_*.sql`

</code_context>

<specifics>
## Specific Ideas

- Put tasks + enums in migration 067, notes in migration 068 (cleaner separation)
- Or combine both into 067 (simpler, fewer files) — Claude's call
- `notes.pinned` is boolean, default false
- `tasks.description` is TEXT nullable
- `notes.title` is TEXT nullable (content is the required field)
- `notes.content` is TEXT NOT NULL

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped. Infrastructure phase.

</deferred>
