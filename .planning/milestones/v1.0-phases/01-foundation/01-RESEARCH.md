# Phase 1: Foundation — Research

**Researched:** 2026-04-02
**Domain:** Supabase Auth SSR + Next.js 15 App Router + Multi-tenant RLS + Organization management
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEN-01 | Admin can create, update, and deactivate organizations (tenants) | Organizations table schema + CRUD API routes + shadcn/ui forms |
| TEN-02 | All database queries automatically scoped to user's organization via Supabase RLS | RLS policies + `get_current_org_id()` helper function pattern |
| TEN-03 | Admin can link Vapi assistant IDs to specific organizations (assistant mapping) | `assistant_mappings` table schema + CRUD routes |
| TEN-04 | Admin can activate/deactivate assistant mappings without deleting them | `is_active` boolean column + toggle endpoint |
| TEN-05 | Admin can view list of all organizations and their status | Organizations list page + TanStack Table |
| AUTH-01 | Admin can log in with email and password via Supabase Auth | Supabase Auth email/password + `@supabase/ssr` `signInWithPassword` |
| AUTH-02 | Admin session persists across browser refreshes | Cookie-based session + middleware token refresh pattern |
| AUTH-03 | Admin can log out from any page | `supabase.auth.signOut()` + redirect to /login |
| AUTH-04 | Unauthenticated users are redirected to login page | Next.js middleware + `getClaims()` + redirect |
| AUTH-05 | User account is associated with an organization and role (admin/member) | `org_members` table + `user_roles` enum |
</phase_requirements>

---

## Summary

Phase 1 establishes the foundation that every subsequent phase depends on: multi-tenant data isolation (RLS), authentication, and organization management. The patterns here must be correct from day one — retrofitting RLS or changing the auth model mid-project is extremely painful.

The key insight from research: **Supabase Auth SSR for Next.js has changed its recommended API in late 2025**. The old `anon` key is being replaced by `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (format: `sb_publishable_xxx`), and `getSession()` in middleware is deprecated in favor of `getClaims()`, which validates the JWT signature locally. The docs are in transition but the new pattern is now canonical.

The second critical insight: **RLS multi-tenancy requires a `get_current_org_id()` helper function** that resolves the calling user's organization from a DB lookup (not JWT claims, which can be user-modified). This function is `SECURITY DEFINER` and is referenced in every RLS policy — establishing this correctly in migration 001 is the highest-risk task in the phase.

**Primary recommendation:** Build in the order: schema + RLS → auth clients + middleware → login/logout UI → org CRUD → assistant mappings. Each step depends on the previous.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (App Router) | Full-stack framework | Stable since Oct 2024; React 19; Vercel-optimized; Supabase guides are Next.js-first |
| TypeScript | 5.x (strict) | Type safety | Non-negotiable — strict mode catches RLS/auth bugs at compile time |
| `@supabase/supabase-js` | 2.101.1 | Supabase client | Standard client for DB, Auth, Storage; works in both Next.js and Edge |
| `@supabase/ssr` | 0.10.0 | Cookie-based SSR auth | Official package for Next.js App Router; handles token refresh in middleware |
| shadcn/ui | 4.1.2 (CLI) | Component library | Open-code model; official Data Table, Form, Sidebar guides; owns components |
| Tailwind CSS | 3.x | Styling | Co-installed with Next.js scaffold; shadcn/ui depends on it |
| `react-hook-form` | 7.72.0 | Form state | shadcn/ui official integration via `<Field />`; used for all admin forms |
| `zod` | 4.3.6 | Schema validation | Shared client/server schemas; validates form inputs and API responses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hookform/resolvers` | latest | Zod-RHF bridge | Always paired with react-hook-form + zod |
| `lucide-react` | latest | Icons | Default icon set for shadcn/ui; tree-shakeable |
| `sonner` | latest | Toast notifications | shadcn/ui built-in integration; action feedback |
| `@tanstack/react-table` | 8.21.3 | Data tables | Organization list, assistant mappings list |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | Manual cookie handling | @supabase/ssr is the official Supabase recommendation; handles edge cases with cookie headers and cache control |
| Email/password auth | OAuth / magic link | MVP decision: email/password only. OAuth is out of scope per requirements |
| No ORM (supabase-js + generated types) | Prisma or Drizzle | Supabase client handles typed queries via generated types; adding ORM adds complexity for no RLS benefit |

**Installation:**
```bash
# Create Next.js project
npx create-next-app@15 voiceops --typescript --tailwind --eslint --app --src-dir

# Supabase clients
npm install @supabase/supabase-js @supabase/ssr

# UI: forms + tables
npm install react-hook-form @hookform/resolvers zod @tanstack/react-table
npm install lucide-react sonner

# shadcn/ui init + components for Phase 1
npx shadcn@latest init
npx shadcn@latest add sidebar button card dialog sheet tabs input label form badge switch separator skeleton toast
```

**Version verification (checked 2026-04-02 against npm registry):**
- `next`: 16.2.2 is latest, but **use 15.x** — 16.x has breaking changes in params/cache model per project decision
- `@supabase/supabase-js`: 2.101.1 current stable
- `@supabase/ssr`: 0.10.0 current stable
- `react-hook-form`: 7.72.0 current stable
- `zod`: 4.3.6 current stable (zod v4 is a significant update from v3)
- `@tanstack/react-table`: 8.21.3 current stable

**Important:** Zod 4.x has breaking changes from 3.x. Since the project STACK.md specifies `zod` 3.x, pin to `zod@3` unless explicitly upgrading. Verify compatibility with `@hookform/resolvers`.

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Login form (email + password)
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar + header (requires auth)
│   │   ├── page.tsx              # Dashboard stub (redirect target)
│   │   └── organizations/
│   │       ├── page.tsx          # Organization list
│   │       └── [id]/
│   │           └── page.tsx      # Organization detail + assistant mappings
│   ├── api/
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts      # Supabase PKCE auth callback
│   ├── layout.tsx                # Root layout
│   └── middleware.ts             # Auth token refresh + route protection
├── components/
│   ├── ui/                       # shadcn/ui components (generated)
│   └── layout/
│       ├── app-sidebar.tsx       # Sidebar with nav items
│       └── sidebar-header.tsx    # Org name + user info
├── lib/
│   └── supabase/
│       ├── client.ts             # Browser client (createBrowserClient)
│       ├── server.ts             # Server client (createServerClient)
│       └── admin.ts              # Service role client (Vapi webhooks only)
├── types/
│   └── database.ts               # Supabase generated types
└── middleware.ts                  # Next.js middleware (token refresh + redirect)
```

### Pattern 1: Supabase Client Initialization

**Three distinct clients — use the right one in the right context:**

```typescript
// lib/supabase/client.ts — Browser Client Components only
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts — Server Components, Server Actions, Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — setAll handled by middleware
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/admin.ts — ONLY for Vapi webhook Edge Functions (no user JWT)
// NEVER import in browser code or dashboard pages
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

### Pattern 2: Middleware for Auth Protection

```typescript
// middleware.ts (src/middleware.ts or root middleware.ts)
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh token and validate JWT signature (preferred over getSession)
  const { data: { claims } } = await supabase.auth.getClaims()

  // Redirect unauthenticated users away from protected routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/')
    && !isAuthRoute
    && !request.nextUrl.pathname.startsWith('/_next')
    && !request.nextUrl.pathname.startsWith('/api/vapi') // Vapi webhooks bypass auth middleware

  if (isDashboardRoute && !claims) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login page
  if (isAuthRoute && claims) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Critical notes on middleware:**
- Use `getClaims()` — it validates JWT signature locally without a network round-trip
- `getSession()` is deprecated for server-side use — it does not validate signatures
- For user-existence checks (e.g., checking if account was deleted), use `getUser()` which makes a network call to verify with the auth server
- Exclude `/api/vapi/*` routes from auth middleware — Vapi webhooks authenticate via `x-vapi-secret` header, not user JWTs
- The March 2025 Next.js middleware security vulnerability is patched in Next.js 15.2.3+ — always use a patched version

### Pattern 3: RLS Multi-Tenant Isolation

**The `get_current_org_id()` helper function approach (preferred over JWT claims):**

```sql
-- Migration: 001_foundation.sql
-- Helper function: resolves the current user's organization from the DB
-- SECURITY DEFINER ensures it runs with elevated privileges
-- set search_path = '' prevents search path injection attacks
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id
  FROM public.org_members
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- Standard RLS policy template for every tenant-scoped table
-- Uses (select ...) wrapper for PostgreSQL initPlan optimization
-- This caches get_current_org_id() result per statement (not per row)
CREATE POLICY "org_isolation_select" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = (SELECT public.get_current_org_id()));

CREATE POLICY "org_isolation_insert" ON public.some_table
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "org_isolation_update" ON public.some_table
  FOR UPDATE
  TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "org_isolation_delete" ON public.some_table
  FOR DELETE
  TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));
```

**Why DB lookup over JWT claims:** JWT `raw_user_meta_data` can be modified by the user. Only `raw_app_meta_data` is server-controlled, but even that approach requires JWT refresh on org changes. DB lookup via `get_current_org_id()` is always current and cannot be spoofed.

### Pattern 4: Database Schema for Phase 1

```sql
-- Core schema for Phase 1
-- All tables follow the same conventions:
-- - UUID primary keys with gen_random_uuid()
-- - organization_id FK on every tenant-scoped table
-- - RLS enabled on all tables
-- - created_at / updated_at timestamps

-- organizations: the tenant root
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- org_members: links auth.users to organizations with roles
CREATE TYPE public.user_role AS ENUM ('admin', 'member');

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(organization_id);

-- assistant_mappings: links Vapi assistant IDs to organizations
CREATE TABLE public.assistant_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vapi_assistant_id TEXT NOT NULL,
  name TEXT,  -- human-readable label for the mapping
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vapi_assistant_id)  -- one assistant maps to exactly one org
);
ALTER TABLE public.assistant_mappings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assistant_mappings_org_id ON public.assistant_mappings(organization_id);
CREATE INDEX idx_assistant_mappings_vapi_id ON public.assistant_mappings(vapi_assistant_id);
-- ^^ This index is critical for the Action Engine (Phase 2) webhook org resolution
```

**Important:** The `assistant_mappings.vapi_assistant_id` index is load-bearing for Phase 2. The Action Engine resolves organizations by querying this column on every webhook call. Create it now.

### Pattern 5: shadcn/ui Sidebar Layout

```typescript
// app/(dashboard)/layout.tsx
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

The shadcn/ui `Sidebar` component (added late 2024) provides:
- Collapsible sidebar with persistent state via cookies
- Mobile sheet fallback
- `SidebarProvider` / `SidebarInset` layout primitives
- Navigation items with active state from `usePathname()`

### Anti-Patterns to Avoid

- **Using `getSession()` in middleware:** Deprecated — does not validate JWT signature. Use `getClaims()`.
- **Storing org_id in JWT `user_metadata`:** User-modifiable, creates privilege escalation risk. Use DB lookup via `get_current_org_id()`.
- **RLS policies without `(select ...)` wrapping:** `auth.uid() = user_id` evaluates per row. `(select auth.uid()) = user_id` evaluates once per statement. The performance difference is 20-100x on large tables.
- **Forgetting `WITH CHECK` on INSERT/UPDATE policies:** A `USING` clause alone allows reading the row but does not block inserting/updating with a different `organization_id`. Always pair `USING` with `WITH CHECK` for mutations.
- **Importing `admin.ts` (service role client) in browser code:** The service role key bypasses all RLS. It must only ever be used in server-side Edge Functions that receive Vapi webhooks.
- **Calling `supabase.auth.getUser()` in middleware:** Makes a network call to the auth server on every request. Use `getClaims()` for middleware (local JWT validation), reserve `getUser()` for cases requiring server-side session invalidation checks.
- **Missing indexes on `organization_id` columns:** Every tenant-scoped table needs an index on `organization_id`. Without it, RLS policies trigger full table scans.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based session refresh in SSR | Custom middleware token handling | `@supabase/ssr` `createServerClient` | Handles cache-control headers, cookie rotation, expiry — security-critical and easy to get wrong |
| JWT validation in middleware | Manual JWT decode + verify | `supabase.auth.getClaims()` | Cryptographic signature verification against project public keys; handles edge cases |
| Multi-tenant row filtering | Application-level `WHERE` clauses | Supabase RLS | RLS is enforced even when application code has bugs; can't be bypassed by accident |
| Form validation | Custom validation logic | `zod` + `@hookform/resolvers` | Shared schemas between client and server; Zod validates server API responses too |
| Admin layout with sidebar | Custom CSS sidebar | shadcn/ui `Sidebar` component | Production-ready with mobile fallback, cookie state, keyboard navigation |
| Password hashing | Custom bcrypt setup | Supabase Auth | Supabase handles password storage, hashing, reset flows, rate limiting |

**Key insight:** The auth + RLS layer has deep security edge cases. Every item in this list represents attack surface that Supabase has already secured. Custom solutions create compliance risk.

---

## Common Pitfalls

### Pitfall 1: RLS Silent Failures on SELECT
**What goes wrong:** A SELECT policy that returns no rows (due to wrong `organization_id`) returns an empty result — not an error. The application behaves as if the data doesn't exist.
**Why it happens:** RLS filters rows rather than raising exceptions. This is by design in PostgreSQL.
**How to avoid:** Write integration tests that verify cross-org queries return empty (not an error). When a query returns unexpectedly empty results in development, check RLS policies first.
**Warning signs:** Admin creates org A data, logs in as org B, page shows empty state with no error.

### Pitfall 2: Middleware Auth Redirect Loop
**What goes wrong:** The login page itself matches the middleware auth check, causing infinite redirect between `/login` → middleware redirect → `/login`.
**Why it happens:** Overly broad middleware matcher or forgetting to exclude `/login` from protected routes.
**How to avoid:** The middleware must explicitly allow unauthenticated access to `/login` and `/api/auth/*`. The `(auth)` route group is a layout grouping — it does not automatically bypass middleware.
**Warning signs:** Browser DevTools network tab shows repeated 307 redirects.

### Pitfall 3: RLS Blocks Vapi Webhooks
**What goes wrong:** The Action Engine (Phase 2) needs to resolve `organization_id` from `assistant_mappings` but the service role query is inadvertently wrapped in RLS because the client was created with the wrong key.
**Why it happens:** Using the anon key instead of service role key in the admin client, or importing the wrong Supabase client in the Edge Function.
**How to avoid:** Keep `lib/supabase/admin.ts` as the only place that creates a service role client. Never import `lib/supabase/server.ts` (user-scoped) in Vapi webhook handlers.
**Warning signs:** Phase 2 Action Engine returns empty results when looking up assistant mappings.

### Pitfall 4: `NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `PUBLISHABLE_KEY`
**What goes wrong:** Supabase is transitioning from `anon` key (format: `eyJ...`) to `publishable` key (format: `sb_publishable_xxx`). Official docs use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but older guides still use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Why it happens:** Documentation is in transition. Both keys work during the transition period.
**How to avoid:** Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the env var name consistently from project start. The `@supabase/ssr` package accepts either format.
**Warning signs:** Auth works locally but fails after switching docs examples.

### Pitfall 5: Missing `WITH CHECK` on INSERT Policies
**What goes wrong:** A malicious or buggy client sends `{"organization_id": "other_org_uuid"}` in an INSERT payload. Without `WITH CHECK`, the USING clause only filters reads — inserts bypass it.
**Why it happens:** Developers write SELECT-only RLS and forget mutations need `WITH CHECK`.
**How to avoid:** Every INSERT and UPDATE policy must have `WITH CHECK (organization_id = (SELECT public.get_current_org_id()))`. This prevents cross-tenant data injection.
**Warning signs:** Not obvious — requires explicit test of inserting with a different org_id.

### Pitfall 6: `org_members` RLS Circular Dependency
**What goes wrong:** `org_members` needs an RLS policy. But `get_current_org_id()` queries `org_members` to resolve the current org. If `org_members` RLS blocks the helper function, everything locks up.
**Why it happens:** `get_current_org_id()` is `SECURITY DEFINER` — it runs with the function owner's privileges, bypassing RLS on `org_members`. But only if defined correctly. Forgetting `SECURITY DEFINER` creates the circular dependency.
**How to avoid:** Verify `get_current_org_id()` uses `SECURITY DEFINER` and `SET search_path = ''`. Test by creating a fresh user with no org membership — the function should return NULL, not an error.

### Pitfall 7: Next.js 15 `cookies()` is Async
**What goes wrong:** `const cookieStore = cookies()` (synchronous) throws in Next.js 15. The correct form is `const cookieStore = await cookies()`.
**Why it happens:** Next.js 15 made several async APIs that were synchronous in 14 — `cookies()`, `headers()`, `params`, `searchParams`.
**How to avoid:** Always `await cookies()` and `await headers()` in Next.js 15 server code. TypeScript will error if you forget with strict mode enabled.
**Warning signs:** Runtime error: "cookies() should be awaited before using its value".

---

## Code Examples

### Login Form with React Hook Form + Zod + Supabase Auth

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginForm) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      form.setError('root', { message: error.message })
      return
    }
    router.push('/')
    router.refresh() // Force Server Components to re-fetch with new session
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input type="password" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
```

### Server Component: Fetch Organizations (RLS Scoped)

```typescript
// app/(dashboard)/organizations/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OrganizationsPage() {
  const supabase = await createClient()

  // Verify session — belt-and-suspenders beyond middleware
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS automatically scopes this to the current user's organization(s)
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return <OrganizationList organizations={organizations} />
}
```

### Logout Action

```typescript
// Server Action or Route Handler for logout
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Environment Variables (Phase 1)

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Server-side ONLY — never expose to client
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Phase 2+ (not needed in Phase 1, but define now)
# VAPI_WEBHOOK_SECRET=xxx
# OPENAI_API_KEY=sk-xxx
# VAPI_API_KEY=vapi_xxx
# ENCRYPTION_KEY=xxx
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_xxx`) | Late 2025 | Both work in transition; use new format |
| `supabase.auth.getSession()` in middleware | `supabase.auth.getClaims()` in middleware | 2024/2025 | `getSession()` does not validate JWT signature; `getClaims()` does |
| Next.js 14 `cookies()` synchronous | Next.js 15 `await cookies()` | Oct 2024 (Next.js 15 release) | Must await cookies/headers in App Router |
| `middleware.ts` export | `proxy.ts` export (Next.js 16 only) | Next.js 16 | Not relevant — project uses Next.js 15 |
| shadcn/ui manual sidebar | shadcn/ui `Sidebar` component | Late 2024 | Production-ready sidebar with state, mobile fallback |

**Deprecated/outdated:**
- `getSession()` in server code: Deprecated — does not verify JWT cryptographically. Replace with `getClaims()` for middleware, `getUser()` for critical auth checks.
- Synchronous `cookies()` call: Invalid in Next.js 15 — always `await cookies()`.

---

## Open Questions

1. **`NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `PUBLISHABLE_KEY` naming**
   - What we know: Supabase is migrating to `sb_publishable_xxx` key format. Both formats work during transition.
   - What's unclear: Whether the Supabase Dashboard for this project already shows the new `publishable` key or still shows the old `anon` key.
   - Recommendation: Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the env var name regardless. Accept whichever key format the Supabase Dashboard provides.

2. **Admin user seeding strategy**
   - What we know: Supabase Auth manages `auth.users`. The first admin user needs to exist before the app is useful.
   - What's unclear: Whether admin user creation is manual (Supabase Dashboard) or via a seed script.
   - Recommendation: Add a `supabase/seed.sql` that seeds a test org + test user in development. Production admin creation is manual via Supabase Dashboard for MVP.

3. **Organization "admin" scope — single org per user or multi?**
   - What we know: AUTH-05 says "User account is associated with an organization and role." The schema uses `org_members` with a `UNIQUE(user_id, organization_id)` constraint allowing one user in multiple orgs.
   - What's unclear: Whether in MVP an admin user manages all organizations (super-admin) or only their own org.
   - Recommendation: Implement super-admin pattern for MVP — the admin creates and manages all orgs. The `get_current_org_id()` returns the admin's primary org. When viewing other orgs, the admin uses a server-side service role query (not RLS). Revisit for multi-org management UI.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server, npm scripts | ✓ | v24.13.0 | — |
| npm | Package installation | ✓ | 11.6.2 | — |
| npx | `create-next-app`, `shadcn` CLI | ✓ | 11.6.2 | — |
| Supabase CLI | DB migrations, local dev, type gen | ✗ | — | Can use Supabase Dashboard SQL editor for migrations; type gen needed for TypeScript |
| Git | Version control | ✓ | (confirmed from git status) | — |
| Supabase project | Auth, DB, hosted backend | ? | — | Must be provisioned manually before dev starts |
| Vercel account | Deployment target | ? | — | Local dev unblocked; deploy is a later concern |

**Missing dependencies with no fallback:**
- Supabase CLI: Required for `supabase db push` (migration workflow) and `supabase gen types typescript` (TypeScript DB types). Install with: `npm install -g supabase` or use the official installer. Type generation is critical for TypeScript strict mode.
- Supabase project (hosted): Must be created at supabase.com before `.env.local` can be populated. Wave 0 must include this setup step.

**Missing dependencies with fallback:**
- Supabase CLI migration workflow: Fallback is using the Supabase Dashboard SQL editor to run migrations manually. Acceptable for early development but not recommended long-term.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended for Next.js 15 + TypeScript strict) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Note:** Jest is the conventional choice but Vitest has better ESM support and no Next.js config friction. For Phase 1, the most valuable tests are **Supabase RLS integration tests** using pgTap or direct SQL assertions. These require a live Supabase instance (local or hosted).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEN-01 | Org CRUD (create, update, deactivate) | Integration (API) | `npx vitest run tests/organizations.test.ts` | ❌ Wave 0 |
| TEN-02 | RLS: org A cannot read org B data | Integration (DB/RLS) | `npx vitest run tests/rls-isolation.test.ts` | ❌ Wave 0 |
| TEN-03 | Assistant mapping CRUD | Integration (API) | `npx vitest run tests/assistant-mappings.test.ts` | ❌ Wave 0 |
| TEN-04 | Toggle assistant mapping active/inactive | Integration (API) | `npx vitest run tests/assistant-mappings.test.ts` | ❌ Wave 0 |
| TEN-05 | Org list returns all orgs for admin | Integration (API) | `npx vitest run tests/organizations.test.ts` | ❌ Wave 0 |
| AUTH-01 | Email/password sign-in succeeds with valid creds | Integration (Auth) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | Session survives page refresh (cookie present) | E2E / manual | Manual browser test | N/A |
| AUTH-03 | Sign-out clears session and redirects to /login | Integration (Auth) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | Unauthenticated GET /organizations redirects to /login | Integration (middleware) | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| AUTH-05 | User creation links to org + role in org_members | Integration (DB) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |

### RLS Policies Requiring Integration Tests (not unit tests)

The following RLS policies cannot be validated by unit tests alone — they require a real Supabase instance with two distinct users in different organizations:

1. **`organizations` table:** User from Org A queries `organizations` — must return only Org A's record, not Org B's.
2. **`org_members` table:** User from Org A queries `org_members` — must return only Org A's members.
3. **`assistant_mappings` table:** User from Org A queries `assistant_mappings` — must not see Org B's mappings.
4. **INSERT with wrong `organization_id`:** User from Org A attempts to INSERT an `assistant_mapping` with `organization_id = org_b_id` — must be rejected by `WITH CHECK` policy.
5. **`get_current_org_id()` returns NULL:** A user with no `org_members` record — function returns NULL, all RLS policies return empty results (no error, no data).

**Test pattern for cross-org isolation:**
```typescript
// tests/rls-isolation.test.ts
// Uses two Supabase service-role clients + two test users in different orgs
// Step 1: Create org A, org B, user A (member of A), user B (member of B)
// Step 2: Authenticate as user A, create assistant_mapping for org A
// Step 3: Authenticate as user B, query assistant_mappings
// Assert: user B sees zero rows
// Step 4: user B attempts INSERT with org A's organization_id
// Assert: INSERT fails with RLS violation
```

### How to Verify Auth Middleware

**Middleware verification requires an HTTP-level test** — not a unit test of the middleware function itself:

1. **Unauthenticated redirect (AUTH-04):** Make a GET request to `/organizations` with no cookies. Assert 307 redirect to `/login?redirect=/organizations`.
2. **Authenticated pass-through:** Make a GET request to `/organizations` with a valid Supabase session cookie. Assert 200 (not redirect).
3. **Login page bypass:** Make a GET request to `/login` with no cookies. Assert 200 (no redirect loop).
4. **Login redirect for authenticated user:** Make a GET request to `/login` with a valid session cookie. Assert redirect to `/`.

These can be tested with Next.js's `createMockRequest` utilities or via Playwright/Puppeteer E2E tests. For Phase 1, a simple Playwright smoke test covers AUTH-04.

### Test Data Strategy for Multi-Tenant Isolation

**Isolation test setup pattern:**
```sql
-- seed for test environment only
-- Creates two completely isolated orgs with one admin user each
INSERT INTO public.organizations (id, name, slug) VALUES
  ('org-a-uuid', 'Test Org A', 'test-org-a'),
  ('org-b-uuid', 'Test Org B', 'test-org-b');

-- Create auth users via Supabase Auth API (not SQL directly)
-- Then link via org_members:
INSERT INTO public.org_members (user_id, organization_id, role) VALUES
  ('user-a-uuid', 'org-a-uuid', 'admin'),
  ('user-b-uuid', 'org-b-uuid', 'admin');

-- Seed test assistant mappings
INSERT INTO public.assistant_mappings (organization_id, vapi_assistant_id, name) VALUES
  ('org-a-uuid', 'vapi-assistant-aaa', 'Org A Assistant'),
  ('org-b-uuid', 'vapi-assistant-bbb', 'Org B Assistant');
```

**Key principle:** Test users must be created via `supabase.auth.admin.createUser()` (service role) in the test setup, then linked to orgs via the `org_members` table. Never mock auth — always use real Supabase sessions for RLS tests.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/rls-isolation.test.ts` (RLS gate — must pass before any new table is considered complete)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual AUTH-02 browser verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/rls-isolation.test.ts` — covers TEN-02 (cross-org isolation, core security requirement)
- [ ] `tests/auth.test.ts` — covers AUTH-01, AUTH-03, AUTH-05
- [ ] `tests/organizations.test.ts` — covers TEN-01, TEN-05
- [ ] `tests/assistant-mappings.test.ts` — covers TEN-03, TEN-04
- [ ] `tests/middleware.test.ts` — covers AUTH-04
- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `tests/setup.ts` — Supabase test client setup, test org/user seeding/teardown
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react` — if not already installed

---

## Sources

### Primary (HIGH confidence)
- [Supabase Auth SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` patterns, `getClaims()` vs `getSession()`, `createServerClient`, middleware setup
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) — Policy syntax, `(select auth.uid())` optimization, WITH CHECK patterns
- [Supabase Creating SSR Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — Client type patterns
- [Supabase getClaims vs getSession GitHub Issue #40985](https://github.com/supabase/supabase/issues/40985) — Clarification on when to use each method

### Secondary (MEDIUM confidence)
- [MakerKit Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — `SECURITY DEFINER` helper function pattern, `has_role_on_account` pattern, pgTap testing approach (verified against official Supabase RLS docs)
- [WebSearch: Next.js 15 middleware auth patterns 2025](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) — Matcher patterns, March 2025 vulnerability patch in 15.2.3+
- Project planning documents (ARCHITECTURE.md, STACK.md, SUMMARY.md) — HIGH confidence (written 2026-03-30 from official sources)

### Tertiary (LOW confidence)
- [shadcn/ui sidebar admin dashboard patterns 2025/2026 search results](https://adminlte.io/blog/build-admin-dashboard-shadcn-nextjs/) — General patterns verified against shadcn/ui official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-02
- Auth patterns: HIGH — verified against official Supabase SSR docs; getClaims/getSession distinction verified from GitHub issue
- RLS patterns: HIGH — verified against official Supabase RLS docs and confirmed by MakerKit production guide
- Schema design: HIGH — follows established project architecture decisions from ARCHITECTURE.md
- Middleware: HIGH — verified from official Next.js docs; CVE patch version confirmed
- Test strategy: MEDIUM — framework choice (Vitest) is a recommendation; pgTap vs Vitest for RLS tests is a valid debate

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — stable stack, but Supabase auth key migration is ongoing)

**Zod version flag:** Project STACK.md specifies `zod` 3.x. npm shows 4.3.6 as current. Zod 4 has breaking changes. The plan should pin `zod@3` explicitly unless a deliberate upgrade decision is made.
