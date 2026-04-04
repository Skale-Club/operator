# Deployment Target

## Hosting split

- Vercel Hobby hosts the Next.js app, including dashboard routes, server actions, and `/api/vapi/*` route handlers running on Node.js.
- Supabase hosts Postgres, Auth, Storage, pgvector, and Edge Functions for background processing.
- GitHub Actions is used only for low-risk scheduled maintenance, such as keeping Supabase awake.

## Canonical origin

The definitive production origin is `https://voiceops.skale.club`.

Use that host when constructing first-party public URLs, including:

- App access URLs
- Vapi server URLs
- External callbacks that target VoiceOps
- Documentation examples for production webhook setup

Canonical webhook endpoints:

- `https://voiceops.skale.club/api/vapi/tools`
- `https://voiceops.skale.club/api/vapi/calls`
- `https://voiceops.skale.club/api/vapi/campaigns`

## Rules

- Do not depend on Vercel Edge Runtime for core product features.
- Do not depend on Vercel Cron for product scheduling.
- Keep Vapi webhooks fast, but make them Node.js-compatible.
- Move background processing and future product-critical scheduling to Supabase.
- Use GitHub Actions only for auxiliary jobs that can tolerate schedule jitter.
- Do not publish preview deployment URLs, localhost addresses, or legacy external relay hosts as the production webhook target when `voiceops.skale.club` is available.

## Current status

- `src/app/api/vapi/*` runs on `runtime = 'nodejs'`.
- Auth gating happens in layouts and route handlers instead of middleware.
- Supabase background processing already exists in `supabase/functions/process-embeddings`.
- GitHub keepalive workflow exists at `.github/workflows/supabase-keepalive.yml`.
