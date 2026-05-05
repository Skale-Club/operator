# Plan 06-02 Summary — Wire Settings + Env Cleanup

**Status:** COMPLETE ✅
**Date:** 2026-05-04

## What Was Built

- `src/app/(dashboard)/reviews/actions.ts` — `GOOGLE_PLACES_API_KEY` agora lido via `getPlatformSetting()` em vez de `process.env`
- `src/app/api/vapi/phone-numbers/route.ts` — refatorado para ler chave Vapi da tabela `integrations` (provider: vapi) da org autenticada via RLS, em vez de `process.env.VAPI_API_KEY`
- `.env.local` e `.env.local.example` — `VAPI_API_KEY` e `GOOGLE_PLACES_API_KEY` removidos definitivamente

## Result

Zero referências a `VAPI_API_KEY` ou `GOOGLE_PLACES_API_KEY` em `process.env` no codebase.

Sistema de settings em dois níveis completo:
- **Global (platform_settings):** `GOOGLE_PLACES_API_KEY` → gerenciado em `/settings/platform`
- **Por-org (integrations):** `VAPI_API_KEY` → gerenciado em `/integrations` (provider: vapi)
- **Env vars remanescentes:** `VAPI_WEBHOOK_SECRET`, `META_APP_ID`, `META_APP_SECRET` — credenciais de plataforma OAuth/infra, correto permanecerem como env
