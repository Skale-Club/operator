# Coding Conventions

**Analysis Date:** 2026-04-02
**Status:** Pre-implementation — all conventions are planned/mandated in project documentation. No source code exists yet.

---

## Code Style

**Language:**
- TypeScript throughout — no JavaScript files in `src/`
- Planned: TypeScript `strict` mode enabled in `tsconfig.json` — no `any`, no `@ts-ignore`

**Formatting:**
- Planned: Prettier (initialized via `create-next-app@15 --eslint`)
- Planned: ESLint with standard Next.js config + strict TypeScript rules

**Linting commands:**
```bash
npm run lint          # ESLint check
npx tsc --noEmit      # Type check (run in CI before build)
```

**Key style rules (from VOICEOPS_MASTER_PROMPT.md §11):**
- No `any` types — TypeScript strict mode is a hard rule, not a preference
- No `@ts-ignore` — fix the type, don't suppress the error
- Error handling on every external call — no unhandled promise rejections
- Every external call must log + have a fallback result

---

## Naming Conventions

**Files:**
- Route handlers: `route.ts` (Next.js App Router convention)
- Page components: `page.tsx`
- Layout components: `layout.tsx`
- Client components: `[feature-name].tsx` (kebab-case)
- Server utilities: `[name].ts` (kebab-case)
- Type definitions: `types.ts` or `[domain].types.ts`

**Directories:**
- App routes: kebab-case matching URL path segments (`end-of-call/`, `tools/`)
- Feature grouping: kebab-case (`src/lib/actions/`, `src/components/calls/`)
- Route groups (auth-gated): parentheses notation `(auth)/`

**Variables and functions:**
- Planned: camelCase for variables and functions
- Planned: PascalCase for React components and TypeScript types/interfaces
- Planned: SCREAMING_SNAKE_CASE for environment variable names

**Database:**
- Table names: snake_case plural (`call_logs`, `action_logs`, `tools_config`)
- Column names: snake_case (`organization_id`, `vapi_assistant_id`, `created_at`)
- Policy names: descriptive strings (`"org_isolation"`, `"Users see own org data"`)

**Code and commits in English** — UI may become bilingual PT/EN in the future but all source code, commits, and comments are English only.

---

## File Organization

**Canonical directory layout** (from `VOICEOPS_MASTER_PROMPT.md §9`):

```
src/
├── app/
│   ├── (auth)/                         # Auth-gated route group
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/                      # All authenticated pages
│   │   ├── page.tsx
│   │   ├── assistants/page.tsx
│   │   ├── integrations/page.tsx
│   │   ├── tools/page.tsx
│   │   ├── tools/[id]/page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── outbound/page.tsx
│   │   ├── outbound/[id]/page.tsx
│   │   ├── calls/page.tsx
│   │   └── calls/[id]/page.tsx
│   ├── api/
│   │   ├── vapi/                       # Edge Function routes (runtime = 'edge')
│   │   │   ├── tools/route.ts
│   │   │   ├── end-of-call/route.ts
│   │   │   └── status/route.ts
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── assistants/
│   │   ├── integrations/
│   │   ├── tools/
│   │   ├── knowledge/
│   │   ├── outbound/
│   │   ├── calls/
│   │   └── analytics/
│   └── layout.tsx
├── components/
│   ├── ui/                             # shadcn/ui base components (owned, not from node_modules)
│   ├── dashboard/                      # Dashboard-specific components
│   ├── calls/                          # Transcript, timeline, action badges
│   └── tools/                          # Visual Tool builder components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client (createBrowserClient)
│   │   ├── server.ts                   # Server Component client (createServerClient)
│   │   └── admin.ts                    # Service role client — Edge Functions only
│   ├── vapi/
│   │   ├── types.ts                    # Vapi payload TypeScript types
│   │   └── outbound.ts                 # Outbound campaign API functions
│   ├── actions/                        # Action executor modules (pluggable registry)
│   │   ├── ghl.ts                      # GoHighLevel executor
│   │   ├── twilio.ts                   # Twilio executor
│   │   ├── cal.ts                      # Cal.com executor
│   │   ├── webhook.ts                  # Generic webhook executor
│   │   └── knowledge.ts                # RAG knowledge base executor
│   ├── embeddings.ts                   # OpenAI embedding generation
│   └── encryption.ts                   # AES-256-GCM credential encryption (Web Crypto)
├── hooks/                              # Custom React hooks
└── types/                              # Global TypeScript type definitions
```

**Database migrations:**
```
supabase/
└── migrations/
    └── 001_initial_schema.sql          # Complete table SQL with RLS policies
```

**Where to add new code:**
- New action executor (e.g., HubSpot): `src/lib/actions/hubspot.ts`
- New dashboard page: `src/app/dashboard/[feature]/page.tsx`
- New API route (serverless): `src/app/api/[feature]/route.ts`
- New Vapi webhook route (Edge Function): `src/app/api/vapi/[event]/route.ts` — must include `export const runtime = 'edge'`
- New shared UI component: `src/components/ui/[name].tsx` (via `npx shadcn@latest add`)
- New database table: `supabase/migrations/00N_description.sql` with RLS policy included in same migration

---

## Edge Function vs Serverless Function Split

This is a hard architectural rule, not a preference:

**Edge Functions (`export const runtime = 'edge'`) — ALL `/api/vapi/*` routes:**
- `src/app/api/vapi/tools/route.ts`
- `src/app/api/vapi/end-of-call/route.ts`
- `src/app/api/vapi/status/route.ts`

Constraints apply in these files:
- No Node.js `fs`, `path`, `crypto.createHash` — use Web Crypto API (`crypto.subtle`)
- No `require()` — ES module imports only
- No heavy SDK imports — prefer `fetch` for REST APIs
- Bundle limit: 2MB after gzip
- Must use `EdgeRuntime.waitUntil()` for fire-and-forget background tasks

**Serverless Functions (default Node.js runtime) — all other `/api/*` routes:**
- Full npm ecosystem available
- No cold-start constraint
- Used for admin CRUD, document processing, analytics

---

## Environment Variables

**Naming:**
- `NEXT_PUBLIC_` prefix only for variables safe to expose to the browser
- Never prefix secrets with `NEXT_PUBLIC_`

**Required variables (from `VOICEOPS_MASTER_PROMPT.md §8`):**
```bash
# Safe to expose (browser-accessible)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# Server-only — never expose to client
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
VAPI_API_KEY
VAPI_PHONE_NUMBER_ID
ENCRYPTION_KEY
VAPI_WEBHOOK_SECRET
```

---

## Database Conventions

**Every table must have:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID REFERENCES organizations(id) NOT NULL` (except `organizations` itself and `users`)
- `created_at TIMESTAMPTZ DEFAULT now()`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- A policy using the `org_isolation` pattern

**RLS policy pattern (mandatory):**
```sql
-- Always wrap auth.uid() in (select ...) for performance
CREATE POLICY "org_isolation" ON table_name
  FOR ALL
  TO authenticated
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = (select auth.uid())
  ));
```

**Index pattern (mandatory):**
```sql
-- Every table with organization_id must have this index
CREATE INDEX idx_tablename_org_id ON table_name USING btree (organization_id);
-- High-volume log tables also need time-based index
CREATE INDEX idx_tablename_created_at ON table_name USING btree (created_at DESC);
```

---

## Error Handling

**Mandatory pattern for all external API calls:**
```typescript
try {
  result = await executeAction(toolConfig, toolArgs);
  await logAction(callId, orgId, toolName, 'success', toolArgs, result, elapsed);
} catch (error) {
  await logAction(callId, orgId, toolName, 'error', toolArgs, null, elapsed, error.message);
  result = {
    message: toolConfig.fallback_message || "Sorry, I had a technical issue."
  };
}
```

**Rules:**
- Every external call (GHL, Twilio, Cal.com, OpenAI) must be wrapped in try/catch
- Errors must always be logged to `action_logs`
- Vapi webhooks must always return a valid response — never let an unhandled error bubble up and return a 500 with no body

---

## UI Conventions

**Component library:** shadcn/ui (open-code — components live in `src/components/ui/`, are fully owned and editable)

**Credential display:** Always show `••••••` for saved credentials. Only reveal on explicit "Show" action. Never return full credential values from API responses.

**Human-readable action logs:** Display parsed summaries (`"Created contact John Doe in GoHighLevel"`) not raw JSON. Raw payloads available via "View full payload" expansion.

**Loading states:** Skeleton loaders with progress indication — no indefinite spinners without feedback.

---

## Git Workflow

**Branch strategy:** `none` (per `.planning/config.json`) — direct commits to main during early development.

**Commit language:** English only. No Portuguese in commit messages or code.

**CI pipeline (planned — `.github/workflows/deploy.yml`):**
- Trigger: push to `main`
- Steps: lint → type check (`tsc --noEmit`) → build → deploy to Vercel production

**Preview deployments (planned — `.github/workflows/preview.yml`):**
- Trigger: pull request to `main`
- Steps: lint → type check → build → deploy Vercel preview URL

---

## Documentation Standards

**In-code documentation:**
- Planned: comments explaining non-obvious decisions (especially RLS patterns, Edge Runtime constraints, encryption logic)
- No comments for self-explanatory code

**Planning documents live in `.planning/`** — updated at phase transitions and milestones. Do not duplicate planning content into code comments.

**SQL migrations:** Each migration file is self-contained with table creation, indexes, and RLS policies in the same file.

---

*Convention analysis: 2026-04-02*
