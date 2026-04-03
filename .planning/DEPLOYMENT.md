# Deployment Target

## Hosting split

- Vercel Hobby hosts the Next.js app, including dashboard routes, server actions, and `/api/vapi/*` route handlers running on Node.js.
- Supabase hosts Postgres, Auth, Storage, pgvector, and Edge Functions for background processing.
- GitHub Actions is used only for low-risk scheduled maintenance, such as keeping Supabase awake.

## Rules

- Do not depend on Vercel Edge Runtime for core product features.
- Do not depend on Vercel Cron for product scheduling.
- Keep Vapi webhooks fast, but make them Node.js-compatible.
- Move background processing and future product-critical scheduling to Supabase.
- Use GitHub Actions only for auxiliary jobs that can tolerate schedule jitter.

## Current status

- `src/app/api/vapi/*` runs on `runtime = 'nodejs'`.
- Auth gating happens in layouts and route handlers instead of middleware.
- Supabase background processing already exists in `supabase/functions/process-embeddings`.
- GitHub keepalive workflow exists at `.github/workflows/supabase-keepalive.yml`.
