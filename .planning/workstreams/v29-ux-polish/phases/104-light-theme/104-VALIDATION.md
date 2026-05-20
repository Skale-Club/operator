---
phase: 104
phase_slug: light-theme
date: "2026-05-19"
---

# Phase 104: Light Theme — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run | `npx vitest run --reporter=verbose` |
| Full suite | `npx vitest run` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Rationale |
|--------|----------|-----------|-------------------|-----------|
| THEME-01 | ThemeProvider no longer forces dark mode | manual-only | — | Visual/browser behavior — CSS class application not testable in Node.js Vitest |
| THEME-02 | Light CSS variables resolve correctly | manual-only | — | CSS variable rendering requires a real browser context |
| THEME-03 | Theme persists via localStorage, no flash | manual-only | — | localStorage read timing and FOUC prevention require browser |

**Manual-only justification:** All three requirements are visual/browser behaviors. The project's Vitest environment is Node-only (`environment: 'node'`). A proper visual regression would require Playwright/Storybook — out of scope for this phase.

## Manual Smoke-Test Checklist (Phase Gate)

- [ ] Visit app with OS set to light mode — confirm light mode on first load
- [ ] Toggle to dark — confirm switch; refresh — confirm persists
- [ ] Toggle to light — confirm switch; refresh — confirm persists
- [ ] Dashboard pages render correctly in light (sidebar, cards, tables)
- [ ] `npm run build` exits 0

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task | `npm run build` |
| Per wave | `npm run build && npm run lint` |
| Phase gate | Manual smoke-test checklist + `npm run build` green |

## Wave 0 Gaps

None — no new test files required. All requirements are visual/manual.

## Deferred

- D-08 (login page light mode): auth layout retains `className="dark"` — login page uses hardcoded hex colors throughout and requires a separate reskin task.
