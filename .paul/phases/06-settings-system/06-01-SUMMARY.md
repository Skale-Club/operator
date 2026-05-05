# Plan 06-01 Summary — Platform Settings Infrastructure

**Status:** COMPLETE ✅
**Date:** 2026-05-04

## What Was Built

- `supabase/migrations/021_platform_settings.sql` — tabela global `platform_settings` com RLS (read: authenticated, write: service role only)
- `src/lib/platform-settings.ts` — `getPlatformSetting`, `getPlatformSettingHint`, `setPlatformSetting` usando AES-256-GCM (mesmo padrão do `integrations`)
- `src/lib/platform-keys.ts` — catálogo de chaves gerenciadas com `label`, `description` e `tab` por categoria
- `src/app/(dashboard)/settings/platform/` — página e server actions com guard por `PLATFORM_ADMIN_EMAIL`
- `src/components/settings/platform-settings-form.tsx` — formulário com Tabs por categoria
- `src/app/(dashboard)/settings/page.tsx` — redirect `/settings` → `/settings/platform`
- `src/components/layout/app-sidebar.tsx` — link "Platform Settings" no menu do avatar (visível só para admin)
- `.env.local` e `.env.local.example` — consolidados, `PLATFORM_ADMIN_EMAIL` adicionado

## Side fixes durante execução

- Instaladas 7 dependências faltando do sync (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@radix-ui/react-scroll-area`, `@radix-ui/react-tabs`, `react-resizable-panels`)
- `src/types/database.ts` — tipo `platform_settings` adicionado
- `src/components/tools/tools-table.tsx` — `DndContext` movido para fora de `<TableBody>` (hydration error fix)
- Sidebar: email duplicado no footer corrigido

## Decisions

- Guard de admin por email (`PLATFORM_ADMIN_EMAIL`) em vez de role no banco — simples e suficiente para plataforma de operador único
- Tabs por categoria derivadas automaticamente de `PLATFORM_KEY_META` — extensível sem tocar no componente
