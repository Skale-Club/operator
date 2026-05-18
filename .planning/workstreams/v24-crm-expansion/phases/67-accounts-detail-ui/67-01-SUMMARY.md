---
phase: 67-accounts-detail-ui
plan: "01"
subsystem: accounts-crm
tags: [accounts, crm, detail-page, server-component, tabs, contacts]
dependency_graph:
  requires: [66-accounts-list-ui]
  provides: [accounts-detail-page, account-detail-header, account-contacts-tab]
  affects: [contacts-linking, account-navigation]
tech_stack:
  added: []
  patterns: [server-component, rls-scoped-query, shadcn-tabs, relativeTime-helper, initialsOf-helper]
key_files:
  created:
    - src/app/(dashboard)/accounts/[id]/page.tsx
    - src/app/(dashboard)/accounts/[id]/actions.ts
    - src/components/accounts/account-detail-header.tsx
    - src/components/accounts/account-contacts-tab.tsx
  modified: []
decisions:
  - "Contacts tab uses full ContactRow select (all columns) instead of partial select to satisfy the ContactRow type alias from database.ts — avoids type widening issues"
  - "AccountContactsTab accepts a narrower ContactItem interface (6 fields) for props to match plan spec exactly; cast from ContactRow to ContactItem is safe via structural subtyping"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-18"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 67 Plan 01: Account Detail Page Shell + Contacts Tab Summary

One-liner: `/accounts/[id]` server component shell with company metadata header, three-tab layout (Contacts live, Opportunities + Activities placeholders for 67-02), and `getAccountDetail` RLS-scoped action returning account + linked contacts.

## What Was Built

### `getAccountDetail` Server Action (`src/app/(dashboard)/accounts/[id]/actions.ts`)

New `'use server'` module. Auth-gated via `getUser()`. Uses `Promise.all` to:
1. Fetch the account row by id (`.maybeSingle()`, returns `not_found` on null)
2. Fetch all linked contacts (`account_id = id`, ordered by `name ASC`)

Returns `ActionResult<{ account: AccountRow; contacts: ContactRow[] }>`. RLS-scoped — no manual `org_id` filter.

### `AccountDetailHeader` (`src/components/accounts/account-detail-header.tsx`)

Server component. Renders a `rounded-[12px] border border-border bg-bg-secondary p-6` card matching the pipeline opportunity hero pattern with:
- Eyebrow breadcrumb: `Building2` icon + "CRM / Companies"
- `<h1>` with `account.name`
- Pill grid for `domain` (Globe icon), `industry`, `size`, `tags` — each only rendered when non-null/non-empty
- Secondary row: `phone` (tel: link), `website` (external link), `address` (text) — conditional on presence
- Footer: "Added {relativeTime}" using existing `@/lib/pipeline/format` helper

### `AccountContactsTab` (`src/components/accounts/account-contacts-tab.tsx`)

Server component. Props: `contacts: ContactItem[]`, `accountId: string`.

- Header row: contact count text + "Add contact" `<Button asChild variant="secondary" size="sm">` linking to `/contacts/new?account_id=[id]&from=/accounts/[id]` (D-07 locked decision)
- Empty state: centered card "No contacts linked to this company yet." + helper text
- Contacts list: `divide-y divide-border-subtle` container; each row is a `<Link href={/contacts?id=...}>` with `Avatar` initials (`initialsOf`), name, phone/email concatenated, `relativeTime` timestamp

### Page Shell (`src/app/(dashboard)/accounts/[id]/page.tsx`)

Server component. Awaits `params`, calls `getAccountDetail(id)`, calls `notFound()` on failure. Renders:
- Back button → `/accounts`
- `<AccountDetailHeader account={account} />`
- `<Tabs defaultValue="contacts">` with three triggers: Contacts (count), Opportunities, Activities
- Contacts tab: `<AccountContactsTab contacts={contacts} accountId={id} />`
- Opportunities + Activities tabs: placeholder text "Coming in next plan" (67-02)

## Deviations from Plan

None — plan executed exactly as written.

The `ContactRow` type alias approach used a full-column select rather than a named-column partial to avoid type narrowing complexity. The `AccountContactsTab` uses a structural `ContactItem` interface for props rather than the full `ContactRow` to match the plan spec — the full row is passed from the page and structurally satisfies the interface.

## Known Stubs

- **Opportunities tab** (`src/app/(dashboard)/accounts/[id]/page.tsx`, TabsContent `opportunities`): placeholder text "Coming in next plan" — intentional, resolved in 67-02
- **Activities tab** (`src/app/(dashboard)/accounts/[id]/page.tsx`, TabsContent `activities`): placeholder text "Coming in next plan" — intentional, resolved in 67-02

Neither stub prevents the plan goal (ACC-08 account detail view with Contacts tab) from being achieved.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/(dashboard)/accounts/[id]/page.tsx
- FOUND: src/app/(dashboard)/accounts/[id]/actions.ts
- FOUND: src/components/accounts/account-detail-header.tsx
- FOUND: src/components/accounts/account-contacts-tab.tsx

Commit: 5c66e43 — feat(phase-67): add account detail page shell + Contacts tab (ACC-08)

Build: Passed — `/accounts/[id]` route appears in build output, zero TypeScript errors in new files.
