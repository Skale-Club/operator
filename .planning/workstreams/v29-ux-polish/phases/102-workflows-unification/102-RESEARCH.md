# Phase 102: WORKFLOWS-UNIFICATION - Research

**Researched:** 2026-05-20
**Domain:** Next.js App Router routing + sidebar nav + React/Zustand canvas state
**Confidence:** HIGH — entire finding is from direct codebase inspection; no external library
research required.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLOW-01 | Single "Workflows" entry in sidebar — remove separate Automations + Flows items | Sidebar nav array is a single flat `nav[]` constant in `sidebar.tsx`; the current `Workflows` entry points to `/automations`. One href change + label verification is all that is needed. |
| FLOW-02 | Unified `/workflows` route showing both automation tools and visual flows | A new `src/app/(dashboard)/workflows/` segment must be created. The existing `/automations` tree must redirect to the new paths. |
| FLOW-03 | All existing automation tool configs preserved and functional | `tool_configs`, `tool_folders`, `action_logs` tables are untouched; only page files and server-action `revalidatePath()` calls move to the new route prefix. |
| FLOW-04 | All existing visual flows preserved and functional — no data loss | `workflows`, `workflow_versions`, `workflow_runs`, `workflow_run_steps`, `workflow_waits` tables are untouched; same story — only route strings change. |
| FLOW-05 | Folders, logs, run history, integrations all accessible in unified view | All sub-pages currently under `/automations/**` must be replicated/moved to `/workflows/**`; no logic changes required. |
</phase_requirements>

---

## Summary

The two systems share no database tables and no client-side store state. They are completely
independent subsystems that happen to be co-located under the `/automations` URL prefix.

**Action Engine (Automations)** manages `tool_configs` + `tool_folders` + `action_logs`. It is
a server-rendered tool registry backed by 15 action types dispatched via `executeAction()`. Its
UI lives at `/automations`, `/automations/logs`, and `/automations/[toolConfigId]`.

**Visual Flows** manages `workflows` + `workflow_versions` + `workflow_runs` +
`workflow_run_steps` + `workflow_waits`. It is a canvas builder backed by ReactFlow + Zustand,
with autosave, run history, and an AI chat builder. Its UI lives at `/automations/flows`,
`/automations/flows/new`, `/automations/flows/[id]`, `/automations/flows/[id]/runs`, and
`/automations/flows/runs/[runId]`.

**The unification task is almost entirely a routing/navigation rename.** No business logic
changes, no DB migrations, no state management changes. The work is:
1. Create a new `src/app/(dashboard)/workflows/` directory tree mirroring the automations tree.
2. Update the sidebar `href` from `/automations` to `/workflows`.
3. Add `redirect()` calls (or Next.js `redirects` config) for old URLs.
4. Update all internal `href` strings, `revalidatePath()` calls, and `back` prop links that
   reference `/automations` to reference `/workflows`.
5. Update the breadcrumb copy and page eyebrow text from "Automations" to "Workflows".

**Primary recommendation:** Move all route segments from `src/app/(dashboard)/automations/` to
`src/app/(dashboard)/workflows/` in place, then add a catch-all redirect at
`/automations` → `/workflows` so any bookmarked or externally-linked URLs keep working.

---

## Project Constraints (from CLAUDE.md)

- `npm run build` must exit 0 — verify after every file move/rename.
- Server components by default; client components use `'use client'`.
- Auth gating with `getUser()` / `createClient()` from `@/lib/supabase/server` — already
  present in all affected pages.
- Toasts use `sonner`.
- `supabase/migrations/` — never edit old migrations; add new ones. (Not applicable here —
  no DB changes needed.)
- `src/lib/crypto.ts` — do not change. (Not affected.)
- `src/app/api/vapi/` — keep webhook handlers fast. (Not affected.)

---

## Current State: Full Route + File Inventory

### Automations (Action Engine) — current routes

| URL | File | Notes |
|-----|------|-------|
| `/automations` | `src/app/(dashboard)/automations/page.tsx` | List of tool_configs + link to flows |
| `/automations/logs` | `src/app/(dashboard)/automations/logs/page.tsx` | All action_logs paginated |
| `/automations/[toolConfigId]` | `src/app/(dashboard)/automations/[toolConfigId]/page.tsx` | Tool detail + per-tool logs |
| (loading skeleton) | `src/app/(dashboard)/automations/loading.tsx` | Suspense fallback |

**Server actions (revalidatePath targets `/automations`):**
- `src/app/(dashboard)/automations/actions.ts` — createFolder, updateFolder, deleteFolder, deleteFolderWithTools, createToolConfig, updateToolConfig, renameToolConfig, deleteToolConfig, reorderFolders, moveToolToFolder all call `revalidatePath('/automations')` or `revalidatePath('/automations/${id}')`.
- `src/app/(dashboard)/automations/logs/actions.ts` — read-only, no revalidatePath.

**Components used:**
- `src/components/tools/tools-table.tsx`
- `src/components/tools/tool-config-form.tsx`
- `src/components/tools/logs-table.tsx`
- `src/components/tools/logs-filters.tsx`
- `src/components/tools/log-detail-sheet.tsx`
- `src/components/tools/inline-tool-name.tsx`
- `src/components/layout/page-header.tsx`

### Visual Flows — current routes

| URL | File | Notes |
|-----|------|-------|
| `/automations/flows` | `src/app/(dashboard)/automations/flows/page.tsx` | Grid of workflow cards |
| `/automations/flows/new` | `src/app/(dashboard)/automations/flows/new/page.tsx` | Create form |
| `/automations/flows/[id]` | `src/app/(dashboard)/automations/flows/[id]/page.tsx` | ReactFlow canvas editor |
| `/automations/flows/[id]/runs` | `src/app/(dashboard)/automations/flows/[id]/runs/page.tsx` | Run history list |
| `/automations/flows/runs/[runId]` | `src/app/(dashboard)/automations/flows/runs/[runId]/page.tsx` | Run detail + steps |

**Server actions (revalidatePath targets):**
- `src/app/(dashboard)/automations/flows/_actions/workflows.ts`:
  - `createWorkflow` → `revalidatePath('/automations/flows')`
  - `saveWorkflowDefinition` → `revalidatePath('/automations/flows/${workflowId}')`
  - `updateWorkflow` → `revalidatePath('/automations/flows')` + `revalidatePath('/automations/flows/${id}')`
  - `deleteWorkflow` → `revalidatePath('/automations/flows')`
- `src/app/(dashboard)/automations/flows/_actions/runs.ts`:
  - `runFlowNow` → `revalidatePath('/automations/flows/${input.workflowId}')`
- `src/app/(dashboard)/automations/flows/_actions/ai-build.ts` — no revalidatePath.

**Internal `Link href` strings in page files referencing `/automations/flows`:**
- `flows/page.tsx` → `href="/automations/flows/new"`
- `flows/new/page.tsx` → `href="/automations/flows"` (back button)
- `flows/[id]/runs/page.tsx` → `href="/automations/flows/${id}"` (back to editor)
- `flows/runs/[runId]/page.tsx` → `href="/automations/flows/${run.workflow_id}/runs"` (back)

**Components used:**
- `src/components/flows/flow-canvas.tsx` — ReactFlow canvas; imports `saveWorkflowDefinition` from `_actions/workflows`
- `src/components/flows/flow-toolbar.tsx`
- `src/components/flows/flow-palette.tsx`
- `src/components/flows/node-config-panel.tsx`
- `src/components/flows/ai-builder-chat.tsx`
- `src/components/flows/new-flow-form.tsx`
- `src/components/flows/nodes/` (index + base-node)
- `src/stores/flow-store.ts` — Zustand store; no route references, safe to leave in place
- `src/lib/flows/` — schema, engine, executors, ai-tools, node-metadata, interpolate, active-integrations — no route references

### Sidebar — current state

File: `src/components/layout/sidebar.tsx`

The `nav[]` array already has the label `'Workflows'` with `href: '/automations'`. The sidebar
label is already correct — only the `href` needs updating.

```ts
// Line 59 — current
{ icon: Zap, label: 'Workflows', href: '/automations', group: 'build' },

// Target
{ icon: Zap, label: 'Workflows', href: '/workflows', group: 'build' },
```

The active-detection logic uses `pathname.startsWith(item.href + '/')`, so changing the href to
`/workflows` will automatically handle all sub-routes once those routes exist.

---

## Architecture Patterns

### Recommended Target Route Structure

```
src/app/(dashboard)/workflows/
  page.tsx                     # unified landing: tool configs + flows grid (tabs or split view)
  loading.tsx                  # skeleton
  _actions/                    # (optional) — or keep actions in sub-folders
  [toolConfigId]/
    page.tsx                   # tool detail + logs
  logs/
    page.tsx                   # all action_logs
    actions.ts
  flows/
    page.tsx                   # visual flows list
    new/
      page.tsx
    [id]/
      page.tsx                 # canvas editor
      runs/
        page.tsx               # run history
    runs/
      [runId]/
        page.tsx               # run detail
    _actions/
      workflows.ts
      runs.ts
      ai-build.ts
```

Server actions files can be moved as-is; only their internal `revalidatePath()` calls need
updated strings. All component imports from `@/components/flows/*`, `@/components/tools/*`, and
`@/lib/flows/*` are alias-based and do not reference route URLs — they are unaffected by the
move.

### Pattern: Next.js `redirect()` for old URLs

Use `src/app/(dashboard)/automations/page.tsx` → replace with a `redirect('/workflows')`.
Repeat for each sub-route under `/automations/flows`:

```ts
// src/app/(dashboard)/automations/page.tsx
import { redirect } from 'next/navigation'
export default function AutomationsRedirect() {
  redirect('/workflows')
}
```

This is the safest approach: permanent redirects at the page level work for any user with a
bookmark or direct link. Because these are server components, the redirect is immediate and
adds no bundle cost.

An alternative is `next.config.js` `redirects: []` array, but page-level redirects are easier
to reason about and to revert individually.

### Pattern: Unified landing page

The current `/automations/page.tsx` renders the ToolsTable with a "Visual flows" card linking
to `/automations/flows`. For the unified view there are two layout options:

**Option A — Tabbed layout (recommended):**
Two tabs: "Automations" (tool configs table) and "Visual Flows" (workflow grid). Tabs are
driven by a `?tab=` query param. No Zustand needed — URL state.

**Option B — Single scrollable page:**
Stack the tool configs section above the visual flows grid. Simpler to implement but longer.

Either approach requires no new data fetching — just composing the existing two pages into one.

---

## Database: No Overlap, No Migration Required

### Action Engine tables (prefix: tool_*)
| Table | Key Columns | Org Scope |
|-------|-------------|-----------|
| `tool_configs` | `id`, `organization_id`, `tool_name`, `action_type`, `integration_id`, `folder_id` | `organization_id` |
| `tool_folders` | `id`, `org_id`, `name`, `parent_id`, `position` | `org_id` |
| `action_logs` | `id`, `organization_id`, `tool_config_id`, `vapi_call_id`, `status` | `organization_id` |

### Visual Flows tables (prefix: workflow*)
| Table | Key Columns | Org Scope |
|-------|-------------|-----------|
| `workflows` | `id`, `org_id`, `name`, `slug`, `is_active`, `current_version_id` | `org_id` |
| `workflow_versions` | `id`, `workflow_id`, `version_number`, `definition` (jsonb) | via `workflow_id` |
| `workflow_runs` | `id`, `org_id`, `workflow_id`, `status`, `trigger_type` | `org_id` |
| `workflow_run_steps` | `id`, `run_id`, `node_id`, `node_type`, `status`, `input`, `output` | via `run_id` |
| `workflow_waits` | `id`, `run_id`, `event_filter`, `timeout_at` | via `run_id` |
| `workflow_triggers` | `id`, `org_id`, `workflow_id`, `event_type`, `filter` | `org_id` |

**Zero table overlap.** The two systems share only the `integrations` table (read by the flows
`active-integrations.ts` helper and by tool configs), but both already query it via RLS — no
change needed.

**No DB migration needed for this phase.** All table names, column names, and RLS policies are
routing-independent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Old-URL backward compat | Custom middleware redirect logic | `redirect()` in server component | Zero overhead, type-safe, Next.js-idiomatic |
| Tab state | Client-side useState | URL `?tab=` query param | Shareable, bookmarkable, SSR-friendly |
| Importing server actions across route segments | Re-export or copy | Move files to new location; use `@/` alias | Alias is path-agnostic |

---

## Common Pitfalls

### Pitfall 1: Forgetting `revalidatePath()` strings
**What goes wrong:** After moving server actions files, the old `revalidatePath('/automations/...')` strings still compile fine but no longer bust the right cache keys — Next.js caches the old route, not the new one.
**Why it happens:** `revalidatePath` takes a plain string, not a type-checked route.
**How to avoid:** Grep for `/automations` in server actions files after moving them and replace all instances with `/workflows`.
**Warning signs:** UI appears stale after create/update/delete — changes don't reflect without a hard refresh.

### Pitfall 2: `FlowCanvas` imports `saveWorkflowDefinition` by path
**What goes wrong:** `src/components/flows/flow-canvas.tsx` has a direct import:
```ts
import { saveWorkflowDefinition } from '@/app/(dashboard)/automations/flows/_actions/workflows'
```
If the `_actions` directory moves without updating this import, the build fails with a
module-not-found error.
**How to avoid:** Update this import to the new path before running `npm run build`.

### Pitfall 3: `runs/[runId]` page back-link references old path
**What goes wrong:** `flows/runs/[runId]/page.tsx` has:
```ts
<Link href={`/automations/flows/${run.workflow_id}/runs`}>
```
After the route rename, this link sends users to the old (redirected) URL rather than the new direct URL. While the redirect catches it, it adds a round-trip and breaks the active sidebar highlight.
**How to avoid:** Update all `href` strings in page components, not just server action `revalidatePath` calls.

### Pitfall 4: `isActive` sidebar logic tied to `startsWith('/automations')`
**What goes wrong:** The sidebar active detection uses `pathname.startsWith(item.href + '/')`. If the nav item's `href` is updated to `/workflows` but any page still renders under `/automations/...` (e.g., a redirect target), the sidebar item won't highlight.
**How to avoid:** Complete the route move before updating the sidebar href. Don't leave any pages at the old path — use redirect stubs only.

### Pitfall 5: `new-flow-form.tsx` `router.push` after creation
**What goes wrong:** `NewFlowForm` uses `router.push` to navigate to the new flow's editor after creation. If the push path still references `/automations/flows/${id}`, the user lands at the redirect stub instead of the canonical URL.
**How to avoid:** Check the `NewFlowForm` component for any `router.push` calls and update the target path.

---

## Code Examples

### Redirect stub (Action Engine root)
```ts
// src/app/(dashboard)/automations/page.tsx — AFTER phase
import { redirect } from 'next/navigation'
export default function AutomationsLegacyRedirect() {
  redirect('/workflows')
}
```

### Redirect stub (Flows list)
```ts
// src/app/(dashboard)/automations/flows/page.tsx — AFTER phase
import { redirect } from 'next/navigation'
export default function FlowsLegacyRedirect() {
  redirect('/workflows/flows')
}
```

### Updated sidebar href (only change needed)
```ts
// src/components/layout/sidebar.tsx — line 59
{ icon: Zap, label: 'Workflows', href: '/workflows', group: 'build' },
```

### Updated revalidatePath in actions.ts
```ts
// src/app/(dashboard)/workflows/actions.ts
revalidatePath('/workflows')        // was: /automations
revalidatePath(`/workflows/${id}`)  // was: /automations/${id}
```

### Updated import in flow-canvas.tsx
```ts
// src/components/flows/flow-canvas.tsx
import { saveWorkflowDefinition } from '@/app/(dashboard)/workflows/flows/_actions/workflows'
// was: '@/app/(dashboard)/automations/flows/_actions/workflows'
```

---

## File Change Summary

The table below lists every file that needs a code edit (not just a move). Files that only
move and have no internal route strings are omitted — those can be copied/moved as-is.

| File | Change Type | Detail |
|------|-------------|--------|
| `src/components/layout/sidebar.tsx` | Edit | `href: '/automations'` → `href: '/workflows'` |
| `src/components/flows/flow-canvas.tsx` | Edit | Import path for `saveWorkflowDefinition` |
| `src/app/(dashboard)/workflows/actions.ts` | Edit | All `revalidatePath('/automations...')` → `/workflows...` |
| `src/app/(dashboard)/workflows/flows/_actions/workflows.ts` | Edit | All `revalidatePath('/automations/flows...')` → `/workflows/flows...` |
| `src/app/(dashboard)/workflows/flows/_actions/runs.ts` | Edit | `revalidatePath('/automations/flows/...')` → `/workflows/flows/...` |
| `src/app/(dashboard)/workflows/flows/page.tsx` | Edit | `href="/automations/flows/new"` → `/workflows/flows/new` |
| `src/app/(dashboard)/workflows/flows/new/page.tsx` | Edit | Back link + eyebrow text |
| `src/app/(dashboard)/workflows/flows/[id]/runs/page.tsx` | Edit | Back link to editor |
| `src/app/(dashboard)/workflows/flows/runs/[runId]/page.tsx` | Edit | Back link to runs list |
| `src/app/(dashboard)/workflows/[toolConfigId]/page.tsx` | Edit | `back.href` + `buildPageUrl()` |
| `src/app/(dashboard)/workflows/logs/page.tsx` | Edit | `BASE_PATH` constant + back link |
| `src/app/(dashboard)/automations/page.tsx` | Replace | Redirect stub to `/workflows` |
| `src/app/(dashboard)/automations/flows/page.tsx` | Replace | Redirect stub to `/workflows/flows` |
| `src/app/(dashboard)/automations/flows/new/page.tsx` | Replace | Redirect stub |
| `src/app/(dashboard)/automations/flows/[id]/page.tsx` | Replace | Redirect stub (dynamic) |
| `src/app/(dashboard)/automations/flows/[id]/runs/page.tsx` | Replace | Redirect stub (dynamic) |
| `src/app/(dashboard)/automations/flows/runs/[runId]/page.tsx` | Replace | Redirect stub (dynamic) |
| `src/app/(dashboard)/automations/logs/page.tsx` | Replace | Redirect stub |
| `src/app/(dashboard)/automations/[toolConfigId]/page.tsx` | Replace | Redirect stub (dynamic) |

**New files to create:**
- All files under `src/app/(dashboard)/workflows/` (copy from automations, then edit)
- The unified landing `src/app/(dashboard)/workflows/page.tsx` (new composition)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | Check `tests/` directory |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| FLOW-01 | Sidebar has single "Workflows" entry at `/workflows` | Manual visual / smoke | `npm run build` | No existing unit test for nav |
| FLOW-02 | `/workflows` renders without 404 | Smoke | `npm run build` (type check) | |
| FLOW-03 | Tool configs CRUD still works | Manual | `npm run build` | Server actions unchanged |
| FLOW-04 | Visual flows still accessible | Manual | `npm run build` | Store + engine unchanged |
| FLOW-05 | Old `/automations` URLs redirect cleanly | Manual | Navigate in browser | Redirect stubs |

**Phase gate:** `npm run build` exits 0 — this catches all broken imports and missing modules
from the file move.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a pure routing/code reorganization. No external tools,
databases, or CLIs beyond the existing `npm run build` and Supabase (already operational) are
required.

---

## Open Questions

1. **Unified landing page layout — tabs vs. scroll**
   - What we know: Both systems are currently separate pages with no visual relationship.
   - What's unclear: Whether to present them as tabs (tool configs | visual flows) or as a
     single scrollable page with two sections.
   - Recommendation: Tabs with `?tab=automations` (default) and `?tab=flows`. This is the
     least disruptive to each system's existing layout and matches the ROADMAP's "unified UX"
     goal without requiring a full redesign.

2. **`new-flow-form.tsx` router.push target path**
   - What we know: The component handles post-creation navigation internally.
   - What's unclear: The exact `router.push` call path has not been read (component body not
     inspected in detail).
   - Recommendation: Read `new-flow-form.tsx` during plan execution and update any
     `/automations/flows/${id}` push to `/workflows/flows/${id}`.

3. **Command palette — does it hard-code `/automations` routes?**
   - What we know: `CommandPaletteProvider` is mounted in the dashboard layout.
   - What's unclear: Whether the command palette's navigation items reference `/automations`.
   - Recommendation: Grep for `/automations` across `src/components/command-palette*` before
     closing the phase.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/components/layout/sidebar.tsx` — nav array, active detection logic
- `src/app/(dashboard)/automations/` — all page, action, and loading files
- `src/app/(dashboard)/automations/flows/` — all page and action files
- `src/components/flows/` — canvas, store, schema, metadata
- `src/stores/flow-store.ts` — Zustand state shape
- `src/lib/flows/schema.ts` — FlowDefinition Zod schema
- `src/lib/action-engine/execute-action.ts` — 15 action types, ActionContext
- `src/types/database.ts` — table Row types
- `supabase/migrations/002_action_engine.sql` — tool_configs, action_logs schema
- `supabase/migrations/074_workflows.sql` — workflows, workflow_versions schema
- `supabase/migrations/075_workflow_engine.sql` — workflow_runs, workflow_run_steps schema
- `src/app/(dashboard)/layout.tsx` — Sidebar mount, no route strings

---

## Metadata

**Confidence breakdown:**
- Route inventory: HIGH — read directly from filesystem
- File change list: HIGH — traced all import paths and revalidatePath calls
- Architecture patterns: HIGH — standard Next.js App Router redirect pattern
- Pitfalls: HIGH — derived from actual code patterns observed

**Research date:** 2026-05-20
**Valid until:** Stable — this is internal codebase state, not an external dependency.
