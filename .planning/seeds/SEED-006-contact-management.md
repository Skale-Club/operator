---
id: SEED-006
status: dormant
planted: 2026-05-17
planted_during: post-v2.0 Multi-Bot Platform
trigger_when: início do milestone de CRM; OU antes de SEED-007 (Calls) e SEED-008 (Pipeline) pois ambos dependem de contacts
scope: Medium
---

# SEED-006: Contact Management — Base do CRM

Criar a entidade `contacts` como base de tudo no CRM do Operator. Contatos são o elo entre conversas, chamadas, oportunidades e o histórico completo de interação com cada pessoa.

**Operator substitui GHL e Evo CRM** — não há sistema externo de contatos. Tudo fica no próprio banco multi-tenant do Operator.

## Schema

```sql
contacts (
  id uuid PK,
  org_id uuid FK → organizations (RLS),
  name text,
  phone text,           -- E.164: +5511999999999
  email text,
  company text,
  notes text,
  tags text[],
  custom_fields jsonb,  -- campos livres por org
  source text,          -- 'manual' | 'whatsapp' | 'sms' | 'instagram' | 'csv_import' | 'ghl_sync'
  external_id text,     -- ID no GHL se importado
  created_by uuid FK → auth.users,
  created_at, updated_at
)

-- índices
idx_contacts_phone (org_id, phone)  -- lookup por número ao receber mensagem
idx_contacts_email (org_id, email)
```

## Vinculação automática com canais

Quando chega mensagem (WhatsApp, SMS, Instagram), o sistema busca contato pelo número/ID:
```
inbound message.from → lookup contacts(org_id, phone) → se existe, vincula conversation.contact_id
                                                        → se não existe, cria contact automaticamente (source='whatsapp')
```

## O que precisa ser construído

1. **Migration** — tabela `contacts` + índices + RLS
2. **Tipos** — atualizar `src/types/database.ts`
3. **Server actions** — `getContacts`, `getContact`, `createContact`, `updateContact`, `deleteContact`, `mergeContacts`, `importContactsCSV`
4. **UI — Lista** — `/dashboard/contacts` com busca, filtros (tag, source, canal), paginação
5. **UI — Detalhe** — `/dashboard/contacts/[id]` com histórico unificado (conversas, chamadas, oportunidades)
6. **UI — Formulário** — criar/editar contato, campos customizados por org
7. **Importação CSV** — mapeamento de colunas, preview, dedup por phone/email
8. **Sync GHL** — importar contatos existentes do GHL via API (one-shot ou periódico)
9. **Vinculação retroativa** — job que vincula conversas existentes sem `contact_id` ao contato pelo número
10. **Testes** — RLS isolation, lookup por phone, import CSV, merge de duplicados

## Referências de código existente
- [`src/lib/ghl/`](src/lib/ghl/) — padrão de integração GHL para sync
- Conversations já têm `from` (número) — vinculação é só um lookup + FK update

## Scope
**Medium — 2-3 fases, ~8 plans**

## Dependências
- Nenhuma — é a base de tudo
- SEED-007 e SEED-008 dependem deste seed
