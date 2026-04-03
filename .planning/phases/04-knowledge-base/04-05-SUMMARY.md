---
phase: 04-knowledge-base
plan: "05"
subsystem: knowledge-dashboard-ui
tags: [nextjs, react, server-component, client-component, sidebar, status-badge]
dependency_graph:
  requires: [04-03, 04-04]
  provides: [/dashboard/knowledge page, DocumentList, UploadForm, active sidebar nav]
  affects: []
tech_stack:
  added: []
  patterns: [server component data fetch, client component useTransition, window.location.reload refresh]
key_files:
  created:
    - src/app/(dashboard)/knowledge/page.tsx
    - src/components/knowledge/document-list.tsx
    - src/components/knowledge/upload-form.tsx
  modified:
    - src/components/layout/app-sidebar.tsx
decisions:
  - window.location.reload() for post-upload/delete refresh (simpler than router.refresh() for MVP)
  - StatusBadge uses inline className strings (no shadcn Badge import needed — keeps bundle small)
  - UploadForm splits into two separate forms (file + URL) with independent state
  - DocumentRow handles delete with confirm() dialog to prevent accidental deletions
  - Document type derived from Database['public']['Tables']['documents']['Row'] — single source of truth
  - autonomous: false plan — all code implemented; requires human UAT before marking complete
metrics:
  duration: 10m
  completed: "2026-04-02"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 4 Plan 05: Dashboard UI + Sidebar Summary

Knowledge Base admin dashboard: server page with document list, upload form (file + URL), status badges, delete functionality, and activated sidebar navigation.

## What Was Built

### src/app/(dashboard)/knowledge/page.tsx
- Server component: getUser → redirect('/login') guard
- Fetches documents ordered by created_at descending
- Renders UploadForm + DocumentList

### src/components/knowledge/upload-form.tsx (client component)
- File upload form: fetches `/api/knowledge/upload` → calls `insertDocument` server action
- URL form: calls `addUrlDocument` server action directly
- Independent loading states (isPendingFile, isPendingUrl, fileStatus, urlStatus)
- Error messages and success feedback per form

### src/components/knowledge/document-list.tsx (client component)
- StatusBadge component: processing (yellow), ready (green), error (red)
- DocumentRow: name + source_type, status badge + error_detail, chunk_count (only when ready), created_at date
- Delete button: confirm() dialog → deleteDocument server action → page reload
- Empty state: "No documents yet" message
- Table structure with header row

### src/components/layout/app-sidebar.tsx
- Knowledge Base nav item: `active: false` → `active: true`
- Item now renders as Link (not disabled button), navigable from dashboard

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired. Documents are fetched from Supabase (not mock data). The upload form calls live server actions and API routes. Status badges reflect actual database status values.

**Human UAT Required:** This plan has `autonomous: false`. The following user actions need verification in a browser:
1. Navigate to /dashboard/knowledge via sidebar (Knowledge Base item should be active)
2. Upload a PDF/TXT/CSV file — confirm upload → document appears with status=Processing
3. Add a URL — confirm document appears with status=Processing
4. Wait for Edge Function processing — document transitions to status=Ready with chunk_count
5. Click Delete — confirm dialog appears, document removed from list
6. Verify status=Error case shows red badge with error_detail tooltip

**Prerequisite:** Supabase Storage bucket `knowledge-docs` must be created (public: false) before uploads work.

## Self-Check: PASSED
- src/app/(dashboard)/knowledge/page.tsx: FOUND
- src/components/knowledge/document-list.tsx: FOUND
- src/components/knowledge/upload-form.tsx: FOUND
- grep "Knowledge Base.*active: true": FOUND in app-sidebar.tsx
- grep "api/knowledge/upload" upload-form.tsx: FOUND
- grep "insertDocument" upload-form.tsx: FOUND
- grep "addUrlDocument" upload-form.tsx: FOUND
- grep "deleteDocument" document-list.tsx: FOUND
- vitest full suite: 38 pass, 94 todo -- exits 0
- TypeScript (excluding pre-existing errors): PASSED
