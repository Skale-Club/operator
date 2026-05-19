---
id: SEED-013
status: shipped
shipped_in: v2.1
planted: 2026-05-17
planted_during: post-v1.8 milestone
trigger_when: pedido explícito ou quando a migração de contacts for considerada necessária
scope: Medium
priority: medium
---

# SEED-013: Sistema de Tags Completo

Tags gerenciáveis com cores, painéis de administração, e vinculação a múltiplas entidades (contacts, opportunities, conversations). Substituição do atual `text[]` em `contacts` por entidades reais reusáveis em todo o sistema.

---

## Motivação

O sistema atual tem `tags text[]` no modelo `contacts` — fácil de começar, mas não escala:

- Não há cores por tag (não há como diferenciar visualmente "VIP" de "Cold Lead")
- Sem painel para ver, renomear ou deletar todas as tags em uso
- Typos se acumulam silenciosamente: "lead", "Lead", "lEAD" viram entidades separadas
- Impossível reusar as mesmas tags de contacts em opportunities ou conversations sem duplicar

---

## Modelo de dados — Schema

### Tabela principal: `tags`

```sql
CREATE TABLE public.tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,                  -- normalizado: lowercase + hífens
  color      text NOT NULL DEFAULT '#6B7280', -- hex, ex: '#10B981'
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (org_id, slug)
);

-- RLS via get_current_org_id()
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_org_member" ON public.tags
  FOR ALL TO authenticated
  USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
```

### Paleta de cores padrão

16 cores pré-definidas no seed (usuário pode escolher qualquer hex via color picker):

```
Slate   #64748B    Red     #EF4444    Orange  #F97316    Amber  #F59E0B
Yellow  #EAB308    Lime    #84CC16    Green   #22C55E    Teal   #14B8A6
Cyan    #06B6D4    Blue    #3B82F6    Indigo  #6366F1    Violet #8B5CF6
Purple  #A855F7    Pink    #EC4899    Rose    #F43F5E    Zinc   #71717A
```

### Junction tables

```sql
-- contacts ↔ tags (substitui contacts.tags text[])
CREATE TABLE public.contact_tags (
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  tagged_at  timestamptz NOT NULL DEFAULT now(),
  tagged_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (contact_id, tag_id)
);

-- RLS: somente membros da org que possui o contato
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_tags_org_member" ON public.contact_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.org_id = get_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.org_id = get_current_org_id()
    )
  );

-- opportunities ↔ tags
CREATE TABLE public.opportunity_tags (
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id         uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  tagged_at      timestamptz NOT NULL DEFAULT now(),
  tagged_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (opportunity_id, tag_id)
);

ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunity_tags_org_member" ON public.opportunity_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.org_id = get_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.org_id = get_current_org_id()
    )
  );
```

### Migração de dados existentes

```sql
-- Converter contacts.tags text[] para o novo schema
-- Cria tags a partir dos valores únicos existentes, depois insere nas junction tables

INSERT INTO public.tags (org_id, name, slug, color)
SELECT DISTINCT ON (c.org_id, lower(trim(t.tag)))
  c.org_id,
  trim(t.tag),
  lower(regexp_replace(trim(t.tag), '[^a-z0-9]+', '-', 'g')),
  '#6B7280'
FROM public.contacts c, unnest(c.tags) AS t(tag)
WHERE trim(t.tag) <> ''
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO public.contact_tags (contact_id, tag_id)
SELECT c.id, tg.id
FROM public.contacts c
  , unnest(c.tags) AS t(tag)
JOIN public.tags tg
  ON tg.org_id = c.org_id
  AND tg.slug = lower(regexp_replace(trim(t.tag), '[^a-z0-9]+', '-', 'g'))
ON CONFLICT DO NOTHING;

-- Remover a coluna antiga apenas após validação em produção
-- ALTER TABLE public.contacts DROP COLUMN tags;
-- (deixar para uma fase posterior — backward compat)
```

---

## Painel de gerenciamento — `/settings/tags`

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Tags                                               [+ New tag] │
│  Manage the tags used across contacts and opportunities          │
├─────────────────────────────────────────────────────────────────┤
│  Search tags...                        All / Contacts / Deals   │
├────┬──────────────┬──────────┬─────────────────────┬────────────┤
│ ●  │ Name         │ Color    │ Used in             │  Actions   │
├────┼──────────────┼──────────┼─────────────────────┼────────────┤
│ ●  │ VIP          │ #F59E0B  │ 12 contacts, 3 deals│ Edit Delete│
│ ●  │ Cold Lead    │ #6366F1  │ 45 contacts         │ Edit Delete│
│ ●  │ Hot          │ #EF4444  │ 8 contacts, 1 deal  │ Edit Delete│
│ ●  │ Parceiro     │ #22C55E  │ 3 contacts          │ Edit Delete│
└────┴──────────────┴──────────┴─────────────────────┴────────────┘
```

- Badge colorido (●) na cor da tag
- Coluna "Used in" mostra contagem de cada entity type vinculada
- Delete com confirmação inline: "This tag is used in 12 contacts. Deleting it will remove the tag from all of them."
- Sort por nome (default) ou por "Most used"

### Modal de criação/edição

```
┌──────────────────────────────────────────┐
│  Create tag                              │
├──────────────────────────────────────────┤
│  Name                                    │
│  ┌────────────────────────────────────┐  │
│  │  VIP                               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Color                                   │
│  ┌──────────────────────────────────┐   │
│  │ ● ● ● ● ● ● ● ● (16 swatches)  │   │
│  │ Custom: [#F59E0B] (hex input)   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Preview: [● VIP]                        │
│                                          │
│  [Cancel]                  [Create tag]  │
└──────────────────────────────────────────┘
```

- Preview ao vivo da badge colorida
- Input de hex com #-prefix, validação de 6 chars
- Slug gerado automaticamente (read-only, mostrado em cinza)

---

## Componente `<TagPicker>` — Reutilizável

Usado em contact-form, opportunity-form, e qualquer contexto futuro.

### API pública

```tsx
interface TagPickerProps {
  entityType: 'contact' | 'opportunity'     // para queries corretas
  entityId?: string                          // undefined = modo "novo registro"
  value: string[]                            // array de tag IDs selecionados
  onChange: (tagIds: string[]) => void
  placeholder?: string
  className?: string
}
```

### Comportamento

1. Input de busca inline que filtra tags da org
2. Tags disponíveis listadas em dropdown com badge colorida
3. Tags já selecionadas aparecem como chips coloridos abaixo do input
4. "Create new tag" inline quando não há match exato (abre modal mínimo name+color)
5. Chips podem ser removidos via × ou Backspace

### Implementação — Server Actions

```ts
// tags/actions.ts
export async function listTags(): Promise<Tag[]>
export async function createTag(input: { name: string; color: string }): Promise<Tag>
export async function updateTag(id: string, input: { name?: string; color?: string }): Promise<Tag>
export async function deleteTag(id: string): Promise<void>

// tag-assignments/actions.ts  
export async function setContactTags(contactId: string, tagIds: string[]): Promise<void>
export async function setOpportunityTags(opportunityId: string, tagIds: string[]): Promise<void>
```

`setContactTags` faz delete + insert (replace strategy) em vez de diff, simples e seguro.

---

## Integração com Contact Form

Substituir o input de texto livre atual pelo `<TagPicker>`:

**Antes (contact-form.tsx):**
```tsx
// tags: text[] simples, digitado à mão
const [tagDraft, setTagDraft] = useState('')
function commitTag() { ... }
```

**Depois:**
```tsx
// tags: string[] de IDs, gerenciados pelo TagPicker
<TagPicker
  entityType="contact"
  value={selectedTagIds}
  onChange={setSelectedTagIds}
/>
```

---

## Integração com Contact Detail / Info Panel

No painel lateral do chat (`contact-info-panel.tsx`) e na página de detalhe do contato:

- Tags aparecem como badges coloridas (read-only view)
- Botão "Edit tags" inline que abre o TagPicker em modo inline
- Salva via `setContactTags` sem recarregar a página

---

## Integração com Contacts Table

Na listagem `/contacts`:

- Coluna "Tags" com até 3 badges + "+N" se mais
- Filtro lateral "Filter by tag" com multiselect colorido
- Query: `contact_tags.tag_id IN (...)` em vez de `contacts.tags @> ARRAY[...]`

---

## Integração com Pipeline

Na opportunity card do kanban e no formulário de oportunidade:

- Badge tags visíveis no card (2-3 tags, cor real)
- `<TagPicker entityType="opportunity" />` no modal de edição
- Filtro de pipeline por tag

---

## File Structure

```
src/
  app/(dashboard)/settings/tags/
    page.tsx                    ← Tag management panel (Server Component)
    loading.tsx
    actions.ts                  ← listTags, createTag, updateTag, deleteTag
  
  components/tags/
    tag-picker.tsx              ← Client component, combobox + inline create
    tag-badge.tsx               ← Small colored badge (●  Name ×)
    tag-swatch.tsx              ← Color swatch for color picker grid
    tag-form-modal.tsx          ← Create/Edit modal (name + color picker)
    tag-filter.tsx              ← Multiselect filter for lists
  
  app/(dashboard)/contacts/
    (modified) page.tsx         ← Add filter by tag
    (modified) actions.ts       ← Filter contacts by tagIds[]

supabase/migrations/
  060_tags_system.sql           ← tags table, junction tables, RLS, indexes
  061_tags_migrate_contacts.sql ← Migrar contacts.tags text[] → contact_tags
```

---

## Decomposição sugerida — 3 fases

### Fase T1 — Database + CRUD API

**Objetivo:** Schema criado, actions funcionando, painel `/settings/tags` com listagem + create/edit/delete.

**Tasks:**
- Migration `060_tags_system.sql` (tags table + junction tables + RLS + indexes)
- Migration `061_tags_migrate_contacts.sql` (migrar dados existentes)
- Server actions: `listTags`, `createTag`, `updateTag`, `deleteTag`
- Query de "used in" por tag (count por entity type)
- `/settings/tags` page (table de tags + botões CRUD)
- `TagFormModal` (create/edit com color picker 16 swatches + hex input)
- Adicionar link "Tags" na sidebar de settings
- `npm run build` + validação do schema de types

**Resultado:** Painel funcional isolado, sem integrar nos outros forms ainda.

---

### Fase T2 — TagPicker + integração em Contacts

**Objetivo:** `<TagPicker>` funcional, contact form e listagem usando o novo sistema.

**Tasks:**
- `tag-badge.tsx` — badge colorida reutilizável
- `tag-picker.tsx` — combobox com search, multiselect, inline create
- Substituir campo de tags no `contact-form.tsx` pelo `<TagPicker>`
- Server actions: `setContactTags`, `getContactTags`
- Contact detail / `contact-info-panel.tsx` — mostrar tags coloridas + edição inline
- Contacts table — coluna de tags coloridas + filter by tag
- Backward compat: manter `contacts.tags text[]` ainda preenchido em paralelo (remover em T3)
- `npm run build` + testes manuais no fluxo de criar/editar contato

**Resultado:** Tags funcionando end-to-end para contacts com visual colorido.

---

### Fase T3 — Integração em Pipeline + cleanup

**Objetivo:** Tags em opportunities, remoção da coluna legada, polish final.

**Tasks:**
- `setOpportunityTags`, `getOpportunityTags` actions
- Opportunity form — adicionar `<TagPicker entityType="opportunity" />`
- Pipeline kanban card — mostrar 2-3 tags coloridas no card
- Pipeline filter by tag
- Remover `contacts.tags text[]` via `ALTER TABLE ... DROP COLUMN tags` (migration `062_drop_contacts_tags_column.sql`)
- Atualizar `src/types/database.ts`
- Limpar referências legadas (contact-form.tsx texto livre, index GIN antigo)
- `npm run build` final + validação completa

**Resultado:** Sistema de tags completo e limpo, sem código legado.

---

## Critérios de sucesso

1. ✅ Painel `/settings/tags` com CRUD completo
2. ✅ Cada tag tem cor personalizada (16 swatches + hex livre)
3. ✅ Tags reusáveis entre contacts e opportunities (mesma entidade, não duplicadas)
4. ✅ Badges coloridas aparecem em: contact form, contact detail, contacts table, pipeline card
5. ✅ Filtro por tag nas listagens de contacts e pipeline
6. ✅ Migração de dados existentes (`text[]` → junction table) sem perda
7. ✅ Coluna `contacts.tags` removida no final (sem código legado)
8. ✅ `npm run build` passa sem erros TypeScript
9. ✅ RLS: usuário só vê tags da própria org
10. ✅ Delete com contagem de uso e confirmação antes de deletar

---

## Anti-patterns a evitar

❌ Tag name como PK (muda quando renomeia) — usar UUID  
❌ Cor como enum fixo — livre escolha de hex (16 sugestões + input livre)  
❌ `text[]` tag-names no junction table — sempre IDs  
❌ Delete sem verificar uso — mostrar contagem e pedir confirmação  
❌ TagPicker que faz query por letra digitada sem debounce — usar lista completa carregada uma vez (orgs têm < 500 tags na prática)  
❌ Criar nova tag sem validar slug único — retornar erro amigável "Tag 'lead' already exists"

---

## Próximo passo

```
/gsd:new-milestone "v1.9 Tags System"
```

ou adicionar como fases dentro do próximo milestone em andamento.
