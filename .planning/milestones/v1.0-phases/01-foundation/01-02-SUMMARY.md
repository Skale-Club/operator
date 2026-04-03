---
phase: 01-foundation
plan: 02
subsystem: auth-scaffold
tags: [nextjs, supabase, auth, middleware, ssr]
dependency_graph:
  requires: [01-01]
  provides: [supabase-clients, auth-middleware, pkce-callback, nextjs-scaffold]
  affects: [01-03, 01-04, 01-05, 01-06]
tech_stack:
  added:
    - next@15.5.14
    - "@supabase/supabase-js@2.101.1"
    - "@supabase/ssr@0.10.0"
    - react-hook-form@7.72.0
    - zod@3
    - "@tanstack/react-table@8.21.3"
    - lucide-react
    - sonner
    - shadcn/ui (18 components)
    - clsx, tailwind-merge, class-variance-authority
  patterns:
    - Supabase SSR pattern with three distinct clients (browser/server/admin)
    - getClaims() for session validation in middleware (not deprecated getSession)
    - setAll cookie handler refreshes session on every request (AUTH-02)
    - PKCE code exchange via /api/auth/callback route
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - components.json
    - .env.local.example
    - .gitignore
    - src/app/globals.css
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/lib/utils.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/admin.ts
    - src/middleware.ts
    - src/app/api/auth/callback/route.ts
    - src/components/ui/ (18 shadcn/ui components)
    - src/hooks/use-mobile.tsx
  modified: []
decisions:
  - "Use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (not ANON_KEY) — new naming since late 2025"
  - "getClaims() used in middleware instead of deprecated getSession()"
  - "Database type import deferred to Plan 01-03 (parallel wave 1 execution)"
  - "No stub database.ts created — plan 01-03 provides this type in Wave 1"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-02"
  tasks_completed: 2
  tasks_total: 2
  files_created: 20+
---

# Phase 1 Plan 02: Next.js 15 Scaffold + Supabase Auth Foundation Summary

**One-liner:** Next.js 15 scaffold with three Supabase SSR clients (browser/server/service-role), middleware using getClaims() for route protection with setAll session refresh, and PKCE auth callback handler.

## Tasks Completed

### Task 1: Scaffold Next.js 15 project and install dependencies

Created the Next.js 15 project structure with all Phase 1 dependencies. Since `create-next-app` could not run in a directory with existing files (.claude/, .planning/), the scaffold was created manually.

**Dependencies installed:**
- Core: next@15.5.14, react@19, react-dom@19, typescript@5
- Supabase: @supabase/supabase-js@2.101.1, @supabase/ssr@0.10.0
- Forms: react-hook-form@7.72.0, @hookform/resolvers, zod@3
- Tables: @tanstack/react-table@8.21.3
- UI: lucide-react, sonner, shadcn/ui (18 components)
- Styling: tailwindcss@4, @tailwindcss/postcss, postcss

**shadcn/ui components added:** sidebar, button, card, dialog, alert-dialog, sheet, table, badge, switch, skeleton, avatar, dropdown-menu, form, input, label, select, separator, tooltip

**Key files:**
- `package.json` — all dependencies at specified versions (zod@3, not v4)
- `tsconfig.json` — strict mode enabled, paths alias @/* → ./src/*
- `next.config.ts`, `postcss.config.mjs`, `components.json`
- `.env.local.example` — uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (not ANON_KEY)
- `src/components/ui/` — 18 shadcn/ui components
- `.gitignore` — excludes node_modules, .next, env files (preserves .env.local.example)

### Task 2: Create Supabase clients and middleware

Implemented all three Supabase clients and auth infrastructure exactly per the plan interfaces.

**src/lib/supabase/client.ts** — Browser client using createBrowserClient<Database>. Typed with Database (from Plan 01-03). Used in Client Components only.

**src/lib/supabase/server.ts** — Server client using createServerClient<Database> with `await cookies()` (required in Next.js 15). Has getAll/setAll cookie handlers. Used in Server Components, Server Actions, Route Handlers.

**src/lib/supabase/admin.ts** — Service role client using @supabase/supabase-js createClient with SUPABASE_SERVICE_ROLE_KEY and persistSession: false. Has prominent danger warning comment. ONLY for /api/vapi/* Edge Functions.

**src/middleware.ts** — Route protection using getClaims() (not deprecated getSession). Has setAll cookie handler to refresh session on every request (AUTH-02 compliance). Correctly excludes:
- /api/vapi routes (Vapi webhooks use x-vapi-secret header)
- /api/auth routes (callback must be accessible unauthenticated)
- /_next static routes
- Image files (favicon, svg, png, jpg, jpeg, gif, webp)

**src/app/api/auth/callback/route.ts** — PKCE code exchange handler. Exchanges code for session, redirects to /dashboard/organizations on success, redirects to /login?error=auth_callback_failed on failure.

**src/app/layout.tsx** — Root layout with Inter font, dark mode class on html element, and Toaster (sonner) for notifications.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual project scaffold instead of create-next-app**
- **Found during:** Task 1
- **Issue:** `npx create-next-app@15 .` rejected with "directory contains files that could conflict" (.claude/, .planning/, README.md, VOICEOPS_MASTER_PROMPT.md)
- **Fix:** Created package.json, tsconfig.json, next.config.ts, postcss.config.mjs manually. Initialized shadcn/ui via `npx shadcn@latest init` with components.json config. All deps installed via npm install.
- **Files modified:** package.json, tsconfig.json, next.config.ts, postcss.config.mjs, components.json
- **Impact:** None — identical result to create-next-app scaffold

**2. [Rule 3 - Blocking] Git commit sandbox restriction**
- **Found during:** Task 1 commit attempt
- **Issue:** Sandbox environment blocks `git add` and `git commit` write operations. Read-only git operations (git status, git log, git diff) work normally.
- **Action:** All code files were created successfully. Commits need to be performed outside sandbox or by the orchestrator after plan completion.
- **Files created:** All files listed in key_files above are present on disk in the worktree

## Known Stubs

**src/lib/supabase/client.ts, server.ts, admin.ts** import `import type { Database } from '@/types/database'` — this type does not exist yet (it will be created by Plan 01-03, running in the same Wave 1). This is intentional per plan instructions: "Do NOT create a stub src/types/database.ts here." TypeScript will error on these imports until Plan 01-03 completes. Plan 01-04 (which depends on both 01-02 and 01-03) is where TypeScript compilation will be verified.

## Verification Results

- getClaims() used in middleware: CONFIRMED (line 27 of middleware.ts)
- setAll cookie handler: CONFIRMED (line 15 of middleware.ts)
- /api/vapi exclusion: CONFIRMED (line 30 of middleware.ts)
- getSession NOT used: CONFIRMED (grep returns no matches)
- createBrowserClient in client.ts: CONFIRMED
- createServerClient in server.ts: CONFIRMED
- createServiceRoleClient in admin.ts: CONFIRMED
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.example: CONFIRMED
- zod version: ^3 (confirmed in package.json)
- components/ui/ directory: CONFIRMED (18 components)

## Self-Check: PARTIAL

Files exist on disk: CONFIRMED (verified via ls commands)
Commits exist: BLOCKED — git add/commit sandbox restriction prevents committing. Files are present in worktree but uncommitted.

**Resolution needed:** Orchestrator or user must run:
```bash
cd /c/Users/Vanildo/Dev/voiceops/.claude/worktrees/agent-a1325f53

# Task 1 commit
git add .gitignore .env.local.example components.json next.config.ts next-env.d.ts package.json package-lock.json postcss.config.mjs tsconfig.json src/app/globals.css src/app/page.tsx src/lib/utils.ts src/components/ src/hooks/
git commit --no-verify -m "feat(01-02): scaffold Next.js 15 project and install all phase 1 dependencies

- Next.js 15.5.14 with TypeScript strict mode and App Router
- Supabase @supabase/supabase-js@2.101.1 and @supabase/ssr@0.10.0
- react-hook-form@7.72.0, zod@3, @tanstack/react-table@8.21.3
- shadcn/ui initialized with 18 components (sidebar, button, card, etc.)
- .env.local.example with NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY naming
"

# Task 2 commit
git add src/lib/supabase/client.ts src/lib/supabase/server.ts src/lib/supabase/admin.ts src/middleware.ts src/app/api/auth/callback/route.ts src/app/layout.tsx
git commit --no-verify -m "feat(01-02): create Supabase clients and wire auth middleware

- Three Supabase clients: browser (createBrowserClient), server (createServerClient + await cookies()), admin (service role)
- Middleware uses getClaims() not deprecated getSession(), has setAll cookie refresh
- Auth callback route handles PKCE code exchange at /api/auth/callback
- Root layout with Inter font and Toaster (sonner)
"
```
