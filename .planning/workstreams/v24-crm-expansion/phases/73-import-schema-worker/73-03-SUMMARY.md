---
phase: 73-import-schema-worker
plan: "03"
subsystem: import-pipeline
tags: [testing, vitest, rls, realtime, schema, contact-imports, seed-018]
dependency_graph:
  requires: [73-01, 73-02]
  provides: [tests/import-schema.test.ts]
  affects: []
tech_stack:
  added: []
  patterns: [pg client for system catalog queries, service-role client for setup/teardown, anon JWT clients for cross-org RLS assertions]
key_files:
  created: [tests/import-schema.test.ts]
  modified: []
decisions:
  - "pg_cron group skipped with describe.skip (not a TODO) — pg_cron not available on this Supabase instance; documented in 73-01-SUMMARY; cleanup ships in Phase 75"
  - "pg_publication_tables queried via pg client (direct DB URL) — not accessible via supabase-js REST client which does not expose system catalogs"
  - "Generated-column rejection test uses pg client (direct SQL) because supabase-js silently strips unrecognized columns before sending to REST API"
  - "Cross-org RLS tests use full JWT impersonation: two real orgs + two real users created via admin.auth.admin.createUser, signed in with anon clients"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18"
  tasks_completed: 1
  files_created: 1
requirements: [IMP-18, IMP-19]
---

# Phase 73 Plan 03: Import Schema Tests Summary

**One-liner:** Vitest schema suite for contact_imports — 15 passing tests cover progress_percent math (5 cases), cross-org RLS for imports and errors (7 assertions), Realtime publication membership (2 assertions), and ON DELETE CASCADE (1 assertion).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write and pass tests/import-schema.test.ts | f2abfef | tests/import-schema.test.ts |

## Final Test Results

```
Test Files  1 passed (1)
     Tests  15 passed | 3 skipped (18)
  Duration  11.02s
```

### Test Breakdown

| Group | Description | Tests | Result |
|-------|-------------|-------|--------|
| 1 | progress_percent GENERATED ALWAYS AS STORED | 5 | All passed |
| 2 | contact_imports RLS cross-org isolation | 4 | All passed |
| 3 | contact_import_errors RLS cross-org isolation | 3 | All passed |
| 4 | Realtime publication — pg_publication_tables | 2 | All passed |
| 5 | pg_cron job existence | 3 | Skipped (expected) |
| 6 | ON DELETE CASCADE | 1 | Passed |

## Implementation Decisions

### System Catalog Query Approach

**pg_publication_tables queries:** Used the `pg` client (direct DB connection via `SUPABASE_DB_URL`) with raw SQL. The supabase-js REST client does not expose system catalogs (`pg_publication_tables`, `pg_policy`, `pg_class`, etc.) — they are only accessible via direct PostgreSQL connections. This matches the pattern established in `tests/accounts-schema.test.ts`.

**Generated-column rejection test:** Also used the `pg` client with raw SQL (`INSERT ... progress_percent = 99`). The supabase-js client silently strips columns it does not recognize before sending to the PostgREST endpoint, which would cause the test to pass vacuously (no error returned, column simply omitted). The `pg` client sends the exact column name and receives Postgres error code 42601 / message "cannot insert a non-DEFAULT value into column 'progress_percent'".

### RLS Cross-Org Test Strategy

Used **full JWT impersonation** — the same approach as `tests/accounts-schema.test.ts`:
1. Service-role creates two real orgs + two real users (`admin.auth.admin.createUser`)
2. Users are assigned to their respective orgs via `org_members`
3. Two anon clients sign in with `signInWithPassword` — their JWTs carry the user identity
4. Supabase evaluates `get_current_org_id()` via the `user_active_org` table (first membership fallback)
5. All assertions run against live RLS — no mocking

This approach proves that the RLS policy enforces real tenant isolation end-to-end, not just the policy definition syntax.

### pg_cron Group (Skipped)

The pg_cron test group (`describe.skip`) is intentionally skipped, not a TODO:

- `pg_cron` extension is not installed on this Supabase project
- Migration 066 guard raised `NOTICE: pg_cron extension not available — cleanup-stale-imports job NOT scheduled`
- The `describe.skip` block preserves the test bodies as documentation of what Phase 75 must verify once the Edge Function cleanup replaces the cron approach
- Documented in 73-01-SUMMARY.md § "pg_cron Availability"

## Deviations from Plan

None — plan executed exactly as written. The pg_cron skip was anticipated by the critical constraints in the execute prompt and the 73-01-SUMMARY findings.

## Known Stubs

None.

## Self-Check

- [x] `tests/import-schema.test.ts` exists (318 lines)
- [x] `npx vitest run tests/import-schema.test.ts` exits 0
- [x] 15 tests passed, 3 skipped (pg_cron — expected)
- [x] Commit f2abfef exists
