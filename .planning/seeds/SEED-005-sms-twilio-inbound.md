---
id: SEED-005
status: shipped
shipped_in: v2.1
planted: 2026-05-17
planted_during: post-v2.0 Multi-Bot Platform
trigger_when: milestone de omnichannel inbox, ou qualquer milestone que toque Twilio/SMS; OU pedido explícito
scope: Small
---

# SEED-005: SMS Twilio Inbound — Omnichannel Inbox Completo

Adicionar recebimento de SMS ao Operator. O executor de saída (`send_sms`) já existe desde v1.8. Falta só o webhook inbound — quando alguém responde um SMS, a mensagem aparece no inbox do Operator e o agente pode responder automaticamente.

## O que já existe (zero trabalho)
- ✅ `send_sms` executor (v1.8) — envia SMS via Twilio
- ✅ `conversations` table com enum de canal — `sms` já está no schema
- ✅ Inbox UI (v1.3) — já filtra e exibe por canal
- ✅ `runAgent({channel: 'sms'})` — adapter SMS existe (Phase 37, 640 chars)
- ✅ Twilio integration credentials — já configuradas por org

## O que precisa ser construído

**1 arquivo novo:**
```
src/app/api/twilio/sms/route.ts
  POST /api/twilio/sms  ← URL configurada no Twilio console
  → valida assinatura Twilio (X-Twilio-Signature)
  → extrai From, To, Body, MessageSid
  → upsert conversation (channel='sms', external_id=MessageSid)
  → insere conversation_message
  → after() → runAgent({channel: 'sms'}) se org tiver agent configurado
  → return TwiML 200 vazio
```

**Configuração no Twilio:**
- Webhook URL: `https://operator.skale.club/api/twilio/sms`
- Method: POST

**Testes:**
- Payload Twilio simulado → conversa criada
- Assinatura inválida → 403
- Resposta do agente → send_sms disparado

## Scope
**Small — 1 fase, ~3 plans**

## Dependências
- SEED-006 (Contacts) — para vincular From ao contato automaticamente
- Sem outras dependências

## Próximo passo
Pode ser executado como fase decimal (`/gsd:insert-phase`) dentro de qualquer milestone
