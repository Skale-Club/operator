# Opps

Opps is a multi-tenant operations layer for agencies running voice AI assistants with Vapi. It gives each client organization its own tools, integrations, knowledge base, outbound campaigns, and call observability inside one admin panel, with Supabase RLS enforcing tenant isolation at the data layer.

The platform is intentionally designed as a configurable integration and orchestration layer, not as a single hardcoded voice workflow. In practice, each client organization can have its own assistant mappings, provider credentials, tool behaviors, outbound flows, and follow-up actions while still running on the same product foundation.

The current codebase reflects a shipped `v1.0` MVP completed on `2026-04-03`. The product focus is simple: when Vapi triggers a tool during a live call, Opps must resolve the right organization, execute the action, and return a result fast enough for production call flows.

The canonical production origin for the app and all first-party webhooks is `https://opps.skale.club`.

## What It Does

- Maps Vapi assistants to tenant organizations
- Stores per-organization integration credentials with AES-256-GCM encryption
- Executes tool-triggered business logic for live calls
- Supports client-specific operational workflows built from shared primitives instead of one fixed universal call flow
- Logs tool executions with timing, payloads, and outcomes
- Ingests completed call data for observability
- Provides dashboard metrics, call history, filters, and call detail views
- Uploads and embeds knowledge documents for tenant-scoped semantic search
- Runs outbound calling campaigns with CSV contact import and status tracking

## Product Framing

Opps should be understood as the shared platform underneath many per-client automations.

- The product owns tenant resolution, credential storage, tool execution, observability, and outbound infrastructure.
- A concrete workflow such as "find appointments in 1 hour, call to confirm, then notify the owner by SMS" is a client-specific orchestration built on top of those primitives.
- Not every customer will use the same sequence, providers, or post-call actions, so avoid documenting example workflows as if they are mandatory product-wide behavior.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript 5 in strict mode
- Supabase for Postgres, Auth, RLS, and pgvector
- Tailwind CSS 4 and shadcn/ui
- Vitest for tests
- Vapi for voice assistant and outbound call integration

## Architecture At A Glance

### Runtime split

- Node.js: dashboard pages, server actions, and `src/app/api/vapi/*` webhook routes
- Deno: Supabase Edge Function in [`supabase/functions/process-embeddings/index.ts`](/c:/Users/Vanildo/Dev/opps/supabase/functions/process-embeddings/index.ts)
- GitHub Actions: low-frequency maintenance cron like [`.github/workflows/supabase-keepalive.yml`](C:/Users/Vanildo/Dev/opps/.github/workflows/supabase-keepalive.yml)

### Core flow

1. Vapi sends a tool-call webhook to [`src/app/api/vapi/tools/route.ts`](/c:/Users/Vanildo/Dev/opps/src/app/api/vapi/tools/route.ts).
2. Opps resolves the organization from the assistant mapping.
3. The configured tool and provider credentials are loaded for that tenant.
4. The action executes and returns a result to Vapi.
5. Execution logging is deferred asynchronously so the webhook still returns quickly.

This hot path is the shared execution substrate for tenant-specific workflows. The platform is expected to support different action combinations and orchestration patterns per organization rather than enforce a single universal business flow.

### Canonical public URLs

Use `https://opps.skale.club` as the definitive public base URL for the product.

- App origin: `https://opps.skale.club`
- Vapi tool-call webhook: `https://opps.skale.club/api/vapi/tools`
- Vapi end-of-call webhook: `https://opps.skale.club/api/vapi/calls`
- Vapi campaign webhook: `https://opps.skale.club/api/vapi/campaigns`

When configuring Vapi server URLs, external callbacks, or customer-specific integrations that call into Opps, prefer these canonical URLs over temporary Vercel preview URLs or other legacy webhook hosts.

### Tenant model

- Every tenant-facing table is protected with Supabase RLS.
- Active org context is resolved with the `get_current_org_id()` database function.
- The current org is also cached in the `vo_active_org` cookie for fast navigation.

## Main Product Areas

- `Calls`: observability, filters, transcripts, tool execution visibility
- `Campaigns`: outbound calling flows and contact status tracking
- `Tools`: per-org action configuration used by Vapi tool calls
- `Knowledge`: document upload, chunking, embeddings, semantic retrieval
- `Assistants`: mapping Vapi assistants to organizations with a friendly internal display name
- `Integrations`: encrypted credentials and provider configuration
- `Organizations`: tenant management and org switching

Across these areas, the design goal is composability: the same base capabilities should support many client-specific operational playbooks.

## Integration Conventions

- When linking a Vapi assistant into Opps, always store a human-friendly assistant name alongside the Vapi assistant ID.
- Prefer the same readable name your team already uses in Vapi.
- Do not use raw UUIDs, timestamps, or generated test labels as the primary assistant label in Opps.
- Treat the Vapi assistant ID as a routing key, not as the user-facing identifier.
- Assistant mappings should make it easy to jump back to the assistant in Vapi when debugging or reviewing configuration.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env

Copy `.env.local.example` to `.env.local` and fill in the base app values.

Required app-level values used by the current code:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_SECRET=
VAPI_API_KEY=
```

Notes:

- `ENCRYPTION_SECRET` must be a 64-character hex string.
- `VAPI_API_KEY` is required for outbound campaign and Vapi API helpers.
- OpenAI, Anthropic, OpenRouter, and most Vapi credentials are designed to be configured per organization in the `Integrations` area and stored encrypted in the database.
- `.env.example` still includes `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` placeholders, but the current app flow primarily reads provider keys from tenant integrations rather than global env vars.

### 3. Apply database migrations

```bash
npx supabase db push
```

Migrations live in [`supabase/migrations`](/c:/Users/Vanildo/Dev/opps/supabase/migrations).

### 4. Run the app

```bash
npm run dev
```

The root route redirects to `/calls`.

## Deployment Target

- Vercel Hobby: hosts the Next.js app with Node.js route handlers
- Supabase: Postgres, Auth, Storage, pgvector, and background Edge Functions
- GitHub Actions: auxiliary scheduled automation only

This repo is aligned to avoid depending on Vercel Edge Runtime or Vercel Cron for core product flows.

Production traffic should terminate at `https://opps.skale.club`. Treat that host as the stable public address for app access, Vapi webhooks, and any first-party webhook construction.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npx vitest
npx supabase db push
```

`npm run build` is the best single verification pass here because it also catches type issues.

## Testing

Tests live in [`tests`](/c:/Users/Vanildo/Dev/opps/tests) and run under Vitest in a Node environment. The current suite covers multi-tenancy, auth, calls, campaigns, integrations, knowledge base behavior, and action-engine flows.

Run all tests with:

```bash
npx vitest
```

## Repository Layout

```text
src/
  app/
    (auth)/            login flow
    (dashboard)/       protected product areas
    api/vapi/          Vapi-facing webhook routes
    api/campaigns/     campaign control endpoints
    api/knowledge/     upload helpers
  components/          UI and feature components
  lib/
    action-engine/     tool resolution and execution
    campaigns/         outbound campaign logic
    ghl/               GoHighLevel integration helpers
    knowledge/         text extraction, chunking, embeddings, retrieval
    supabase/          cached server/client/admin helpers
  types/               database and Vapi types
supabase/
  migrations/          numbered SQL migrations
  functions/           Supabase Edge Functions
skills/
  vapi/                local skill for Vapi API usage and conventions
  ghl/                 local skill for GoHighLevel integration patterns
tests/                 Vitest test suite
.planning/             roadmap, state, milestone archive, and phase artifacts
```

The `skills/` folder is the repo-local library for reusable integration skills. Add new provider-specific skills there as Opps gains more integrations.

## Planning Folder

This repo keeps delivery context in [`.planning`](/c:/Users/Vanildo/Dev/opps/.planning):

- [`PROJECT.md`](/c:/Users/Vanildo/Dev/opps/.planning/PROJECT.md): product definition, validated requirements, active gaps, key decisions
- [`STATE.md`](/c:/Users/Vanildo/Dev/opps/.planning/STATE.md): current milestone state and immediate next priorities
- [`MILESTONES.md`](/c:/Users/Vanildo/Dev/opps/.planning/MILESTONES.md): milestone history
- [`milestones/`](/c:/Users/Vanildo/Dev/opps/.planning/milestones): archived roadmap, requirements, audits, and phase outputs
- [`RETROSPECTIVE.md`](/c:/Users/Vanildo/Dev/opps/.planning/RETROSPECTIVE.md): lessons learned across milestones

Current state from planning docs:

- `v1.0` MVP is complete
- 6 phases and 30 plans were executed
- next likely priorities are webhook security, `send_sms`, `custom_webhook`, and client-facing access

## Known Gaps

The planning documents currently call out these notable follow-ups:

- Vapi webhook HMAC or secret validation is not implemented yet
- `send_sms` and `custom_webhook` action types are still stubs
- campaign calls do not automatically appear in the observability list yet
- full human UAT and production migration rollout still need completion

## Important Engineering Constraints

- Vapi webhook routes must stay fast and always return HTTP 200 to Vapi
- Do not bypass cached auth helpers in [`src/lib/supabase/server.ts`](/c:/Users/Vanildo/Dev/opps/src/lib/supabase/server.ts)
- Do not store provider secrets in plaintext
- Do not edit old Supabase migrations; add new numbered migrations instead
- Keep Vercel-hosted routes Node.js-compatible; background work belongs in Supabase or GitHub automation
- Build first-party webhook URLs against `https://opps.skale.club`, not against preview deployments, localhost, or legacy external webhook relays

## Additional Repo Guidance

- [`CLAUDE.md`](/c:/Users/Vanildo/Dev/opps/CLAUDE.md): concise repo-specific coding instructions
- [`AGENTS.md`](/c:/Users/Vanildo/Dev/opps/AGENTS.md): working agreement for AI coding agents and automation
