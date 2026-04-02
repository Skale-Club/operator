---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [nextjs, react, supabase-auth, shadcn-ui, react-hook-form, zod, tailwind, sidebar]

# Dependency graph
requires:
  - phase: 01-02
    provides: Next.js scaffold, Supabase browser/server clients, auth middleware
  - phase: 01-03
    provides: Database types, Supabase schema and RLS policies

provides:
  - Login page with email/password auth (React Hook Form + Zod, mode:onSubmit)
  - Auth layout (centered full-screen container)
  - Dashboard layout shell (SidebarProvider + AppSidebar + SidebarInset)
  - AppSidebar with 6 nav items (2 active, 4 disabled), user menu, Sign Out
  - Dashboard default page redirect to /dashboard/organizations
  - Root error boundary (no stack trace exposure)

affects: [02-action-engine, 03-observability, 04-knowledge, 05-campaigns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Login form with React Hook Form + Zod resolver (mode:onSubmit, error display above submit)
    - Supabase signInWithPassword on client, router.refresh() + router.push() on success
    - Dashboard layout as server component with getUser() redirect guard
    - AppSidebar as client component consuming User prop from server layout
    - Initials-based Avatar from user_metadata.full_name or email fallback
    - Disabled nav items via SidebarMenuButton disabled + opacity-40

key-files:
  created:
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/page.tsx
    - src/components/layout/app-sidebar.tsx
    - src/app/error.tsx
  modified: []

key-decisions:
  - "Belt-and-suspenders auth guard: dashboard layout checks getUser() even though middleware already handles it"
  - "SidebarTrigger placed in sidebar header (not inset header) so it collapses with the sidebar on mobile"
  - "Error boundary at app root (not dashboard root) to catch layout-level errors"

patterns-established:
  - "Pattern: Server layout fetches user, passes as prop to client sidebar — avoids client-side auth fetch on every navigation"
  - "Pattern: disabled nav items use SidebarMenuButton disabled + className='opacity-40 cursor-not-allowed' (no tooltip in Phase 1)"
  - "Pattern: auth errors displayed above submit button (not inline with fields) for UX clarity"

requirements-completed: [AUTH-01, AUTH-03, AUTH-04]

# Metrics
duration: 10min
completed: 2026-04-02
---

# Phase 1 Plan 04: Login Page + Dashboard Shell Summary

**Login page with Supabase signInWithPassword, show/hide password toggle, and dashboard shell with shadcn/ui sidebar (6 nav items, 2 active, user sign-out)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-02T22:57:39Z
- **Completed:** 2026-04-02T23:07:00Z
- **Tasks:** 3 of 3 (checkpoint verified and approved by user)
- **Files modified:** 6

## Accomplishments
- Login page: centered card, autofocused email field, show/hide password, submit loading state with spinner, auth error mapped to user-facing copy above submit button, redirects to /dashboard/organizations on success
- Dashboard layout shell: server component with getUser() guard + redirect, SidebarProvider wrapping AppSidebar + SidebarInset
- AppSidebar: 6 nav items per spec (Organizations, Assistants active; Action Engine, Observability, Knowledge Base, Campaigns disabled at opacity-40), initials avatar, Sign Out via DropdownMenu
- Root error boundary: 'use client', logs to console, shows "Something went wrong." without exposing stack traces

## Task Commits

1. **Task 1: Login page and auth layout** - `1a564cc` (feat)
2. **Task 2: Dashboard layout shell and sidebar** - `802cd5c` (feat)
3. **Task 3: Checkpoint** - approved by user (human-verify gate passed)

## Files Created/Modified
- `src/app/(auth)/layout.tsx` - Centered full-screen auth container
- `src/app/(auth)/login/page.tsx` - Login form: RHF + Zod, signInWithPassword, loading state, error display
- `src/app/(dashboard)/layout.tsx` - Server layout: getUser() guard, SidebarProvider + AppSidebar + SidebarInset
- `src/app/(dashboard)/page.tsx` - Default dashboard redirect to /dashboard/organizations
- `src/components/layout/app-sidebar.tsx` - Client sidebar: 6 nav items, initials avatar, Sign Out
- `src/app/error.tsx` - Root error boundary: no stack trace exposure

## Decisions Made
- Belt-and-suspenders approach: dashboard layout checks getUser() directly even though middleware enforces auth — protects against middleware bypass edge cases
- SidebarTrigger in sidebar header (not inset header bar) — collapses naturally with sidebar on mobile
- Error boundary at app root, not dashboard root, to catch layout-level rendering errors
- No router.push('/login') after signOut — plan specifies router.push('/login'), which is correct (not just refresh)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Files were pre-built and matched all acceptance criteria. TypeScript compilation passed with zero errors.

## User Setup Required

None — no external service configuration required for this plan. Supabase credentials must be set in .env.local (handled in Plan 01-02).

## Next Phase Readiness
- Login + logout flow is complete — admin can authenticate and access the dashboard
- Sidebar shell is ready for all /dashboard/* routes to render inside
- Plans 01-05 and 01-06 (Organizations CRUD, Assistant Mappings) can proceed
- Unauthenticated redirect guard is in place in both middleware (01-02) and layout (belt-and-suspenders)

---
*Phase: 01-foundation*
*Completed: 2026-04-02*
