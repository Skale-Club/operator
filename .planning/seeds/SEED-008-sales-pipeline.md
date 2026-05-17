---
id: SEED-008
status: dormant
planted: 2026-05-17
planted_during: post-v2.0 Multi-Bot Platform
trigger_when: milestone de CRM; executar após SEED-006 (Contacts) e SEED-007 (Calls)
scope: Large
depends_on: SEED-006 (Contacts), SEED-007 (Calls)
---

# SEED-008: Sales Pipeline + Oportunidades — Funil de Vendas no Operator

Funil de vendas completo com pipeline Kanban, oportunidades vinculadas a contatos, e feed de atividades unificado (chamadas, mensagens, notas). Substitui o CRM de oportunidades do GHL dentro do Operator.

**Operator substitui GHL e Evo CRM** — nenhum sistema externo de pipeline. Multi-tenant nativo via RLS.

## Schema

```sql
pipelines (
  id uuid PK,
  org_id uuid FK (RLS),
  name text,              -- ex: "Vendas", "Onboarding", "Suporte"
  is_default boolean,
  position int,
  created_at, updated_at
)

pipeline_stages (
  id uuid PK,
  pipeline_id uuid FK → pipelines,
  org_id uuid FK (RLS),
  name text,              -- ex: "Lead", "Qualificado", "Proposta", "Fechado Ganho"
  position int,           -- ordem no Kanban
  color text,             -- hex color para o card
  is_won boolean,         -- estágio final de ganho
  is_lost boolean         -- estágio final de perdido
)

opportunities (
  id uuid PK,
  org_id uuid FK (RLS),
  contact_id uuid FK → contacts,
  pipeline_id uuid FK → pipelines,
  stage_id uuid FK → pipeline_stages,
  title text,
  value numeric,
  currency text DEFAULT 'BRL',
  status text,            -- 'open' | 'won' | 'lost'
  expected_close_date date,
  assigned_to uuid FK → auth.users,
  custom_fields jsonb,
  created_by uuid FK → auth.users,
  created_at, updated_at
)

opportunity_activities (
  id uuid PK,
  org_id uuid FK (RLS),
  opportunity_id uuid FK → opportunities,
  type text,              -- 'note' | 'call' | 'whatsapp' | 'sms' | 'instagram' | 'stage_change' | 'email'
  content text,
  call_log_id uuid FK → call_logs (nullable),
  conversation_id uuid FK → conversations (nullable),
  created_by uuid FK → auth.users,
  created_at
)
```

## O que precisa ser construído

**Schema e tipos:**
1. Migrations para 4 tabelas + RLS em todas + seed de pipeline padrão por org

**Pipeline CRUD:**
2. `/dashboard/pipelines` — criar, editar, reordenar pipelines
3. Gerenciar stages — criar, renomear, reordenar, colorir, marcar won/lost

**Kanban — a peça central:**
4. `/dashboard/pipelines/[id]` — board Kanban com colunas por stage
5. Cards de oportunidade com: nome do contato, valor, responsável, dias no stage
6. Drag-and-drop entre stages (registra `stage_change` no feed de atividades)
7. Filtros no Kanban: por responsável, por valor, por tag do contato

**Oportunidade:**
8. Modal/página de criação — vincular contato, stage inicial, valor, data de fechamento
9. Página de detalhe — info geral + feed de atividades cronológico
10. Feed de atividades: notas manuais, chamadas (SEED-007), mensagens (WhatsApp/SMS/Instagram), mudanças de stage

**Vinculação automática:**
11. Quando admin liga para um contato → call_log criado → aparece no feed de oportunidades abertas do contato
12. Quando chega mensagem de um contato → aparece no feed das oportunidades abertas dele
13. Busca de contato ao criar oportunidade com autocomplete

**Dashboard de métricas:**
14. `/dashboard` — widget "Pipeline": valor total por stage, deals fechados no mês, taxa de conversão
15. Relatório simples: oportunidades por responsável, por pipeline, por período

**Testes:**
16. RLS cross-org, drag-and-drop persiste position, feed de atividades vinculado, métricas corretas

## Decisões a tomar antes de planejar
1. **Kanban ou lista?** Recomendação: Kanban como view padrão + toggle para lista
2. **Múltiplos pipelines?** Sim — cada org pode ter vários (Vendas, Onboarding, etc.)
3. **Email no feed?** Deixar para fase futura — não há integração de email ainda
4. **Automações de pipeline?** (ex: mover stage automaticamente quando reunião é marcada) — backlog

## Scope
**Large — 4-5 fases, ~15 plans**

## Referências de código existente
- [`src/app/(dashboard)/agents/`](src/app/(dashboard)/agents/) — padrão de CRUD com server actions
- [`src/app/(dashboard)/conversations/`](src/app/(dashboard)/conversations/) — padrão de lista com filtros
- SEED-006 (Contacts) — `contact_id` FK obrigatório
- SEED-007 (Calls) — `call_log_id` no feed de atividades

## Ordem de execução recomendada no milestone
```
SEED-006 (Contacts) → SEED-007 (Calls) → SEED-008 (Pipeline)
```
Pipeline sem contatos não faz sentido. Calls sem contatos perde o histórico vinculado.
