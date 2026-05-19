# Requirements: v2.7 Unified Calls Hub + Pipeline UX

**Milestone:** v2.7
**Status:** In Progress

---

## Unified Calls Hub (CALL)

- **CALL-01:** VIEW `unified_calls` unindo `calls` (AI) e `call_logs` (Human) num dataset consultável com `call_type` discriminador
- **CALL-02:** TypeScript types + server actions `getUnifiedCalls` e `getUnifiedCall`
- **CALL-03:** Página `/calls` com timeline unificada mostrando AI e Human calls
- **CALL-04:** Filtros por tipo (AI/Human), direção (inbound/outbound) e status; badges visuais distintos
- **CALL-05:** Sub-rotas `/calls/campaigns` e `/calls/assistants` com lógica migrada de `/phone`
- **CALL-06:** Sub-rota `/calls/settings` consolidando routing modes + Dialer + configurações
- **CALL-07:** Página de detalhe `/calls/[id]` com detecção de tipo e variant correto
- **CALL-08:** Variant AI (transcript, summary, cost) e variant Human (recording player, notes, contact)
- **CALL-09:** Sidebar com item único "Calls" — remove "Phone" e "Voice"
- **CALL-10:** Redirects 301: `/phone` → `/calls`, `/voice` → `/calls`, `/voice/[id]` → `/calls/[id]`

## Pipeline UX (PIPE)

- **PIPE-01:** `activationConstraint` DnD corrigido — clique rápido não dispara drag
- **PIPE-02:** Corpo do card clicável — `role="button"` com `onClick` abrindo sheet
- **PIPE-03:** `OpportunityDetailSheet` com header, tabs Info/Activity/Notes
- **PIPE-04:** Modo view na sheet — title, value, stage, contact, expected_close_date, tags, notes
- **PIPE-05:** Modo edit na sheet — campos editáveis, `updateOpportunity` ao salvar
- **PIPE-06:** URL `/pipeline/[id]` ainda funciona (sheet standalone)
- **PIPE-07:** Server action `reorderOpportunities(stageId, orderedIds[])` persistindo `position`
- **PIPE-08:** Reordenação dentro da mesma coluna com update otimista e rollback
