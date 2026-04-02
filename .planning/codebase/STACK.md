# Tech Stack

**Analysis Date:** 2026-04-02
**Project Status:** Pre-implementation (planning phase — no source code exists yet)

---

## Runtime & Language

**Primary Language:**
- TypeScript 5.x — strict mode enforced (`"strict": true`). No `any`, no `@ts-ignore` allowed per development rules.

**Runtime Environments:**
- Node.js 20.x — Next.js serverless functions and local development (CI uses `node-version: '20'`)
- Deno (Supabase Edge Functions runtime) — All `/api/vapi/*` webhook routes run in Deno. Uses `npm:` imports via `import_map.json`, NOT `node_modules`.

**Package Manager:**
- npm — `npm ci` used in CI pipeline. Lockfile: `package-lock.json` (planned; not yet present)

---

## Frameworks & Libraries

**Core Framework:**
- Planned: Next.js 15.x (App Router) — Full-stack framework. SSR, API Route Handlers, Edge runtime support. Bootstrapped via `npx create-next-app@15 voiceops --typescript --tailwind --eslint --app --src-dir`.

**UI:**
- Planned: React 19.x — Ships with Next.js 15. Server Components used to reduce client bundle.
- Planned: shadcn/ui (latest) — Open-code component library. Admin panel building blocks: Sidebar, Dialog, Sheet, Tabs, Badge, DataTable. Components owned by the project (not a black-box dependency).
- Planned: Tailwind CSS — Co-installed with Next.js scaffold. shadcn/ui depends on it.
- Planned: lucide-react (latest) — Default icon set for shadcn/ui. Tree-shakeable.
- Planned: sonner (latest) — Toast notifications. Integrated with shadcn/ui.

**Tables & Forms:**
- Planned: `@tanstack/react-table` 8.x — Headless data table engine. Used for calls list, campaigns, contacts, action logs, knowledge base documents. shadcn/ui Data Table guide uses this.
- Planned: `react-hook-form` 7.x — Form state management. All forms: org settings, tool config, credential management, campaign creation. Integrated with shadcn/ui `<Field />`.
- Planned: `@hookform/resolvers` (latest) — Zod resolver bridge for React Hook Form.
- Planned: `zod` 3.x — Schema validation shared between client and server. Validates Vapi webhook payloads, form inputs, API responses.

**Data & Utilities:**
- Planned: `date-fns` 3.x — Date formatting and manipulation. Call timestamps, campaign scheduling, log filters. Tree-shakeable.
- Planned: `papaparse` 5.x — CSV parsing for outbound campaign contact list imports.
- Planned: `nuqs` (latest) — URL search params state management. Table filter and pagination state persisted in URL. Works with Next.js App Router.

---

## Build & Tooling

**Type Checking:**
- TypeScript strict mode. CI runs `npx tsc --noEmit` as a gate before deploy.

**Linting & Formatting:**
- Planned: ESLint — Standard Next.js config with strict TypeScript rules.
- Planned: Prettier — Standard formatting. `npm run lint` enforced in CI.

**Development Tools:**
- Planned: Supabase CLI — Local development, database migrations (`supabase db push`), Edge Function local serving (`supabase functions serve`), TypeScript type generation (`supabase gen types typescript`).
- Planned: Vapi CLI — Webhook testing. `vapi listen --forward-to localhost:3000/webhook` for local development.
- Planned: ngrok — Local tunnel required for Vapi CLI webhook forwarding to local server.

**Build:**
- Planned: Vercel CLI — Used in CI pipeline (`vercel build --prod`, `vercel deploy --prebuilt --prod`).
- Config file: `next.config.ts`
- Tailwind config: `tailwind.config.ts`
- TypeScript config: `tsconfig.json`

---

## Infrastructure & Deployment

**Hosting:**
- Planned: Vercel — Zero-config Next.js deployment. Edge Functions for Vapi webhook routes. Preview deployments on pull requests. Production deploys on push to `main`.

**CI/CD:**
- Planned: GitHub Actions
  - `.github/workflows/deploy.yml` — Triggered on push to `main`. Steps: lint → type check → build → Vercel production deploy.
  - `.github/workflows/preview.yml` — Triggered on pull requests to `main`. Steps: lint → type check → Vercel preview deploy.
  - Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
  - Node.js version pinned to 20 in all workflow steps.

**Database & Backend Platform:**
- Planned: Supabase (hosted) — Replaces multiple services in a single platform:
  - PostgreSQL 15+ (primary database with RLS for multi-tenant isolation)
  - Supabase Auth (user authentication and session management)
  - Supabase Storage (file storage for uploaded knowledge base documents)
  - pgvector extension (vector embeddings for RAG knowledge base)
  - Supabase Realtime (Postgres Changes — for real-time campaign monitoring)
  - Supabase Edge Functions (Deno runtime — used for Vapi webhook receivers)

**Critical Architectural Constraint — Edge Functions:**
- All `/api/vapi/*` routes MUST run as Edge Functions (`export const runtime = 'edge'`). Reason: Vapi is latency-sensitive; cold starts on serverless functions break live call experience. Edge Functions are globally distributed with no cold start.
- Heavy/async processing uses `EdgeRuntime.waitUntil()` — Edge Function responds to Vapi immediately (<500ms), delegates slow work to background.
- Supabase Edge Functions (Deno, co-located with DB) are preferred over Vercel Edge Functions to avoid the extra network hop to the database.

---

## Key Dependencies

**Supabase clients:**
- Planned: `@supabase/supabase-js` 2.x — Primary Supabase client for all DB/Auth/Storage operations. Works in Next.js and Supabase Edge Functions (via `npm:@supabase/supabase-js@2`).
- Planned: `@supabase/ssr` (latest) — Cookie-based SSR auth for Next.js. `createServerClient` in Server Components and middleware, `createBrowserClient` in Client Components.

**Voice AI:**
- Planned: `@vapi-ai/server-sdk` 0.11.x — Official TypeScript SDK for Vapi API (assistant management, calls, outbound campaigns, tool management). Full type coverage. Compatible with Node 18+, Deno, Edge runtimes.

**AI / Embeddings:**
- Planned: `openai` 4.x — Used exclusively for generating vector embeddings (`text-embedding-3-small`, 1536 dimensions) for the RAG knowledge base. Used in Supabase Edge Functions via `npm:openai@4`.

**Encryption:**
- Planned: Custom `src/lib/encryption.ts` — Encrypts integration credentials (API keys, tokens) before storing in the `integrations` table. Requires `ENCRYPTION_KEY` environment variable. Never stores plain text credentials in production.

**No ORM:**
- `supabase-js` with generated TypeScript types (`supabase gen types typescript`) is used directly. No Prisma or Drizzle — adding an ORM layer on top of the Supabase client adds complexity without benefit given RLS policies are SQL-first.

---

## Environment Variables

```
# Next.js / Vercel environment
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL (public)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # Supabase anon/publishable key (public)
SUPABASE_SERVICE_ROLE_KEY         # Service role key — server-side only, NEVER expose to client

# Supabase Edge Function secrets (set via Supabase CLI)
VAPI_WEBHOOK_SECRET               # HMAC secret for Vapi webhook signature verification
OPENAI_API_KEY                    # For text-embedding-3-small embeddings generation
VAPI_API_KEY                      # Vapi API key for outbound campaign calls
VAPI_PHONE_NUMBER_ID              # Vapi phone number ID for outbound dialing

# Encryption
ENCRYPTION_KEY                    # Key for encrypting integration credentials at rest
```

Note: `.env` file presence noted but contents are not read. Configure these in Vercel project settings and Supabase CLI for Edge Functions.

---

*Stack analysis: 2026-04-02*
*Source: VOICEOPS_MASTER_PROMPT.md, .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/PROJECT.md*
