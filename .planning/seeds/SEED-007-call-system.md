---
id: SEED-007
status: dormant
planted: 2026-05-17
planted_during: post-v2.0 Multi-Bot Platform
trigger_when: milestone de CRM; OU pedido explícito de substituir sistema de chamadas do GHL
scope: Medium
depends_on: SEED-006 (Contacts)
---

# SEED-007: Call System — Ligações via Twilio + Gravação + R2

Sistema completo de chamadas dentro do Operator: receber e fazer ligações usando número Twilio, gravação automática salva no R2, histórico vinculado ao contato, e player de áudio no painel.

**Substitui o sistema de ligações do GHL.** Sem ferramentas externas de softphone além do Zoiper (app gratuito) para áudio — toda a lógica fica no Operator.

## Arquitetura

```
Inbound:  Twilio → POST /api/twilio/voice (TwiML) → grava → POST /api/twilio/recording → R2 + call_logs
Outbound: Admin clica "Ligar" no painel → Twilio Voice SDK (WebRTC) ou Zoiper via SIP
Gravação: Twilio grava → webhook → Operator baixa áudio → salva no R2 → salva URL no call_logs
```

## Schema

```sql
call_logs (
  id uuid PK,
  org_id uuid FK (RLS),
  contact_id uuid FK → contacts (nullable),
  opportunity_id uuid FK → opportunities (nullable, SEED-008),
  call_sid text UNIQUE,       -- Twilio CallSid
  direction text,             -- 'inbound' | 'outbound'
  from_number text,
  to_number text,
  status text,                -- 'completed' | 'no-answer' | 'busy' | 'failed'
  duration_seconds int,
  recording_url text,         -- URL no R2
  recording_duration int,
  started_at timestamptz,
  ended_at timestamptz,
  notes text,                 -- anotação manual pós-chamada
  created_by uuid FK → auth.users
)
```

## O que precisa ser construído

**Inbound (receber chamadas):**
1. `POST /api/twilio/voice` — retorna TwiML com `<Dial record="record-from-answer">` + `<Number>` do número real do admin
2. `POST /api/twilio/recording` — webhook pós-gravação → baixa áudio → salva no R2 → insere `call_logs`
3. Twilio console: configurar webhook URL no número Twilio

**Outbound — Opção A (Zoiper, sem dev):**
4. Documentação de setup: Twilio SIP Domain + Zoiper config por org
5. Twilio SIP domain com `record=true` para gravar outbound também

**Outbound — Opção B (click-to-call no painel, com dev):**
6. `POST /api/twilio/token` — gera Access Token para Twilio Voice SDK
7. Componente `<DialerButton phone={contact.phone}>` usando `@twilio/voice-sdk`
8. Botão "Ligar" na página de contato e na oportunidade

**Histórico e UI:**
9. `/dashboard/calls` — lista de chamadas com filtros (data, status, direção, contato)
10. Player de áudio inline na lista e no detalhe do contato
11. `/dashboard/contacts/[id]` — aba "Chamadas" com histórico + player
12. Anotação pós-chamada — campo de notas editável após encerrar

**Testes:**
13. Webhook inbound TwiML correto
14. Recording webhook → R2 upload → call_logs insert
15. RLS: org A não vê chamadas da org B

## Decisões travadas
- **Gravação sempre ativa** — `record=true` por padrão; admin pode desativar por org via settings
- **R2 para storage** — baixar do Twilio imediatamente (Twilio cobra por minuto de armazenamento)
- **Opção A (Zoiper) primeiro** — menos dev, funciona hoje; Opção B (click-to-call) como segunda fase
- **Sem Chatwoot** — call logs ficam no Operator

## Scope
**Medium — 3 fases, ~10 plans**

## Referências de código existente
- [`src/lib/twilio/`](src/lib/twilio/) — cliente Twilio existente (`send_sms`)
- [`src/lib/crypto.ts`](src/lib/crypto.ts) — credenciais criptografadas
- Cloudflare R2 — já decidido para storage (SEED-004)
