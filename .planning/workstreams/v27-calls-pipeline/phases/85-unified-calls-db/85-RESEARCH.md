# Phase 85: UNIFIED-CALLS-DB - Research

**Researched:** 2026-05-19
**Domain:** Supabase VIEW + TypeScript types + Next.js server actions
**Confidence:** HIGH

## Summary

Phase 85 has been partially pre-implemented. Migration 063 (`063_unified_calls_view.sql`) already exists and creates the `unified_calls` VIEW. The `unified_calls` type block already exists in `src/types/database.ts` as a manually-added section under `Tables`. The server actions `getUnifiedCalls` and `getUnifiedCall` are already implemented in `src/app/(dashboard)/calls/actions.ts` alongside legacy helpers `getCalls`, `getAssistantOptions`, and `getDashboardMetrics`.

The core deliverables of this phase — VIEW SQL, TypeScript type, and server actions — are already in place. The remaining work is (1) verify the VIEW SQL matches the `database.ts` shape, (2) verify the TypeScript type is complete and correct, (3) ensure test coverage in `tests/calls-actions.test.ts` moves from `todo` stubs to real implementations for the unified calls functions, and (4) validate the VIEW works against the live database.

**Primary recommendation:** Audit what exists, fill gaps (test stubs), and add `getUnifiedCalls`/`getUnifiedCall` test coverage. Do NOT rewrite the already-implemented migration, types, or actions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- VIEW pura com SECURITY INVOKER (herda RLS das tabelas-base automaticamente)
- Nao materializar em tabela fisica
- Nome: `public.unified_calls`
- Discriminador: `call_type text` com valores 'ai' e 'human'
- Server actions localizadas em `src/app/(dashboard)/calls/actions.ts`
- `getUnifiedCalls(params)` — suporte a filtros: call_type, direction, status, page, pageSize
- `getUnifiedCall(id)` — retorna UnifiedCall | null, tenta via `unified_calls` VIEW

### Claude's Discretion
Infraestrutura pura — todas as decisoes de implementacao a criterio do Claude. Usar o ROADMAP e o SQL da VIEW definido no SEED-014 como spec.

### Deferred Ideas (OUT OF SCOPE)
- Indexing na VIEW (tratado em phases de performance futuras)
- Paginacao cursor-based (usar offset/limit por ora, consistente com outras listas)
</user_constraints>

---

## Exact Column Schemas

### `public.calls` table (migration 003)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| organization_id | uuid | NOT NULL | FK organizations |
| vapi_call_id | text | NOT NULL UNIQUE | |
| assistant_id | text | YES | |
| call_type | text | YES | |
| status | text | YES | |
| ended_reason | text | YES | |
| started_at | timestamptz | YES | |
| ended_at | timestamptz | YES | |
| duration_seconds | integer | YES | GENERATED from started_at/ended_at |
| cost | numeric(10,6) | YES | |
| customer_number | text | YES | |
| customer_name | text | YES | |
| summary | text | YES | |
| transcript | text | YES | |
| transcript_turns | jsonb | NOT NULL | default '[]' |
| created_at | timestamptz | NOT NULL | default now() |

**RLS:** SELECT for authenticated via `get_current_org_id()`. INSERT service-role only. No UPDATE/DELETE (append-only).

### `public.call_logs` table (migration 053 + 056)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| org_id | uuid | NOT NULL | FK organizations (note: `org_id` not `organization_id`) |
| contact_id | uuid | YES | FK contacts ON DELETE SET NULL |
| opportunity_id | uuid | YES | Added by migration 056 |
| call_sid | text | NOT NULL UNIQUE | Twilio call SID |
| direction | text | NOT NULL | CHECK ('inbound','outbound') |
| routing_mode | text | YES | phone_forward / sip / browser |
| from_number | text | YES | |
| to_number | text | YES | |
| status | text | YES | |
| duration_seconds | integer | YES | |
| recording_url | text | YES | |
| recording_duration | integer | YES | |
| started_at | timestamptz | YES | |
| ended_at | timestamptz | YES | |
| notes | text | YES | |
| created_by | uuid | YES | FK auth.users |
| created_at | timestamptz | NOT NULL | default now() |

**RLS:** ALL for authenticated via `get_current_org_id()`.

### `public.unified_calls` VIEW (migration 063)
| Column | Type | Source |
|--------|------|--------|
| id | uuid | calls.id / call_logs.id |
| call_type | text | 'ai' / 'human' literal |
| org_id | uuid | calls.organization_id / call_logs.org_id |
| external_id | text | calls.vapi_call_id / call_logs.call_sid |
| counterpart_number | text\|null | calls.customer_number / CASE direction inbound→from else to |
| counterpart_name | text\|null | calls.customer_name / NULL |
| contact_id | uuid\|null | NULL / call_logs.contact_id |
| direction | text | 'inbound' literal / call_logs.direction |
| duration_seconds | integer\|null | calls.duration_seconds / call_logs.duration_seconds |
| status | text\|null | calls.status / call_logs.status |
| substatus | text\|null | calls.ended_reason / NULL |
| recording_url | text\|null | NULL / call_logs.recording_url |
| recording_duration | integer\|null | NULL / call_logs.recording_duration |
| transcript | text\|null | calls.transcript / NULL |
| notes | text\|null | calls.summary / call_logs.notes |
| cost | numeric\|null | calls.cost / NULL |
| assistant_id | text\|null | calls.assistant_id / NULL |
| routing_mode | text\|null | NULL / call_logs.routing_mode |
| started_at | timestamptz\|null | COALESCE(started_at, created_at) from both |
| ended_at | timestamptz\|null | calls.ended_at / call_logs.ended_at |
| created_at | timestamptz | calls.created_at / call_logs.created_at |

**Security:** `WITH (security_invoker = true)` — RLS inherited from base tables automatically.

---

## Current Implementation State (CRITICAL FINDING)

All three deliverables are **already implemented**:

### 1. Migration — EXISTS (`063_unified_calls_view.sql`)
The VIEW SQL is fully written and matches the CONTEXT.md spec. No new migration is needed. The last migration is `070_seo_config.sql`, so the next migration would be `071` — but since 063 was used and already exists, no new migration is required for this phase.

### 2. TypeScript Type — EXISTS in `src/types/database.ts`
The `unified_calls` entry is manually added under `Tables` (lines 1779–1806):
```typescript
unified_calls: {
  Row: {
    id: string
    call_type: 'ai' | 'human'
    org_id: string
    external_id: string
    counterpart_number: string | null
    counterpart_name: string | null
    contact_id: string | null
    direction: 'inbound' | 'outbound'
    duration_seconds: number | null
    status: string | null
    substatus: string | null
    recording_url: string | null
    recording_duration: number | null
    transcript: string | null
    notes: string | null
    cost: number | null
    assistant_id: string | null
    routing_mode: string | null
    started_at: string | null
    ended_at: string | null
    created_at: string
  }
  Insert: never
  Update: never
  Relationships: []
}
```
Pattern for VIEWs: `Insert: never`, `Update: never`, `Relationships: []`. This is the correct pattern for read-only views.

### 3. Server Actions — EXISTS and FULLY IMPLEMENTED in `src/app/(dashboard)/calls/actions.ts`

The file contains:
- `getUnifiedCalls(filters: UnifiedCallFilters)` — filters: type, direction, missed, q, from, to, page, pageSize; resolves contact info for rows with `contact_id`
- `getUnifiedCall(id: string)` — queries `unified_calls` VIEW by id, joins contact
- `getCalls(...)` — legacy Vapi-only action (kept for backward compat)
- `getAssistantOptions()` — for filter dropdowns
- `getDashboardMetrics()` — dashboard KPIs

**Return type pattern in this file:**
- `getUnifiedCalls` returns `Promise<UnifiedCallsResult>` (direct value, no ok/error wrapper)
- `getUnifiedCall` returns `Promise<UnifiedCallWithContact | null>` (null on not-found or auth failure)
- Legacy `getCalls` returns `Promise<{ calls: CallRow[]; total: number }>`

**Important:** This project uses TWO different server action return patterns:
1. **Direct return** (used in `calls/actions.ts`, `voice/actions.ts` list functions): return the data directly or return empty/null on error
2. **`{ ok: true; data } | { ok: false; error }` wrapper** (used in mutation actions like `saveCallSettings`, `updateCallNotes`): for write operations that need to signal success/failure

The existing `getUnifiedCalls` and `getUnifiedCall` use pattern 1 (direct return). This is already implemented and consistent.

### 4. Test File — EXISTS but has ONLY `todo` stubs
`tests/calls-actions.test.ts` contains only `.todo` stubs for the legacy `getCalls` function. There are NO test stubs or implementations for `getUnifiedCalls` or `getUnifiedCall`.

---

## Architecture Patterns

### Manual Types for VIEWs
Views are not auto-generated by Supabase CLI into `database.ts`. The pattern used in this project:
1. Add the VIEW entry under `Tables` (not a separate `Views` key)
2. Use `Insert: never` and `Update: never` to signal read-only
3. Use `Relationships: []`
4. Reference the type via `Database['public']['Tables']['unified_calls']['Row']`

The `calls/actions.ts` file already does this:
```typescript
export type UnifiedCall = Database['public']['Tables']['unified_calls']['Row']
```

### Query Pattern for VIEWs via Supabase client
```typescript
const supabase = await createClient()
const { data, count, error } = await supabase
  .from('unified_calls')
  .select('*', { count: 'exact' })
  .order('started_at', { ascending: false, nullsFirst: false })
  .range(from, from + pageSize - 1)
```
VIEWs are queried identically to tables. RLS is inherited (no org_id filter needed).

### Pagination Pattern
Offset/limit via `.range(from, from + pageSize - 1)`. Consistent with other list actions in the codebase.

### Contact join pattern
No SQL join — the action does a two-step query: fetch the unified_calls rows, collect unique `contact_id` values, then batch fetch contacts. This avoids JOIN complexity in the VIEW.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UNION query logic | Custom PostgreSQL client | Supabase VIEW + `.from('unified_calls')` | VIEW handles UNION; Supabase client queries it like a table |
| RLS in VIEWs | Manual org_id filter | SECURITY INVOKER on VIEW | Inherits base table RLS automatically |
| Type for VIEW | Copy-paste types manually from scratch | Follow existing `unified_calls` pattern already in database.ts | Already done; just verify correctness |
| Contact enrichment | SQL JOIN in VIEW | Two-step: fetch rows, then batch contact lookup | VIEW stays simple; app layer enriches |

---

## Common Pitfalls

### Pitfall 1: Treating `unified_calls` as a table for INSERT/UPDATE
**What goes wrong:** TypeScript type has `Insert: never` — attempting to insert/update will error at compile time.
**Why it happens:** VIEWs are read-only; `unified_calls` has no triggers for instead-of operations.
**How to avoid:** Only use `.select()` on `unified_calls`. Writes go to `calls` or `call_logs` directly.

### Pitfall 2: Querying `unified_calls` with `select('*, contacts(*)')` style join
**What goes wrong:** VIEWs don't expose FK relationships to PostgREST in the same way tables do. The Supabase client cannot navigate relationships defined on base tables from a VIEW.
**Why it happens:** PostgREST relationship discovery is based on FK constraints, which aren't on the VIEW.
**How to avoid:** Use the two-step approach already implemented: fetch VIEW rows, then batch-fetch contacts by collected IDs.

### Pitfall 3: `duration_seconds` on `calls` is a GENERATED column
**What goes wrong:** Trying to INSERT `duration_seconds` into `calls` will fail with a PG error.
**Why it happens:** `GENERATED ALWAYS AS ... STORED` columns cannot be written.
**How to avoid:** Never include `duration_seconds` in INSERT/UPDATE for `calls`. (Not relevant to this phase — VIEW is read-only.)

### Pitfall 4: `org_id` vs `organization_id` column name inconsistency
**What goes wrong:** `calls` uses `organization_id`; `call_logs` uses `org_id`. The VIEW aliases both as `org_id`.
**Why it happens:** Tables were created in different migrations with inconsistent naming.
**How to avoid:** Always query via the VIEW (`org_id`) when working with unified data. Confirmed in database.ts `unified_calls` Row type.

### Pitfall 5: Supabase client may not recognize `unified_calls` view without re-generating types
**What goes wrong:** TypeScript compiler errors on `.from('unified_calls')` if `unified_calls` is not in `Database['public']['Tables']`.
**Why it happens:** Supabase CLI type generation only covers tables by default.
**How to avoid:** Already handled — `unified_calls` is manually added to `Tables` in `database.ts`. No re-generation needed; the existing type is already there.

---

## Code Examples

### Querying the unified VIEW with filters (already implemented)
```typescript
// Source: src/app/(dashboard)/calls/actions.ts
const supabase = await createClient()
let query = supabase
  .from('unified_calls')
  .select('*', { count: 'exact' })
  .order('started_at', { ascending: false, nullsFirst: false })

if (filters.type && filters.type !== 'all') query = query.eq('call_type', filters.type)
if (filters.direction && filters.direction !== 'all') query = query.eq('direction', filters.direction)
if (filters.missed) query = query.in('status', ['no-answer', 'failed', 'busy', 'canceled'])
```

### VIEW SQL pattern (already exists in migration 063)
```sql
CREATE VIEW public.unified_calls
WITH (security_invoker = true) AS
SELECT
  c.id,
  'ai'::text AS call_type,
  c.organization_id AS org_id,
  c.vapi_call_id AS external_id,
  ...
FROM public.calls c
UNION ALL
SELECT
  l.id,
  'human'::text AS call_type,
  l.org_id,
  l.call_sid AS external_id,
  ...
FROM public.call_logs l;

GRANT SELECT ON public.unified_calls TO authenticated, anon;
```

### Manual type for VIEW in database.ts (already exists)
```typescript
// src/types/database.ts — under Database.public.Tables
unified_calls: {
  Row: {
    id: string
    call_type: 'ai' | 'human'
    org_id: string
    // ... all columns from VIEW SELECT list
  }
  Insert: never   // read-only VIEW
  Update: never
  Relationships: []
}
```

### Test pattern (Vitest with todo stubs — existing style in project)
```typescript
// tests/calls-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUnifiedCalls, getUnifiedCall } from '@/app/(dashboard)/calls/actions'

describe('getUnifiedCalls: pagination', () => {
  it('returns rows array and total count', async () => { ... })
  it('defaults to page 1 and pageSize 20', async () => { ... })
})

describe('getUnifiedCalls: filters', () => {
  it('filters by call_type=ai', async () => { ... })
  it('filters by direction=inbound', async () => { ... })
  it('filters by missed status values', async () => { ... })
  it('applies q search across counterpart_number and counterpart_name', async () => { ... })
})

describe('getUnifiedCall: single record', () => {
  it('returns UnifiedCallWithContact when found', async () => { ... })
  it('returns null when record not found', async () => { ... })
  it('enriches with contact data when contact_id is present', async () => { ... })
})
```

---

## Migration Number Analysis

The CONTEXT.md stated "ultimo numero: 070_seo_config.sql → proximo: 071". However, **migration 063 already exists** and contains the `unified_calls` VIEW. The actual last migration is `070_seo_config.sql`.

| Migration | File | Status |
|-----------|------|--------|
| 063 | 063_unified_calls_view.sql | EXISTS — contains the VIEW |
| 064-070 | various | EXISTS |
| 071 | (next available) | Not created yet; NOT needed for this phase |

**Conclusion:** No new migration is needed for Phase 85. The VIEW was created in migration 063 which is already applied.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/calls-actions.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `getUnifiedCalls` returns paginated rows | unit | `npx vitest run tests/calls-actions.test.ts` | Exists — needs implementation |
| `getUnifiedCalls` filters by call_type | unit | same | Exists — needs implementation |
| `getUnifiedCalls` filters by direction | unit | same | Exists — needs implementation |
| `getUnifiedCalls` missed filter maps to status values | unit | same | Exists — needs implementation |
| `getUnifiedCalls` q search uses ilike | unit | same | Exists — needs implementation |
| `getUnifiedCall` returns single record | unit | same | Exists — needs implementation |
| `getUnifiedCall` enriches contact | unit | same | Exists — needs implementation |
| VIEW exists in DB and returns rows | smoke | manual `npx supabase db push` + query | Migration 063 exists |
| TypeScript compiles without errors | build | `npm run build` | Passes today |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/calls-actions.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run build` clean before verify

### Wave 0 Gaps
- [ ] `tests/calls-actions.test.ts` — file exists but only has `.todo` stubs for legacy `getCalls`; needs real test implementations for `getUnifiedCalls` and `getUnifiedCall`
- [ ] Mock strategy: other test files (e.g., `call-routing.test.ts`) use pure function unit tests; `calls-actions.test.ts` needs Supabase client mocking similar to `accounts-actions.test.ts` pattern

---

## What Already Exists vs. What Needs Work

| Deliverable | Status | Action |
|-------------|--------|--------|
| `supabase/migrations/063_unified_calls_view.sql` | DONE | Verify VIEW shape matches spec |
| `unified_calls` type in `database.ts` | DONE | Verify column list completeness |
| `getUnifiedCalls` server action | DONE | Verify correctness, add tests |
| `getUnifiedCall` server action | DONE | Verify correctness, add tests |
| `UnifiedCallFilters` interface | DONE | No changes needed |
| `UnifiedCallWithContact` interface | DONE | No changes needed |
| `tests/calls-actions.test.ts` — unified functions | GAP | Write Vitest tests for getUnifiedCalls + getUnifiedCall |
| Legacy `getCalls` tests | GAP (existing todos) | Out of scope for this phase |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond already-installed Supabase + Vitest — both confirmed present in project)

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `supabase/migrations/003_observability.sql` — `calls` table full schema
- Direct file read: `supabase/migrations/053_call_system.sql` — `call_logs` table full schema
- Direct file read: `supabase/migrations/056_sales_pipeline.sql` — `call_logs.opportunity_id` addition
- Direct file read: `supabase/migrations/063_unified_calls_view.sql` — complete VIEW SQL
- Direct file read: `src/types/database.ts` lines 1120–1168 — `calls` Row type
- Direct file read: `src/types/database.ts` lines 1779–1806 — `unified_calls` Row type (already present)
- Direct file read: `src/types/database.ts` lines 1949–1989 — `call_logs` Row type
- Direct file read: `src/app/(dashboard)/calls/actions.ts` — full implementation
- Direct file read: `src/app/(dashboard)/voice/actions.ts` — call_logs patterns and return type conventions
- Direct file read: `tests/calls-actions.test.ts` — existing test stubs
- Direct file read: `vitest.config.ts` — test runner config

### Secondary (MEDIUM confidence)
- Direct file read: `.planning/workstreams/v27-calls-pipeline/phases/85-unified-calls-db/85-CONTEXT.md` — phase scope and SQL spec
- Pattern observation: other test files confirm Vitest + describe/it structure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files directly read
- Architecture: HIGH — implementation already exists and was inspected
- Pitfalls: HIGH — derived from actual schema and type inspection
- Test gaps: HIGH — confirmed by reading `tests/calls-actions.test.ts`

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (schema stable; Supabase/Vitest APIs are stable)
