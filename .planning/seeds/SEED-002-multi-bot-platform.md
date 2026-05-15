---
id: SEED-002
status: dormant
planted: 2026-05-15
planted_during: post-v1.8 (Executor Completeness completed)
trigger_when: planejamento de v2.0; OU chegada de cliente que peça especialização por domínio; OU qualquer milestone que toque "agent", "assistant", "bot", "prompt", "delegação", "channel-agnostic"; OU pedido explícito
scope: Large
---

# SEED-002: Multi-Bot Platform — Channel-Agnostic Agent Abstraction

Promover **bot/agente a entidade de primeira classe no Operator**, com prompt e tools próprios, podendo se compor (um bot chama outros bots especialistas como "parceiros"), e — crítico — funcionar **igualmente bem em voice e chat**, sem viés de canal.

Este é o milestone que **encerra a forma voice-centric** atual do app. Hoje o "bot" está implícito ou mora dentro da Vapi; chat tem prompt único e nenhum conceito de agente. Isso precisa acabar.

## Why This Matters

### 1. Encerra o viés voice-centric (urgente, princípio do produto)
Hoje o shape do app gravita ao redor do voice/Vapi:
- A única tabela com cara de "agente" é [`assistant_mappings`](supabase/migrations/001_foundation.sql) — e ela só mapeia `vapi_assistant_id → org`. O agente real mora dentro do Vapi.
- [src/lib/chat/](src/lib/chat/) tem streaming Anthropic/OpenRouter mas sem entidade "bot" — parece prompt único por org.
- Tools no [action-engine](src/lib/action-engine/) são escopadas por org, não por agente.

Operator é uma **plataforma de orquestração**. Voice é um canal entre vários (chat web, WhatsApp, Meta, ManyChat, Telegram). Tratar voice como centro estrutural é dívida arquitetural que vai cobrar caro a cada novo canal. Este milestone é a hora de virar a chave.

### 2. Especialização por domínio
Cliente quer bot que entende o vertical dele (clínica odontológica, escritório de advocacia, e-commerce). Hoje é tudo prompt monolítico ou config externa. Bot como entidade permite:
- Catálogo de bots especializados reutilizáveis
- Configuração granular (prompt, tools, KB scope) sem fork de código
- Versionamento e A/B testing de prompt

### 3. Composição multi-bot (parceiros)
Bot generalista detecta intenção fora do escopo → delega pra bot especialista. Padrão de orquestração emergente em sistemas agentic (OpenAI Swarm, Anthropic sub-agents). Permite manter prompts pequenos e focados ao invés de mega-prompt que tenta cobrir tudo.

### 4. Portabilidade entre providers de voice
Hoje acoplado a Vapi. Se Operator é dono da definição do bot e sincroniza pra Vapi via API, fica trivial adicionar Retell, ElevenLabs, ou modelo próprio depois. Sem isso, troca de provider é re-trabalho total.

## When to Surface

**Trigger:** planejamento de v2.0 (virada platform → agentic platform); OU cliente pedindo especialização por domínio; OU qualquer milestone tocando "agent", "assistant", "bot", "prompt", "delegação", "channel-agnostic".

Apresentar este seed durante `/gsd:new-milestone` quando o escopo bater com:
- "Bot", "agente", "assistant", "specialist"
- "Prompt management", "prompt versioning"
- "Multi-agent", "agent orchestration", "delegation", "handoff"
- "Channel-agnostic", "channel abstraction", "unified runtime"
- "v2.0" ou nomes que sugiram virada de paradigma

## Scope Estimate

**Large** — É claramente um milestone, possivelmente o que define v2.0. Componentes mínimos:

1. **Schema** — tabelas `bots`, `bot_tools` (junction), `bot_partners` (junction recursiva), versionamento de prompt
2. **Channel-agnostic runtime** — interface única que voice e chat consomem (`runBot(botId, channel, context)`)
3. **CRUD UI** — criação, edição, teste de bots no dashboard
4. **Integração Vapi** — sync de bot → Vapi assistant (Operator vira source of truth)
5. **Integração chat** — substituir prompt único de [src/lib/chat/](src/lib/chat/) pelo runtime de bot
6. **Delegação multi-bot** — protocolo de handoff/sub-call, contexto compartilhado, detecção de loop
7. **Tool scoping** — RBAC de tools por bot (camada nova sobre action-engine)
8. **Observabilidade** — quem chamou quem, custo por bot, latência por delegação
9. **Testes** — playground / harness pra validar bot antes de publicar

Provavelmente 8-12 fases distribuídas em waves.

## Tradeoffs Conhecidos a Decidir Antes

### 1. Source of truth vs Vapi
**Opção A:** Operator é dono — sincroniza bot pra Vapi via API. Ganha: portabilidade entre providers, single source of truth, consistência voice↔chat. Custo: complexidade de sync, tratamento de drift.

**Opção B:** Bot é meta-conceito, aponta pra `vapi_assistant_id` existente. Ganha: simplicidade. Custo: continua acoplado, não consolida voice↔chat de verdade.

**Recomendação preliminar:** Opção A, alinha com princípio "Operator é hub, Vapi é trigger".

### 2. Custo e latência da delegação multi-bot
Cada handoff = +1 LLM call. Em voice é especialmente crítico — usuário escuta silêncio. Padrões a estudar:
- Streaming de "estou pensando" durante delegação
- Pre-fetch de bot parceiro provável
- Limite de profundidade de delegação (max 2-3 níveis)
- Detecção de loop (bot A → B → A)

### 3. Tool scoping policy
Onde mora a regra "bot X pode usar tool Y"? Sugestão: junction `bot_tools` com flags de permissão; action-engine consulta antes de executar. Vai exigir refactor do `resolve-tool` atual.

### 4. Estado compartilhado entre bots delegados
Bot parceiro precisa do contexto da conversa? Histórico inteiro? Resumo? Variáveis específicas? Decisão de design importante.

### 5. Versionamento de prompt
Editar prompt de bot em produção é arriscado. Precisa de histórico, rollback, talvez staging vs prod. Pode ficar pra fase posterior, mas considerar no schema desde o início.

## Encaixe no Operator

### Refactors necessários (não são "novas features", são mudança de shape)
- [src/lib/chat/](src/lib/chat/) — substituir prompt único por chamada ao runtime de bot
- [src/lib/action-engine/](src/lib/action-engine/) — adicionar camada de scoping por bot
- `assistant_mappings` — possivelmente deprecar ou redefinir como cache do sync Operator→Vapi
- [src/app/api/vapi/](src/app/api/vapi/) — handlers passam a consultar bot do Operator antes de qualquer ação

### Novas features
- Tabelas `bots`, `bot_tools`, `bot_partners`, `bot_prompt_versions`
- `/dashboard/bots` — CRUD UI
- `/dashboard/bots/[id]/test` — playground multi-canal
- Runtime `runBot()` channel-agnostic em `src/lib/agent-runtime/` (ou nome similar)

## Perguntas Abertas

1. **Naming**: "bot" é OK? "Agent" é mais técnico, "assistant" colide com Vapi/OpenAI. Decidir cedo, propaga em tudo.
2. **Quem cria bots**: só admin da org? Templates de marketplace (bot odonto pré-pronto, bot e-commerce)?
3. **Bots cross-org**: faz sentido um bot global compartilhado entre tenants, ou sempre escopado por org?
4. **Knowledge Base por bot**: hoje KB é por org. Bot deve ter KB scope próprio? Subset?
5. **Channel-specific overrides**: mesmo bot, mas prompt levemente diferente em voice vs chat (ex.: "fale em frases curtas" só no voice). Permitir overrides ou forçar prompt único?

## Próximo Passo Quando Retomar

1. Mapear estado atual com [/gsd:map-codebase](.planning/codebase/) focado em "agent abstractions" — confirmar pontos de acoplamento Vapi
2. Decisão arquitetural (research-phase): source of truth vs Vapi
3. Decisão arquitetural (research-phase): protocolo de delegação multi-bot
4. Estudar referências externas: OpenAI Swarm, Anthropic multi-agent patterns, LangGraph, AutoGen
5. Discutir naming + escopo de v2.0 com `/gsd:new-milestone`

## Breadcrumbs

Código existente que vai ser tocado/refatorado:
- [src/lib/chat/](src/lib/chat/) — runtime de chat atual (substituir prompt único)
- [src/lib/chat/stream.ts](src/lib/chat/stream.ts) — orquestração de streaming
- [src/lib/chat/stream/anthropic.ts](src/lib/chat/stream/anthropic.ts) e [openrouter.ts](src/lib/chat/stream/openrouter.ts) — providers
- [src/lib/action-engine/](src/lib/action-engine/) — adicionar camada de scoping por bot
- [src/lib/action-engine/resolve-tool.ts](src/lib/action-engine/resolve-tool.ts) — vai consultar bot
- [src/app/api/vapi/](src/app/api/vapi/) — handlers Vapi consultam bot
- [supabase/migrations/001_foundation.sql](supabase/migrations/001_foundation.sql) — `assistant_mappings` (legacy a redefinir)

Planning relacionado:
- Memória `project_platform_framing.md` — princípio "Operator é hub, Vapi é trigger" — este seed é a execução estrutural disso

Princípio de produto a reforçar no plano:
- Voice e chat são **peers**, não primário/secundário
- Cada feature multi-bot precisa funcionar nos dois canais ou explicar por que não

## Notas

Este seed nasceu de uma observação direta do usuário em 2026-05-15: "me incomoda que o shape do app está em volta do voice, isso precisa acabar, o chat de texto é tão importante quanto." Capturar literalmente esse sentimento — é o critério de sucesso do milestone, não só feature list.

Provável **v2.0**. Concorre em prioridade com SEED-001 (WhatsApp Coexistence). Decisão de qual vem primeiro depende de demanda de cliente real e do deadline regulatório de outubro/2026 que SEED-001 carrega.
