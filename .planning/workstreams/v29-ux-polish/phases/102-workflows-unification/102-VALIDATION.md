---
phase: 102
phase_slug: workflows-unification
date: "2026-05-20"
---

# Phase 102: Workflows Unification — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run | `npx vitest run` |
| Full suite | `npx vitest run` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| FLOW-01 | Sidebar has single "Workflows" entry at `/workflows` | manual smoke | `npm run build` | No unit test for nav — visual verification |
| FLOW-02 | `/workflows` renders without 404 or TypeScript errors | automated | `npm run build` | Type check catches broken imports |
| FLOW-03 | Tool configs CRUD still works at new routes | manual | `npm run build` | Server actions untouched — logic unchanged |
| FLOW-04 | Visual flows still accessible and functional | manual | `npm run build` | Store + engine untouched |
| FLOW-05 | Old `/automations/**` URLs redirect cleanly to `/workflows/**` | manual | navigate in browser | Redirect stubs verified by build |

**Phase gate:** `npm run build` exits 0 — catches all broken imports, missing modules, and TypeScript errors from the route rename.

## Manual Smoke-Test Checklist

- [ ] Sidebar shows single "Workflows" entry — no separate "Automations" or "Flows" items
- [ ] `/workflows` loads unified page with two tabs (Automations | Flows)
- [ ] Tool configs tab: existing automations listed, CRUD works
- [ ] Flows tab: existing visual flows listed, open/edit works
- [ ] Old URL `/automations` redirects to `/workflows`
- [ ] Old URL `/automations/flows` redirects to `/workflows/flows`
- [ ] `npm run build` exits 0

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task | `npm run build` (Plan 03 Task 3) |
| Phase gate | `npm run build` exits 0 + manual smoke-test |

## Wave 0 Gaps

None — this phase is a pure routing rename. No new test files required. All business logic (action engine, flow store, server actions) is preserved untouched.
