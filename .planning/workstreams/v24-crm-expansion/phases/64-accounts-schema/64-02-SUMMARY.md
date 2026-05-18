---
phase: 64-accounts-schema
plan: 02
subsystem: types
tags: [typescript, database-types, supabase, crm, accounts, schema]

# Dependency graph
requires:
  - phase: 64-01
    provides: 064_accounts.sql migration applied to remote DB (accounts table, contacts.account_id, opportunities.account_id, opp_has_contact_or_account CHECK)
provides:
  - Database['public']['Tables']['accounts'] Row/Insert/Update/Relationships
  - Database['public']['Tables']['contacts']['Row'].account_id (string | null)
  - Database['public']['Tables']['opportunities']['Row'].account_id (string | null)
  - AccountSource literal union type ('manual' | 'auto_from_contact_company' | 'csv_import' | 'ghl_sync')
  - FK relationship entries: accounts_org_id_fkey, contacts_account_id_fkey, opportunities_account_id_fkey
affects: [64-03, 65-accounts-actions, 66-accounts-list-ui, 67-accounts-detail-ui, 68-customfields-schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-maintained Database interface (Supabase CLI generation not used per file header comment + project convention)"
    - "Literal union types for source enums kept at the top of database.ts next to ContactSource (single canonical location for cross-file imports)"
    - "Table types ordered alphabetically near siblings — accounts inserted directly after contacts (its closest semantic neighbor)"
    - "Update blocks omit immutable columns (id, org_id, created_by, created_at) — matches existing contacts/opportunities convention"

key-files:
  created:
    - .planning/workstreams/v24-crm-expansion/phases/64-accounts-schema/64-02-SUMMARY.md
  modified:
    - src/types/database.ts

key-decisions:
  - "Placed accounts table type immediately after contacts (line 1449) rather than at the end of Tables — keeps related CRM entity types adjacent for readability"
  - "Update block on accounts omits id/org_id/created_by/created_at (immutable post-insert) — matches the existing convention used by contacts and opportunities Update blocks"
  - "Did NOT regenerate via Supabase CLI — followed the project convention (the file header comment is aspirational; the file has been hand-maintained through 60+ migrations and is the canonical source for TS consumers)"

patterns-established:
  - "When adding a new table type that depends on a literal union: declare the union near the existing union cluster at the top of the file, then reference it inside the table block. Do not inline literal unions inside table types."

requirements-completed: [ACC-14, ACC-15]

# Metrics
duration: 5min
completed: 2026-05-18
---

# Phase 64 Plan 02: Database Types Update Summary

**Hand-extended `src/types/database.ts` with the accounts table type, AccountSource literal union, and account_id FK column on contacts and opportunities — matching the schema applied by migration 064_accounts.sql.**

## Performance

- **Duration:** ~5 min (file edits ~1 min, `npm run build` ~5 min including TypeScript pass at 2.8 min + static generation)
- **Tasks:** 1 (single-task plan)
- **Files modified:** 1 (`src/types/database.ts`)
- **Lines added:** 90 (per `git show --stat 385abcf` → `1 file changed, 90 insertions(+)`)

## Accomplishments

- Added `AccountSource` literal union at line 32, immediately after `ContactSource` at line 29
- Added `account_id: string | null` to `contacts` Row (line 1395), `account_id?: string | null` to Insert (line 1411) and Update (line 1423)
- Added `contacts_account_id_fkey` relationship entry at line 1441 (pointing to `accounts.id`)
- Added complete `accounts` table type starting at line 1449 with all 18 columns from migration 064 in declaration order: id, org_id, name, domain, website, industry, size, phone, address, notes, tags, custom_fields, external_id, source, assigned_to, created_by, created_at, updated_at
- `accounts.Row.name: string` (NOT NULL, no `| null`) — mirrors `name text NOT NULL` in the migration
- `accounts.Row.source: AccountSource` — typed via the new literal union
- `accounts.Relationships` includes `accounts_org_id_fkey` at line 1508 (to `organizations.id`)
- Added `account_id: string | null` to `opportunities` Row (line 1844), `account_id?: string | null` to Insert (line 1861) and Update (line 1881)
- Added `opportunities_account_id_fkey` relationship entry at line 1910 (pointing to `accounts.id`)
- `npm run build` succeeded with exit code 0 (TypeScript compilation: 2.8 min; full build: ~5 min). No type errors emitted at any existing call site of `contacts` or `opportunities` Insert/Update — both new fields are optional so the addition is backward-compatible.

## Edit Anchor Points (line numbers after the commit)

| Edit | What | Approx. line | Verified via grep |
|------|------|-------------:|-------------------|
| 1 | `export type AccountSource = ...` (after ContactSource) | 32 | `export type AccountSource` |
| 2a | `contacts` Row `account_id: string \| null` | 1395 | inside `contacts:` block |
| 2b | `contacts` Insert `account_id?: string \| null` | 1411 | inside `contacts:` block |
| 2c | `contacts` Update `account_id?: string \| null` | 1423 | inside `contacts:` block |
| 2d | `contacts_account_id_fkey` Relationship entry | 1441 | `contacts_account_id_fkey` |
| 4 | `accounts:` table type block start | 1449 | `^      accounts: {` |
| 4 | `accounts_org_id_fkey` in `accounts` Relationships | 1508 | `accounts_org_id_fkey` |
| 3a | `opportunities` Row `account_id: string \| null` | 1844 | inside `opportunities:` block |
| 3b | `opportunities` Insert `account_id?: string \| null` | 1861 | inside `opportunities:` block |
| 3c | `opportunities` Update `account_id?: string \| null` | 1881 | inside `opportunities:` block |
| 3d | `opportunities_account_id_fkey` Relationship entry | 1910 | `opportunities_account_id_fkey` |

## Task Commits

1. **Task 1: Add AccountSource union + accounts table type + account_id on contacts/opportunities** — `385abcf` (feat)

_Plan metadata commit (SUMMARY + STATE + ROADMAP) follows below._

## Files Created/Modified

- `src/types/database.ts` — +90 lines (additive only, no rewrites of existing types)
- `.planning/workstreams/v24-crm-expansion/phases/64-accounts-schema/64-02-SUMMARY.md` — this file

## Decisions Made

- **Type-block placement:** `accounts` inserted directly after `contacts` rather than at the end of `Tables`. CRM entity types are kept adjacent. Alphabetical ordering is not enforced elsewhere in this file (e.g., `unified_calls` sits between `contacts` and `opportunities` for historical reasons), so insertion at the semantically-related position is consistent with the file's existing organization.
- **`accounts.Update` shape:** omits `id`, `org_id`, `created_by`, `created_at` (immutable post-insert). Matches the convention used by `contacts.Update` and `opportunities.Update`. `assigned_to` IS included in Update because it can change post-insert (re-assignment).
- **`name` in Update is required if present, but optional:** `name?: string` (not `name?: string | null`) — the migration declares `name text NOT NULL` so a Partial update may omit name, but cannot set it to NULL.
- **No CLI regeneration:** The file's header still says "replace with Supabase CLI output", but in practice this file has been hand-maintained for 60+ migrations and is the canonical TS source. Regenerating now would risk reshaping unrelated tables and breaking 200+ consumer files. The plan's `<critical_constraints>` confirmed this stance.

## Deviations from Plan

**None.** All four edits applied exactly as specified in the plan. The verify regex passed first try ("OK 5/5 patterns present") and `npm run build` exited 0 on the first attempt.

## Issues Encountered

**None at the type level.** The build completed cleanly. The build log emits some `[redis] error:` lines during the static page generation step (62 routes); these are runtime warnings from a Redis client that's not configured in this env — they don't affect the build outcome (Next.js still emitted "✓ Generating static pages using 7 workers (62/62)" and exited 0). They are unrelated to Phase 64 and pre-date this plan. Not tracked as a deferred item because they're harmless build-time noise.

The pre-existing `Module not found` errors flagged in Plan 64-01's `deferred-items.md` are now **resolved** — the `npm install` mentioned in the prompt context fixed them, which is why the full build runs to completion in this plan (it could not in 64-01).

## Verification Evidence

- **Automated regex check (plan-supplied):** `OK 5/5 patterns present` ✅
  - `AccountSource` union: matched
  - `accounts:` table block with `name: string` and `source: AccountSource`: matched
  - `accounts_org_id_fkey`: matched
  - `contacts_account_id_fkey`: matched
  - `opportunities_account_id_fkey`: matched
- **`npm run build`:** exit code 0 ✅
  - Widget builds: 27ms, 26ms (both ✓)
  - Next.js compile: 80s
  - TypeScript: 2.8 min
  - Static generation: 62/62 routes
- **Column count on `accounts.Row`:** 18 columns in the exact order specified by SEED-016 / migration 064 ✅
- **Nullability check on `accounts.Row`:** id, org_id, name, source, created_at, updated_at are `string` (NOT NULL); tags is `string[]` (default `'{}'`); custom_fields is `Record<string, unknown>` (default `'{}'::jsonb`); all other 10 columns are `... | null` ✅
- **Pre/post-existing call sites of Insert/Update:** none broken by the additive change (build emitted no TS errors).

## User Setup Required

None.

## Next Phase Readiness

- **Plan 64-03 (Vitest schema tests):** ready. Test files can now import `Database['public']['Tables']['accounts']` and reference `AccountSource` from `@/types/database`. The contacts/opportunities types expose `account_id` for assertions about RLS, CHECK, and idempotency.
- **Phase 65 (accounts server actions):** ready. The `Insert` and `Update` types accept all 18 columns with proper optionality (id/org_id/source/timestamps optional on Insert; name required; assigned_to/created_by nullable). Server actions can be authored directly against these types without further regeneration.
- **Future migrations adding columns to accounts/contacts/opportunities:** follow this same hand-extension pattern. Re-running `npx supabase gen types` against the live DB is the long-term escape hatch but should be deferred until a planned types reset is scheduled (would touch 200+ consumer files).

---
*Phase: 64-accounts-schema*
*Completed: 2026-05-18*

## Self-Check: PASSED

- `src/types/database.ts` — FOUND (modified, contains AccountSource at line 32, accounts block at line 1449, account_id on contacts at line 1395, account_id on opportunities at line 1844)
- Commit `385abcf` — FOUND in `git log --oneline` (`feat(phase-64): add accounts types + account_id on contacts/opportunities`)
- Automated regex check: "OK 5/5 patterns present"
- `npm run build`: exit code 0
