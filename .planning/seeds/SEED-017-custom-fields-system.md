---
id: SEED-017
status: shipped
shipped_in: v2.4
planted: 2026-05-18
planted_during: post-v2.1, before CRM Expansion milestone
trigger_when: after SEED-016 (Accounts) — system covers 3 entities from day one
scope: Large
depends_on: SEED-016 (Accounts)
---

# SEED-017: Custom Fields System — Structured Layer Over `jsonb`

Promote the `custom_fields jsonb` columns (already present on `contacts` and `opportunities`, plus `accounts` from SEED-016) into a **structured system**: each org defines its custom fields with type, label, validation, UI order, select options, etc. Storage stays as `jsonb` (flexible, no migration per field), but a **metadata layer** (`custom_field_definitions`) drives the UI, server-side validation, import/export, and filtering.

**Why structure now:**
- The current `jsonb` is write-only — nothing in the UI reads or edits these values.
- Without metadata, there is no way to validate types, populate dropdowns, or expose fields in filters.
- CSV import (existing in contacts) needs to know which columns map to which custom field.
- Outbound webhooks (future) need to serialize custom fields with the correct types.

## Schema

```sql
-- Supported field types (basic + URL/email/phone/currency)
CREATE TYPE custom_field_type AS ENUM (
  'text',          -- single-line
  'long_text',     -- multi-line (textarea)
  'number',        -- numeric (decimal)
  'integer',
  'boolean',       -- checkbox
  'date',          -- date only
  'datetime',      -- date + time
  'select',        -- single dropdown
  'multi_select',  -- chips
  'url',           -- text with URL pattern
  'email',         -- text with email pattern
  'phone',         -- text with E.164 normalisation
  'currency'       -- number + currency_code
);

-- Entities that support custom fields
CREATE TYPE custom_field_entity AS ENUM ('contact', 'opportunity', 'account');

-- Field definition (one row per field, per org, per entity)
custom_field_definitions (
  id uuid PK,
  org_id uuid FK -> organizations (RLS),
  entity custom_field_entity NOT NULL,
  key text NOT NULL,                  -- slug used in jsonb: e.g. "linkedin_url", "decision_maker"
  label text NOT NULL,                -- shown in UI: "LinkedIn", "Decision Maker"
  type custom_field_type NOT NULL,
  required boolean DEFAULT false,
  unique_per_org boolean DEFAULT false,    -- e.g. tax ID cannot repeat
  position int NOT NULL,              -- ordering in form/list
  group_name text,                    -- optional grouping: "Commercial", "Operational", null
  help_text text,                     -- tooltip
  default_value jsonb,                -- initial value
  options jsonb,                      -- for select/multi_select: [{value:"hot",label:"Hot",color:"red"}]
  validation jsonb,                   -- {min, max, pattern, max_length, currency_code, ...}
  visible_in_list boolean DEFAULT false,    -- column appears in the entity list table
  filterable boolean DEFAULT false,   -- can be used as a filter
  archived boolean DEFAULT false,     -- soft-delete: hidden from UI but values preserved
  created_by uuid FK -> auth.users,
  created_at, updated_at,
  UNIQUE (org_id, entity, key)
)

-- Indexes
idx_cfd_org_entity_position (org_id, entity, position) WHERE archived = false
idx_cfd_org_entity_filterable (org_id, entity) WHERE filterable = true AND archived = false
```

**Value storage:** stays in `contacts.custom_fields`, `opportunities.custom_fields`, `accounts.custom_fields` — all `jsonb DEFAULT '{}'::jsonb`. The `jsonb` key matches `custom_field_definitions.key`. Example:

```json
// contacts.custom_fields
{
  "linkedin_url": "https://linkedin.com/in/foo",
  "decision_maker": true,
  "lead_temperature": "hot",
  "annual_revenue": { "amount": 1500000, "currency": "BRL" }
}
```

Values are **shallow** (no nesting), except `currency` which uses `{amount, currency}` to preserve the currency code.

## Validation

**Server-side (always):** validator in `src/lib/custom-fields/validate.ts` loads org definitions, builds a dynamic `zod` schema, returns issues. Runs in every `createContact` / `updateContact` / `createOpportunity` / `createAccount` / etc. Invalid values **do not persist** — the write is rejected.

**Client-side (optional, UX only):** same dynamic schema in `react-hook-form` via `zodResolver`, shows errors before submit. Server-side stays the source of truth.

**Reserved keys:** `key` cannot collide with the entity's native columns. The reserved list (`RESERVED_KEYS_BY_ENTITY`) lives in code.

## What needs to be built

**Schema and types:**
1. Migration: `custom_field_type` + `custom_field_entity` ENUMs, `custom_field_definitions` table, indexes, RLS
2. Update `src/types/database.ts`
3. Derived TS types: `CustomFieldDefinition`, `CustomFieldValue`, `EntityCustomFields`

**Core lib:**
4. `src/lib/custom-fields/definitions.ts` — CRUD for definitions (server actions)
5. `src/lib/custom-fields/validate.ts` — dynamic zod schema + server-side validator shared across actions
6. `src/lib/custom-fields/render-config.ts` — map type -> component for rendering
7. `src/lib/custom-fields/serialize.ts` — input normalisation (string -> number, date parsing, phone E.164, etc.)

**Integration with existing entities:**
8. Hook into server actions for contact/opportunity/account: on create/update, validate `custom_fields` against org definitions
9. Reserve conflicting keys (`id`, `org_id`, `name`, etc.) per entity

**UI — settings (admin):**
10. `/dashboard/settings/custom-fields` with tabs per entity (Contacts / Opportunities / Companies)
11. Definitions list: drag-to-reorder (updates `position`), inline label edit
12. Create/edit modal: type -> form changes per type (options for select, currency_code for currency, etc.)
13. Toggles for visible_in_list, filterable, required, unique_per_org
14. Archive (not delete — preserves data)
15. Groups: create group, move fields between groups

**UI — renderer:**
16. `<CustomFieldsForm definitions={...} values={...} onChange={...} />` — used in every entity form
17. `<CustomFieldsDisplay definitions={...} values={...} />` — read-only on detail pages
18. Per-type components: TextField, LongTextField, NumberField, BooleanField, DateField, SelectField, MultiSelectField, UrlField, EmailField, PhoneField, CurrencyField
19. Group support: fields grouped in accordions/sections

**UI — list and filters:**
20. Dynamic columns in contact/opportunity/account tables: honour `visible_in_list`
21. Filters: honour `filterable`; each type has its own operators (text: contains/equals; number: gt/lt/between; date: range; select: in)
22. List server actions accept `customFieldFilters` and generate `WHERE custom_fields @> '{...}'` or `->>'key' = ...`

**CSV import (contacts already has one):**
23. Mapping wizard now offers custom fields as targets
24. Values validated during import (rows with invalid values go to the "errors" preview)

**Export:**
25. CSV export for contact/opportunity/account expands custom fields as columns

**Data migration:**
26. Backwards-compatible: existing `custom_fields jsonb` data keeps working — it just doesn't show in the UI until an admin creates a matching definition (or via a future "scan & propose" flow)

**Tests:**
27. RLS: definition in org A invisible from org B; value with a key from another org's definition is rejected
28. Server-side validation rejects: wrong type, missing required, unique conflict, out-of-range, bad pattern
29. Archive preserves values in jsonb
30. Reorder updates position atomically
31. Filters generate correct SQL and use a GIN index on jsonb
32. Currency persists as `{amount, currency}` and round-trips through the renderer

## Decisions to make before planning

1. **GIN index on `custom_fields jsonb`?** Recommendation: yes for `contacts` and `opportunities` (highest volume); evaluate accounts later. Without GIN, custom-field filters become seq scans.
2. **Role-based permissions?** Admin can create/edit definitions; members can only read/fill. Nothing else in v1.
3. **Sync with the existing `tags[]`?** Tags stay separate — they are intentional ad-hoc taxonomy, while a `multi_select` custom field is structured metadata with defined options. **Do not unify.**
4. **Changing a field's type after values exist?** Recommendation: block in v1 (force archive + create new). Type migration is an edge case and rare.
5. **Per-org field limit?** Recommendation: soft-limit 50 with a warning. Hard limit becomes plan-driven (billing) later.
6. **Outbound webhook payloads?** Yes — include custom fields using `key` as the JSON key. Document as a stable contract.

## References to existing code

- [`src/lib/knowledge/`](src/lib/knowledge/) — lib pattern with server actions + types
- Existing forms in [`src/app/(dashboard)/contacts/`](src/app/(dashboard)/contacts/) — where `<CustomFieldsForm>` plugs in
- Drag-to-reorder in pipeline stages (v2.1) — UX reference for reordering definitions
- Filter chips in `/dashboard/conversations` — filter-UI pattern

## Dependencies

- **SEED-016 (Accounts)** — required so the system covers all 3 entities from day one. Without it, the system would need to be extended to a third entity later, duplicating UI/filter/import work.

## Post-migration considerations (Vercel → Hetzner)

Nothing in this seed is Vercel-specific. Definitions, validators, and renderers run identically on a Node host. The only thing to watch: if custom-field filters drive heavy queries on `contacts.custom_fields jsonb`, the GIN index decision (see Decisions §1) matters more in a self-hosted Supabase Postgres on Hetzner since you own the connection pool — undersized indexes will show up as connection pressure first.

## Scope

**Large — 4–5 phases, ~14 plans.**

Suggested phase breakdown:
1. Schema + migration + types + RLS + reserved keys
2. Core lib (validate, serialize, render-config) + integration into existing server actions
3. UI settings (definition CRUD + drag-reorder + groups)
4. UI renderer (`CustomFieldsForm` + `Display` + 12 per-type components) + integration into every form/detail
5. Dynamic columns + filters + CSV import/export + E2E tests
