# Deferred Items - Phase 102 Workflows Unification

## Out-of-scope /automations references discovered during Plan 02 execution

These files still reference `/automations` routes but were outside Plan 02's explicit scope.
Build passes because the source files (`/automations/actions.ts`, etc.) still exist and redirect stubs are in place.
All these routes will redirect to `/workflows/**` equivalents.

### Components with /automations hrefs or imports

| File | Type | Detail |
|------|------|--------|
| `src/components/flows/ai-builder-chat.tsx` | import | `@/app/(dashboard)/automations/flows/_actions/ai-build` and `workflows` |
| `src/components/flows/flow-toolbar.tsx` | import + href | imports from automations _actions; hrefs to `/automations/flows/...` |
| `src/components/layout/app-sidebar.tsx` | href | `{ href: '/automations', active: true }` (separate sidebar file) |
| `src/components/notifications/notification-item.tsx` | href | `/automations/logs?id=...` |
| `src/components/tools/inline-tool-name.tsx` | import | `from '@/app/(dashboard)/automations/actions'` |
| `src/components/tools/log-detail-sheet.tsx` | type import | `from '@/app/(dashboard)/automations/logs/actions'` |
| `src/components/tools/logs-table.tsx` | type import | `from '@/app/(dashboard)/automations/logs/actions'` |
| `src/components/tools/tool-config-form.tsx` | import | `from '@/app/(dashboard)/automations/actions'` |
| `src/components/tools/tools-table.tsx` | import + href | imports from automations/actions; hrefs to `/automations/${id}` |
| `src/components/agents/tool-picker.tsx` | href | `href="/automations/${tool.id}"` |

### Impact
- All hrefs still work (redirect stubs in place)
- Type imports still resolve (source files still exist)
- Build: PASSING

### Recommended follow-up
A Phase 103 cleanup plan should update these components to use `/workflows` paths directly,
and update the imports to use the new `/workflows` action files.
