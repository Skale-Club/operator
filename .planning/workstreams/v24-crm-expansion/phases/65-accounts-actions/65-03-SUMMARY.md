---
phase: 65-accounts-actions
plan: 03
subsystem: app/dashboard/accounts
tags: [accounts, server-actions, merge, linking, acc-16]
dependency_graph:
  requires: [65-01, 65-02]
  provides: [mergeAccounts, linkContactToAccount, createAccountFromContact]
  affects: [65-04, 65-05, 66, 67]
tech_stack:
  added: []
  patterns:
    - "Sequential three-step merge with documented non-atomic risk"
    - "{ count: 'exact' } captures affected row counts in one round-trip per step"
    - "Idempotent recovery — retrying mergeAccounts converges from any partial state"
    - "ILIKE %/_ escape `trimmedName.replace(/[%_]/g, '\\\\$&')` reused from getAccounts (Plan 65-02)"
    - "Explicit `.eq('org_id', orgIdData)` forces planner to use idx_accounts_org_name composite index"
key_files:
  created: []
  modified:
    - src/app/(dashboard)/accounts/actions.ts
decisions:
  - "mergeAccounts is non-atomic by design (brief §13). Three sequential calls: UPDATE contacts → UPDATE opportunities → DELETE accounts. Partial-state error responses include `details.partial_state.{moved_contacts, moved_opportunities}` so callers can retry or report progress. A future Postgres RPC can wrap these in BEGIN/COMMIT post-v2.4."
  - "createAccountFromContact does NOT clear `contacts.company` (brief §17). The legacy column stays populated as a one-milestone revertibility window (ACC-14 contract)."
  - "createAccountFromContact filters by `.eq('org_id', orgIdData)` explicitly even though RLS already scopes — this is required for the planner to pick the idx_accounts_org_name composite index over a seq scan + RLS filter on large orgs."
  - "Defensive JS-side exact-match filter on existingMatches: after the ilike call returns candidates, we filter again with JS `toLowerCase()` and sort by id lexicographically. Belt-and-suspenders against Postgres collation surprises on unusual unicode."
metrics:
  duration_minutes: ~2
  completed: 2026-05-18
---

# Phase 65 Plan 03: accounts merge + linking server actions Summary

`src/app/(dashboard)/accounts/actions.ts` now exports **three additional** server actions, bringing the file to 8 total exports (5 CRUD from Plan 65-02 + 3 from this plan). The merge action implements ACC-16 end-to-end; the linking helpers are scaffolding consumed by Phase 66/67 UI.

## File

- `src/app/(dashboard)/accounts/actions.ts` — **521 lines** (up from 271 after Plan 65-02; +250 lines).

## All 8 Exported Function Signatures

```typescript
// From Plan 65-02
export async function getAccounts(filters?): Promise<ActionResult<AccountListResult>>
export async function getAccount(id): Promise<ActionResult<AccountWithCounts>>
export async function createAccount(input): Promise<ActionResult<AccountRow>>
export async function updateAccount(id, input): Promise<ActionResult<AccountRow>>
export async function deleteAccount(id): Promise<ActionResult<{ deleted: string }>>

// New in Plan 65-03
export async function mergeAccounts(
  input: MergeAccountsInput,
): Promise<ActionResult<MergeAccountsResult>>

export async function linkContactToAccount(
  input: LinkContactToAccountInput,
): Promise<ActionResult<{ contact_id: string; account_id: string }>>

export async function createAccountFromContact(
  input: CreateAccountFromContactInput,
): Promise<ActionResult<AccountRow>>
```

## Worked Example: mergeAccounts

Starting state (in one org):

| accounts                          | contacts                                  | opportunities                     |
| --------------------------------- | ----------------------------------------- | --------------------------------- |
| primary (id=P)                    | c1 → P                                    | (none on P)                       |
| secondary-1 (id=S1)               | c2 → S1, c3 → S1                          | o1 → S1                           |
| secondary-2 (id=S2)               | c4 → S2, c5 → S2                          | o2 → S2                           |

Call: `mergeAccounts({ primaryId: P, secondaryIds: [S1, S2] })`

Result:

```json
{
  "ok": true,
  "data": {
    "moved_contacts": 4,
    "moved_opportunities": 2,
    "deleted_accounts": 2
  }
}
```

Final state: P now has 5 contacts (c1..c5) and 2 opportunities (o1, o2). S1 and S2 are deleted. The CHECK constraint `opp_has_contact_or_account` is never tripped because step 2 rewrites `account_id` from secondary→primary (never NULL) and step 3's `ON DELETE SET NULL` fires against zero referencing rows.

## Partial-State Error Reporting

If step 2 (opportunities UPDATE) fails after step 1 (contacts UPDATE) succeeded:

```json
{
  "ok": false,
  "error": "transient network error",
  "details": {
    "message": "transient network error",
    "partial_state": { "moved_contacts": 3 }
  }
}
```

If step 3 (accounts DELETE) fails after both step 1 and step 2 succeeded:

```json
{
  "ok": false,
  "error": "transient network error",
  "details": {
    "message": "transient network error",
    "partial_state": {
      "moved_contacts": 3,
      "moved_opportunities": 2
    }
  }
}
```

**Recovery contract:** Re-calling `mergeAccounts` with the same input converges to a clean state — the UPDATEs are idempotent (already-moved rows match zero times on retry), and the DELETE is idempotent (already-deleted rows match zero times). The brief explicitly accepts this trade-off and defers atomic execution to a post-v2.4 Postgres RPC.

## ILIKE Escape Pattern Shipped in createAccountFromContact

```typescript
const escapedName = trimmedName.replace(/[%_]/g, '\\$&')

await supabase
  .from('accounts')
  .select('*')
  .eq('org_id', orgIdData)   // forces planner to use idx_accounts_org_name
  .ilike('name', escapedName) // %/_ escaped — exact case-insensitive match
```

This matches the canonical pattern already in `getAccounts` (Plan 65-02). A company name like `50% Off Holdings` or `Acme_Co` now matches exactly instead of over-matching via the wildcard semantics.

## Build Verification

`npm run build` exits 0. Next.js production compile + TypeScript strict mode pass.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `mergeAccounts` exported and implements 3-step sequence (UPDATE contacts → UPDATE opportunities → DELETE accounts)
- [x] Each step uses `{ count: 'exact' }` to capture affected rows
- [x] Step 2 + step 3 errors include `details.partial_state` documenting what already committed
- [x] `linkContactToAccount` exported, updates `contacts.account_id`, returns updated FK
- [x] `createAccountFromContact` exported, uses ilike with `%/_` escape AND `.eq('org_id', orgIdData)` filter
- [x] `createAccountFromContact` returns `'contact_has_no_company'` when legacy column is null/empty
- [x] `createAccountFromContact` uses `source: 'auto_from_contact_company'` (matches migration 064 data-block label)
- [x] `actions.ts` does NOT clear `contacts.company` anywhere (brief §17)
- [x] `actions.ts` does NOT contain unescaped `.ilike('name', trimmedName)` calls
- [x] File line count 521 (>= 350 minimum)
- [x] `npm run build` exits 0
