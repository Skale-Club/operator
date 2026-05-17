---
id: SEED-011
status: dormant
planted: 2026-05-17
planted_during: post-v2.1 (Operator CRM + Redesign shipped)
trigger_when: usuário relata UX confusa no chat; OU antes do próximo milestone que toque inbox/atendimento; OU pedido explícito
scope: Medium
priority: high
---

# SEED-011: Chat Inbox Redesign — Coerência Visual Completa

Redesign completo do sistema de chat/inbox (`/chat`, `/conversations/[id]`) para alinhar com o design system v2.1. Os componentes internos (`AdminChatLayout`, `ConversationList`, `ChatArea`) foram intencionalmente preservados durante o v2.1 para evitar regressão funcional — agora precisam ser refeitos com o mesmo nível de polimento de Contacts, Pipeline, Reviews.

**Motivação:** Hoje o chat parece "outra época" do produto comparado ao resto do dashboard. Como é a tela mais usada por atendentes, ela tem que ser a melhor do sistema, não a pior.

---

## Problemas atuais (audit visual)

1. **Lista de conversas (`ConversationList`)** — densidade desorganizada, hierarquia tipográfica fraca, channel icons sem padronização (não usa o `ChannelBadge` novo da Wave 1)
2. **Área de chat (`ChatArea`)** — bubbles de mensagem com cores e radius inconsistentes, header sem informação rica do contato, composer básico demais
3. **Layout geral (`AdminChatLayout`)** — três colunas sem proporção clara, divisórias muito marcadas, sem panel direito de info do contato (que existe no Contacts mas falta aqui)
4. **Filtros e busca** — pills no topo não seguem o padrão dos `StatusPill`/`ChannelBadge` novos; search box pequena demais
5. **Empty states** — quando não há conversa selecionada, é texto plano em vez do `EmptyState` componente
6. **Mobile** — três colunas não viram drawer; provavelmente quebra em telas pequenas
7. **Bot pause/resume** — toggle escondido, deveria ser uma ação de destaque
8. **Indicador de typing** — não existe, é uma feature óbvia que falta
9. **Atribuição** — assign to user não está claramente integrado, escondido em menu

---

## O que precisa ser construído

### Schema (provavelmente nenhuma migration nova)
Os dados já existem — `conversations`, `conversation_messages`, `contacts`, `agents`, `agent_invocations`. O trabalho é puramente UI + UX.

Caso necessário, adicionar:
- `conversations.typing_at timestamptz` — para indicador de "digitando..." (Supabase Realtime broadcast)
- `conversations.pinned boolean` — para pinar conversas importantes
- `conversations.priority text` — para marcar urgência

### Componentes a refazer

**1. Layout (`src/app/(dashboard)/chat/layout.tsx` ou similar)**
- 3 colunas com proporção `320px | 1fr | 360px` em desktop
- Coluna direita (info do contato) colapsável (botão no header)
- Mobile: drawer-based — só uma coluna visível por vez, navegação via swipe ou botões
- Divisórias sutis (`border-subtle`, não `border-strong`)
- Background coerente com o resto: `bg-bg-primary` para o painel principal

**2. Lista de conversas (`ConversationList`)**
- Header sticky com:
  - Título "Conversas" + contagem total
  - Search box grande (full-width, com ícone de busca + Cmd+K hint)
  - Filtros como pills usando o `Badge` componente novo (não Tabs):
    - "Todas" (default)
    - "Não lidas" (com badge de contagem)
    - "Atribuídas a mim"
    - Por canal: WhatsApp, Instagram, SMS, Web, ManyChat (usando `ChannelBadge`)
- Cards de conversa redesenhados:
  - Avatar do contato (do `contacts.id` se vinculado, senão placeholder com inicial do número)
  - Nome do contato OU número formatado
  - Last message preview (1 linha, truncado)
  - Channel badge inline (canto direito)
  - Timestamp relativo ("agora", "5min", "ontem", "12/05")
  - Unread badge com count se houver
  - Hover: `bg-bg-tertiary/50` sutil
  - Selected state: `bg-accent-muted` + border-left de 3px no `--accent`
  - Status pills: bot pausado, atribuído, prioridade
- Empty state: usa `EmptyState` component, "Nenhuma conversa ainda"
- Skeleton loader durante fetch (10 linhas com shimmer)

**3. Área de chat (`ChatArea`)**
- Header rico:
  - Avatar grande (48px) do contato
  - Nome + status pill (online/offline derivado de last_seen)
  - Channel badge + número formatado
  - Botões de ação à direita: Atribuir, Pausar bot, Ligar (link pro voice se tiver contact_id), Mais (menu)
- Mensagens:
  - Bubbles com `border-radius` consistente do design system (12px)
  - Mensagens do cliente: alinhadas à esquerda, fundo `bg-bg-secondary`
  - Mensagens do bot/admin: alinhadas à direita, fundo `bg-accent-muted`
  - Avatar pequeno no canto da bubble (só em mudanças de remetente)
  - Timestamp inline no hover (não sempre visível)
  - Tool calls renderizados inline como cards expansíveis (estilo Playground)
  - Agent badge ("via [Agent Name]") em mensagens automáticas
- Indicador de "digitando..." quando outro lado está respondendo
- Indicador de "agente pensando..." quando runAgent está processando
- Composer redesenhado:
  - Textarea com auto-resize
  - Botões: anexar arquivo, emoji, gravar áudio
  - Hint de atalhos: Enter envia, Shift+Enter quebra linha
  - Botão "Enviar" só ativa quando há texto
- Suporte a copiar mensagem (botão no hover)
- Suporte a citar/responder mensagem (drag-to-reply ou botão)

**4. Panel direito (info do contato — NOVO)**
- Reutilizar `ContactDetailSheet` mas inline em vez de slide-in
- Header com avatar + nome + tags
- Seções colapsáveis:
  - Informações (telefone, email, empresa)
  - Tags (com editor inline)
  - Oportunidades vinculadas (com valor + stage)
  - Chamadas recentes (últimas 3, link para histórico)
  - Outras conversas do contato (outros canais)
- Quick actions no topo: "Adicionar nota", "Criar oportunidade", "Editar contato"
- Quando contato não está vinculado: card "Contato não cadastrado" + botão "Cadastrar agora" que pré-preenche o número

**5. Empty state — sem conversa selecionada**
- Centro do painel principal
- Ilustração ou ícone grande do Wave 1
- Texto: "Selecione uma conversa para começar"
- CTA secundário: "Ou abra a paleta de comandos (⌘K)"

### Features funcionais a adicionar

- **Typing indicator real-time** via Supabase Realtime broadcast
- **Pin de conversa** — pinned aparecem no topo da lista, ícone de pin sutil
- **Marcar como prioridade** — borda lateral colorida na conversa
- **Sair da conversa** (admin) — não atribuir mais, voltar pra inbox geral
- **Atribuir rápido** — dropdown com membros do org
- **Histórico de bot pause/resume** no feed da conversa (system message)

### Microinterações

- Nova mensagem chega → conversa sobe pro topo da lista com animação suave
- Bubble de mensagem entra com fade + slide-up de 8px (200ms)
- Selecionar conversa → highlight com transição (não snap)
- Composer foca automaticamente ao selecionar conversa
- Scroll automático pro fim quando nova mensagem chega (a menos que o user esteja scrollado pra cima)

---

## Scope

**Medium — 3-4 fases, ~12 plans**

### Decomposição sugerida

- **Fase 1:** Refactor da lista de conversas + filtros + search + skeleton
- **Fase 2:** Refactor da área de chat (header + mensagens + composer)
- **Fase 3:** Panel direito de info do contato (reuso do `ContactDetailSheet` adaptado)
- **Fase 4:** Features funcionais (typing indicator, pin, prioridade, assign) + mobile responsive

---

## Referências de código existente

- `src/components/conversations/ConversationList.tsx` (ou similar) — a refazer
- `src/components/conversations/ChatArea.tsx` — a refazer  
- `src/components/admin/AdminChatLayout.tsx` — a refazer
- `src/components/contacts/contact-detail-sheet.tsx` (Wave 2) — referência de padrão
- `src/components/design-system/channel-badge.tsx` (Wave 1) — usar
- `src/components/design-system/status-pill.tsx` (Wave 1) — usar
- `src/components/empty-states/` (Wave 1) — usar
- `src/components/skeletons/` (Wave 1) — usar
- `src/lib/supabase/realtime/` — para typing indicator broadcast

---

## Critérios de sucesso

1. ✅ Chat está visualmente coerente com Contacts, Pipeline, Reviews
2. ✅ Lista de conversas usa `ChannelBadge` + `StatusPill` componentes do design system
3. ✅ Bubbles de mensagem seguem o `--radius-12` + cores do design system
4. ✅ Panel direito de contato funciona inline (não slide-in)
5. ✅ Empty state usa `EmptyState` component
6. ✅ Typing indicator funcional via Realtime
7. ✅ Pin + priority funcionais
8. ✅ Mobile responsivo (drawer-based)
9. ✅ Composer com textarea auto-resize + atalhos
10. ✅ Header da conversa com info rica + ações claras

---

## Próximo passo

Quando trigger surfar: `/gsd:new-milestone` ou inserir como fase decimal no milestone atual. É um seed compacto, dá pra entregar em 2-3 dias com agentes paralelos.
