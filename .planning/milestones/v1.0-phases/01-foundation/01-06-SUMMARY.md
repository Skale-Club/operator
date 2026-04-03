---
plan: 01-06
slug: assistant-mappings-crud
status: complete
committed: true
commit: bdf447f
---

# Plan 01-06 Summary — Assistant Mappings CRUD

## What Was Built

- `src/app/(dashboard)/assistants/actions.ts` — Three server actions: `createAssistantMapping`, `toggleAssistantMappingStatus`, `deleteAssistantMapping`
- `src/app/(dashboard)/assistants/page.tsx` — Server component that fetches mappings and renders table
- `src/components/assistants/assistant-mapping-form.tsx` — Sheet-based form (React Hook Form + Zod) for adding mappings
- `src/components/assistants/assistant-mappings-table.tsx` — TanStack Table with shadcn Switch toggle for is_active
- `src/middleware.ts` — Fixed `getClaims()` destructuring: `claimsData?.claims` pattern

## Requirements Covered

- **TEN-03**: Admin can link a `vapi_assistant_id` to an organization; duplicate IDs return error message
- **TEN-04**: Admin can toggle mapping `is_active` true/false via Switch without deleting the record

## Test Status

- `tests/assistant-mappings.test.ts` — Updated stubs: 6 todos pending

## Notes

- Switch toggle calls `toggleAssistantMappingStatus` server action inline (no modal confirmation needed)
- `deleteAssistantMapping` is available but soft-delete (toggle) is the primary deactivation path
- Middleware fix: `getClaims()` returns `{ data: { claims } }` — needed `data.claims` not direct destructure
