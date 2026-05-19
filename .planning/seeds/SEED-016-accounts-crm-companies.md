---
id: SEED-016
status: shipped
shipped_in: v2.4
planted: 2026-05-18
planted_during: post-v2.1, before CRM Expansion milestone
trigger_when: start of next CRM milestone (v2.3+); must precede SEED-017 (Custom Fields)
scope: Medium
depends_on: none
---

# SEED-016: Accounts — Companies as First-Class CRM Entity

Promote `contacts.company` (free-text string) to a proper `accounts` entity. Companies become first-class citizens: contacts belong to an account, opportunities can optionally point directly at an account (B2B deals without a specific contact), and the account detail page aggregates all related contacts, opportunities, and activities.

**Naming:** `accounts` in code/DB (Salesforce/HubSpot pattern, no collision with Xphere's `organizations` table which is the tenant boundary). UI label is **"Companies"** in English, **"Empresas"** if a PT-BR locale is ever added.

## Schema

```sql
accounts (
  id uuid PK,
  org_id uuid FK -> organizations (RLS via get_current_org_id()),
  name text NOT NULL,
  domain text,                -- e.g. "acme.com" (lookup by contact email domain)
  website text,
  industry text,              -- free enum per org (populated via custom field options in SEED-017)
  size text,                  -- enum: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'
  phone text,
  address text,
  notes text,
  tags text[],
  custom_fields jsonb DEFAULT '{}'::jsonb,  -- prepared for SEED-017
  external_id text,           -- ID in GHL/Pipedrive when imported
  source text,                -- 'manual' | 'auto_from_contact_company' | 'csv_import' | 'ghl_sync'
  assigned_to uuid FK -> auth.users,
  created_by uuid FK -> auth.users,
  created_at, updated_at
)

-- Indexes
idx_accounts_org_name (org_id, lower(name))     -- search + dedup
idx_accounts_org_domain (org_id, domain)        -- lookup by contact email domain

-- contacts changes
ALTER TABLE contacts ADD COLUMN account_id uuid FK -> accounts NULL;
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
-- contacts.company text stays nullable as fallback for one milestone (SEED-016 decision)

-- opportunities changes (B2B deals without contact_id)
ALTER TABLE opportunities ADD COLUMN account_id uuid FK -> accounts NULL;
CREATE INDEX idx_opportunities_account_id ON opportunities(account_id);
-- At least one of contact_id OR account_id must be present (CHECK constraint)
ALTER TABLE opportunities ADD CONSTRAINT opp_has_contact_or_account
  CHECK (contact_id IS NOT NULL OR account_id IS NOT NULL);
```

## Data migration — `contacts.company` -> `accounts`

Migration runs **once** per existing org, idempotent:
```sql
-- 1. Collect distinct existing companies
WITH distinct_companies AS (
  SELECT org_id, TRIM(company) AS name
  FROM contacts
  WHERE company IS NOT NULL AND TRIM(company) <> ''
  GROUP BY org_id, TRIM(company)
)
-- 2. Insert as accounts (skip rows already present from a prior run)
INSERT INTO accounts (org_id, name, source, created_at, updated_at)
SELECT dc.org_id, dc.name, 'auto_from_contact_company', now(), now()
FROM distinct_companies dc
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a
  WHERE a.org_id = dc.org_id AND lower(a.name) = lower(dc.name)
);

-- 3. Link contacts.account_id
UPDATE contacts c
SET account_id = a.id
FROM accounts a
WHERE a.org_id = c.org_id
  AND lower(TRIM(c.company)) = lower(a.name)
  AND c.account_id IS NULL;
```

`contacts.company` is **not dropped** — it stays as the free-text fallback for one milestone for revertibility. Later it can become a generated column derived from `accounts.name`, or be removed entirely.

## What needs to be built

**Schema and types:**
1. Migration: `accounts` table + indexes + RLS + columns on contacts/opportunities + CHECK constraint
2. Migration: data migration `contacts.company` -> `accounts` (idempotent, safe to re-run)
3. Update `src/types/database.ts`

**Server actions:**
4. `getAccounts(filters)` — paginated, search by name/domain/tag
5. `getAccount(id)` — returns account + linked contacts + open opportunities + aggregated activities
6. `createAccount`, `updateAccount`, `deleteAccount` (soft-delete decision in plan)
7. `mergeAccounts(primaryId, secondaryIds)` — duplicate cleanup
8. `importAccountsCsv` — dedup by (org_id, lower(name)) and by domain

**UI — list:**
9. `/dashboard/accounts` — table with name, domain, # contacts, # open deals, total pipeline value, tags
10. Filters: industry, size, tag, assigned_to, source
11. Bulk actions: assign owner, tag, delete

**UI — detail:**
12. `/dashboard/accounts/[id]` — header with company info
13. **Contacts** tab: list of contacts where `account_id = this`
14. **Opportunities** tab: deals where `contact.account_id = this` OR `opportunity.account_id = this` (union)
15. **Activities** tab: unified feed (calls + messages + notes) from all linked contacts + direct activities
16. "Add contact" button pre-linking to the account
17. "Add opportunity" button offering: link to specific contact OR directly to the account (B2B)

**UI — form:**
18. Create/edit modal with `custom_fields` placeholder slot (actually wired up in SEED-017)
19. Auto-suggest domain from website on input
20. Auto-suggest account when creating a contact with an `email` (lookup by email domain)

**Integration with existing contacts:**
21. Contact form: "Company" field becomes a combobox over `accounts` + "Create new company" option
22. Contact listings: show `account.name` instead of `company text` when available (fallback to `company` when `account_id IS NULL`)
23. Server actions `linkContactToAccount(contactId, accountId)` and `createAccountFromContact(contactId)`

**Integration with existing opportunities:**
24. Opportunity form: "Company" field pre-filled from `contact.account_id` when contact is chosen; independently editable
25. Kanban: account badge on card when relevant
26. Opportunity detail: clickable link to the account

**Dashboard:**
27. "Top Companies" widget — accounts with most open deals / largest pipeline value

**Tests:**
28. RLS cross-org (account in org A invisible from org B)
29. CHECK constraint (opp without contact and without account -> rejected)
30. Migration idempotent (rerun does not duplicate accounts)
31. Account merge preserves contacts + opportunities
32. Lookup by email domain

## Decisions to make before planning

1. **Soft-delete vs hard-delete?** Accounts with linked contacts/opportunities — block delete, cascade, or soft-delete with `deleted_at`?
2. **Hierarchy (parent_account_id)?** Useful for subsidiaries. Recommendation: defer — adds complexity, rare in SMB.
3. **`opportunity.account_id` derived vs independent?** A deal linked to a contact already has an account via `contact.account_id`. Keeping both editable can drift. Decision: `opportunity.account_id` is *authoritative* (overrides), nullable, defaulted from `contact.account_id` on create.

## References to existing code

- [`src/app/(dashboard)/contacts/`](src/app/(dashboard)/contacts/) — CRUD/list/detail pattern to mirror
- [`src/app/(dashboard)/pipelines/`](src/app/(dashboard)/pipelines/) — activity-feed pattern
- [`src/lib/contacts/`](src/lib/contacts/) — server-action shape
- Migration `051_contacts.sql` — RLS + index template for a new entity

## Dependencies

- None. SEED-016 is the foundation for SEED-017 (Custom Fields).
- SEED-017 depends on this to cover accounts in the custom-fields system from day one.

## Post-migration considerations (Vercel → Hetzner)

Nothing in this seed is Vercel-specific: schema lives in Supabase Postgres, server actions and pages run identically on a Node host. The migration is a no-op for accounts.

## Scope

**Medium — 3–4 phases, ~10 plans.**

Suggested phase breakdown:
1. Schema + data migration + types + RLS + constraint tests
2. Server actions + basic CRUD + integration into contacts/opportunities
3. UI list + filters + bulk actions
4. UI detail (3 tabs) + integration in contact/opportunity flows + dashboard widget
