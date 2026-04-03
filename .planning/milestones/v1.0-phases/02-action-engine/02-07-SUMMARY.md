---
phase: 02-action-engine
plan: 07
subsystem: ui
tags: [integrations, tools, dashboard, forms, sidebar]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [integrations-ui, tools-ui, sidebar-nav]
  affects: [dashboard-layout, action-engine-control-plane]
tech_stack:
  added: [textarea-component]
  patterns: [tanstack-table, sheet-form, server-actions, react-hook-form-zod, sonner-toast]
key_files:
  created:
    - src/app/(dashboard)/integrations/actions.ts
    - src/app/(dashboard)/integrations/page.tsx
    - src/components/integrations/integrations-table.tsx
    - src/components/integrations/integration-form.tsx
    - src/app/(dashboard)/tools/actions.ts
    - src/app/(dashboard)/tools/page.tsx
    - src/components/tools/tools-table.tsx
    - src/components/tools/tool-config-form.tsx
    - src/components/ui/textarea.tsx
  modified:
    - src/components/layout/app-sidebar.tsx
decisions:
  - "API key never pre-filled in edit mode — security requirement ACTN-04"
  - "Textarea component added to ui/ (not in original shadcn set) to support fallback message textarea field"
  - "tools/actions.ts re-exports getIntegrations() from integrations/actions.ts for page co-location"
  - "sidebar nav items use active boolean — Integrations and Tools set to active: true, replacing disabled Action Engine entry"
metrics:
  duration: ~15 minutes
  completed: 2026-04-03
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 2 Plan 07: Integrations and Tools Dashboard UI Summary

Integrations admin UI and Tool Configurations admin UI with Sheet forms, TanStack Table, and encrypted credential storage — API key stored via AES-256-GCM encrypt(), displayed via maskApiKey() (last 4 chars only).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Integrations server actions + page + table | bf57870 | actions.ts, page.tsx, integrations-table.tsx |
| 2 | Integration Sheet form + Tool Configs UI + sidebar nav update | ea816ee | integration-form.tsx, tools/actions.ts, tools/page.tsx, tools-table.tsx, tool-config-form.tsx, app-sidebar.tsx, textarea.tsx |

## What Was Built

### Integrations UI (/dashboard/integrations)
- Server component page fetches integrations via `getIntegrations()` — never exposes `encrypted_api_key` to UI
- `IntegrationsTable` with TanStack Table columns: Name, Provider (Badge), Masked Key (font-mono, ••••••••last4), Status (Badge), Created
- Row actions: Edit Integration (opens Sheet), Test Connection (calls GHL API server-side, shows sonner toast), Delete Integration (AlertDialog confirm)
- `IntegrationForm` Sheet: Name, Provider select, API Key (type=password, never pre-filled in edit), Location ID fields
- Zod schema validates all fields; edit mode uses separate schema with optional apiKey

### Test Connection
- Calls `https://services.leadconnectorhq.com/contacts/?locationId={id}&limit=1` with `Authorization: Bearer {decryptedKey}` and `Version: 2021-07-28`
- AbortController with 5-second timeout
- Returns `{ success: true }` or `{ success: false, error: string }` — toast shown in UI

### Tools UI (/dashboard/tools)
- Server component page fetches tool configs (with joined integration name) and integrations list for form select
- `ToolsTable` with columns: Tool Name (font-mono), Action Type (human-readable labels), Integration (name), Fallback Message (truncated 40 chars), Status (Badge)
- Row actions: Edit Tool Config, Delete Tool Config (AlertDialog confirm)
- `ToolConfigForm` Sheet: Tool Name (with helper text), Action Type select (6 options), Integration select (populated from integrations), Fallback Message (Textarea with helper text)
- Handles unique constraint (23505) with "A tool with this name already exists for your organization."

### Sidebar Nav
- Added `Plug2` icon import to app-sidebar.tsx
- Replaced disabled `{ Zap, 'Action Engine', active: false }` with two active items:
  - `{ Plug2, 'Integrations', '/dashboard/integrations', active: true }`
  - `{ Zap, 'Tools', '/dashboard/tools', active: true }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing Textarea UI component**
- **Found during:** Task 2 (tool-config-form.tsx imports @/components/ui/textarea)
- **Issue:** `src/components/ui/textarea.tsx` did not exist — shadcn Textarea was not in the original component set
- **Fix:** Created `src/components/ui/textarea.tsx` following shadcn/ui forwardRef pattern with identical styling conventions as other ui/ components
- **Files modified:** src/components/ui/textarea.tsx (created)
- **Commit:** ea816ee

**2. [Rule 1 - Bug] TypeScript `result used before assigned` in form components**
- **Found during:** TypeScript check after Task 1 and Task 2
- **Issue:** `let result: { error?: string } | void` without initializer caused TS2454 in integration-form.tsx and tool-config-form.tsx
- **Fix:** Initialized as `= undefined` to satisfy TypeScript definite assignment analysis
- **Files modified:** integration-form.tsx, tool-config-form.tsx
- **Commit:** ea816ee

**3. [Rule 1 - Bug] `config` field type incompatibility in tool_configs insert/update**
- **Found during:** TypeScript check after Task 2
- **Issue:** `data.config ?? {}` typed as `Record<string, unknown>` not assignable to Supabase `Json` type
- **Fix:** Cast to `Json` type via `(data.config ?? {}) as Json` with `import type { Json } from '@/types/database'`
- **Files modified:** src/app/(dashboard)/tools/actions.ts
- **Commit:** ea816ee

### Out-of-Scope Pre-existing Errors (deferred)
- `src/components/organizations/organization-form.tsx`: 5 TypeScript errors (zodResolver generic type mismatch, result-before-assigned) — pre-existing, not caused by this plan
- `src/lib/crypto.ts`: TS2322 Uint8Array buffer type error — pre-existing TypeScript strict mode issue

## Known Stubs

None. All columns are wired to real DB data. Integration and tool config records flow from Supabase through server actions to the table components without any hardcoded placeholders.

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` gate requiring visual inspection of:
- /dashboard/integrations loads with Add Integration button and masked key display
- /dashboard/tools loads with Add Tool button and action type labels
- Sidebar shows Integrations and Tools as active (not grayed)
- Forms open as Sheets, toasts appear, Test Connection returns result

## Self-Check: PASSED

Files verified present:
- src/app/(dashboard)/integrations/actions.ts — FOUND
- src/app/(dashboard)/integrations/page.tsx — FOUND
- src/components/integrations/integrations-table.tsx — FOUND
- src/components/integrations/integration-form.tsx — FOUND
- src/app/(dashboard)/tools/actions.ts — FOUND
- src/app/(dashboard)/tools/page.tsx — FOUND
- src/components/tools/tools-table.tsx — FOUND
- src/components/tools/tool-config-form.tsx — FOUND
- src/components/ui/textarea.tsx — FOUND
- src/components/layout/app-sidebar.tsx — MODIFIED

Commits verified present:
- bf57870 — Task 1 integrations server actions, page, table
- ea816ee — Task 2 integration form, tools UI, sidebar nav
