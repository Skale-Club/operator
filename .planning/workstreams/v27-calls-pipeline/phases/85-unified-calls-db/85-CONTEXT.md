# Phase 85: UNIFIED-CALLS-DB - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Migration criando VIEW `unified_calls` que une `calls` (AI/Vapi) e `call_logs` (Human/Twilio) num dataset consultável com discriminador `call_type`. TypeScript types manuais + server actions `getUnifiedCalls` e `getUnifiedCall`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Infraestrutura pura — todas as decisões de implementação a critério do Claude. Usar o ROADMAP e o SQL da VIEW definido no SEED-014 como spec.

### VIEW Strategy
- VIEW pura com SECURITY INVOKER (herda RLS das tabelas-base automaticamente)
- Não materializar em tabela física
- Nome: `public.unified_calls`
- Discriminador: `call_type text` com valores 'ai' e 'human'

### Server Actions
- `getUnifiedCalls(params)` — suporte a filtros: call_type, direction, status, page, pageSize
- `getUnifiedCall(id)` — retorna UnifiedCall | null, tenta `calls` primeiro depois `call_logs`
- Localização: `src/app/(dashboard)/calls/actions.ts`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts` — `createClient()` e `getUser()` cached
- `src/app/(dashboard)/calls/actions.ts` — pode já existir com lógica de /phone, verificar antes de sobrescrever
- `src/types/database.ts` — adicionar UnifiedCall como tipo manual (VIEW não é auto-gerada)
- `supabase/migrations/` — último número: 070_seo_config.sql → próximo: 071

### Established Patterns
- Server actions com `'use server'` + Zod validation
- Return type `{ ok: true; data: T } | { ok: false; error: string }`
- Queries via `createClient()` (respeita RLS automaticamente)
- Types adicionados manualmente em database.ts para VIEWs e tipos customizados

### Integration Points
- `src/types/database.ts` — adicionar UnifiedCall interface
- `supabase/migrations/071_unified_calls_view.sql` — nova migration

</code_context>

<specifics>
## Specific Ideas

SQL da VIEW conforme SEED-014:
- `calls` (AI): id, org_id, vapi_call_id→external_id, customer_number→counterpart_number, customer_name→counterpart_name, NULL contact_id, 'inbound' direction, duration_seconds, status, ended_reason→substatus, NULL recording_url, transcript, summary→notes, cost, assistant_id, NULL routing_mode, created_at→started_at
- `call_logs` (Human): id, org_id, call_sid→external_id, from_number/to_number→counterpart_number, NULL counterpart_name, contact_id, direction, duration_seconds, status, NULL substatus, recording_url, NULL transcript, notes, NULL cost, NULL assistant_id, routing_mode, COALESCE(started_at,created_at)→started_at

</specifics>

<deferred>
## Deferred Ideas

- Indexing na VIEW (tratado em phases de performance futuras)
- Paginação cursor-based (usar offset/limit por ora, consistente com outras listas)

</deferred>
