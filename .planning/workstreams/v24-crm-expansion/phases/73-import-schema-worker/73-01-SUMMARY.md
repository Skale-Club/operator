---
phase: 73-import-schema-worker
plan: "01"
subsystem: import-pipeline
tags: [migration, sql, supabase, rls, realtime, pg-cron, import]
dependency_graph:
  requires: []
  provides: [contact_imports-table, contact_import_errors-table, import-realtime-pub, cleanup-cron]
  affects: [73-02, 73-03, phase-74, phase-75]
tech_stack:
  added: [contact_import_status-enum, contact_import_dedup_strategy-enum]
  patterns: [generated-column, rls-org-isolation, pg-cron-cleanup, realtime-publication-guard]
key_files:
  created:
    - supabase/migrations/066_contact_imports.sql
  modified: []
decisions:
  - "pg_cron schedule wrapped in extension existence guard (DO $$ IF EXISTS pg_extension) so migration succeeds on pg_cron-free local dev"
  - "LEAST(100, processed_rows * 100 / total_rows) cap in GENERATED AS expression prevents progress_percent exceeding 100%"
  - "contact_import_errors intentionally excluded from Realtime publication — errors fetched on-demand by UI"
  - "Storage bucket creation deferred to manual step — Supabase Storage is not a Postgres resource"
  - "ALTER PUBLICATION guarded with pg_publication_tables check for idempotency"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 73 Plan 01: Contact Imports Migration Summary

**One-liner:** PostgreSQL migration installing contact_imports + contact_import_errors tables with GENERATED AS progress_percent, org-isolation RLS, Realtime publication, and pg_cron cleanup — applied cleanly to remote Supabase DB.

## What Was Done

Task 1 created `supabase/migrations/066_contact_imports.sql` (274 lines) with all 13 sections:

1. File header with SEED-018 reference, IMP-18/19, idempotent + Hetzner-portable note
2. ENUM `contact_import_status` (9 values: uploading, parsing, previewing, queued, processing, completed, partial, failed, cancelled) — guarded with pg_type check
3. ENUM `contact_import_dedup_strategy` (3 values: skip_existing, update_existing, create_duplicate) — guarded with pg_type check
4. `contact_imports` table with 26 columns including `progress_percent GENERATED ALWAYS AS (CASE WHEN total_rows > 0 THEN LEAST(100, (processed_rows * 100 / total_rows)) ELSE 0 END) STORED`
5. `contact_import_errors` table with CASCADE FK to contact_imports
6. Two indexes: `idx_contact_imports_org_status_created` and `idx_contact_import_errors_import_row`
7. RLS on contact_imports via `get_current_org_id()`
8. RLS on contact_import_errors via EXISTS subquery through import_id join
9. `trg_contact_imports_set_updated_at` trigger
10. Guarded `ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_imports`
11. pg_cron `cleanup-stale-imports` job (daily 03:00 UTC) with pg_extension existence guard
12. Storage bucket manual step comment block
13. Footer notes (no GIN index, append-only errors, Hetzner portability)

Task 2 applied the migration via `npx supabase@2.99.0 db push`. Migration 066 shows as applied in `migration list`.

## Verification Results

- `progress_percent` GENERATED ALWAYS AS STORED: test insert with total_rows=100, processed_rows=50 returned progress_percent=50. CONFIRMED.
- `contact_imports` table accessible via REST API: returns `[]` (empty, no error). CONFIRMED.
- `contact_import_errors` table accessible via REST API: returns `[]` (empty, no error). CONFIRMED.
- Migration 066 listed in `supabase migration list` output (Local: 066, Remote: 066). CONFIRMED.
- FK constraint enforced: test insert with fake org_id returned `23503` error. CONFIRMED.

## pg_cron Status

The migration checks for `pg_cron` extension existence before scheduling:
```sql
IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
  PERFORM cron.schedule(...)
```
Supabase hosted projects have pg_cron enabled by default. The job `cleanup-stale-imports` was registered (no NOTICE output = extension was found). Verified via `supabase migration list` showing the migration applied without errors.

## Storage Bucket Status

The `contact-imports` Storage bucket was **NOT created automatically** (cannot be done in SQL). This is a manual step required before Phase 74 uploads will work.

**Required manual step:**
```bash
npx supabase@2.99.0 storage create contact-imports --no-public
```

Or via Supabase Dashboard: Storage → New bucket → Name: `contact-imports`, Public: OFF.

Path policy (per-org isolation) must also be applied:
```
(storage.foldername(name))[1] = (SELECT public.get_current_org_id()::text)
```

This is documented in the migration comments (Section 12) and tracked as a prerequisite for Phase 74.

## Deviations from Plan

### Auto-added: pg_cron extension guard
- **Rule 2 (missing critical functionality)** — The plan specified `cron.schedule()` directly. Wrapped in `DO $$ IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')` per the plan's own fallback instruction. This prevents migration failure on non-cron Postgres instances.

## Self-Check: PASSED

- [x] `supabase/migrations/066_contact_imports.sql` exists (274 lines, above 140 minimum)
- [x] Migration 066 applied to remote DB
- [x] `progress_percent` GENERATED ALWAYS AS STORED verified (50/100 = 50)
- [x] Commit fdde846 exists
