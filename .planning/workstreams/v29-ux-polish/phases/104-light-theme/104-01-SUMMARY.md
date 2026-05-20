---
phase: 104-light-theme
plan: "01"
subsystem: theme
tags: [theme, next-themes, css-variables, tailwind]
dependency_graph:
  requires: []
  provides: [unlocked-theme-provider, light-mode-border-gradient]
  affects: [src/app/layout.tsx, src/app/globals.css]
tech_stack:
  added: []
  patterns: [next-themes system preference, CSS html:not(.dark) selector]
key_files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/app/globals.css
decisions:
  - "Use defaultTheme=system so first-visit experience follows OS preference"
  - "Use disableTransitionOnChange to prevent jarring full-page flash on theme switch"
  - "Add html:not(.dark) .border-gradient override inside @layer utilities for correct light surface rendering"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-19"
  tasks: 3
  files: 2
---

# Phase 104 Plan 01: ThemeProvider Unlock + globals.css Fix Summary

**One-liner:** Removed three ThemeProvider dark-mode lock props and added a light-mode CSS override for border-gradient, enabling the full next-themes system-preference flow.

## Tasks Completed

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Remove ThemeProvider dark-mode locks from layout.tsx | Done | ceb5f5a |
| 2 | Fix border-gradient for light mode in globals.css | Done | ceb5f5a |
| 3 | Build verification | Done | ceb5f5a |

## Changes Made

### src/app/layout.tsx

- Removed `dark ` prefix from html element `className` — html element no longer ships a static dark class from the server
- Removed `forcedTheme="dark"` prop from ThemeProvider
- Changed `defaultTheme="dark"` to `defaultTheme="system"` — first visit now follows OS preference
- Changed `enableSystem={false}` to `enableSystem={true}` — next-themes reads OS media query
- Changed Toaster `theme="dark"` to `theme="system"` — Sonner follows the active theme

### src/app/globals.css

Added inside `@layer utilities`, immediately after the existing `.border-gradient::before` rule:

```css
html:not(.dark) .border-gradient::before {
  background: linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0));
}
```

The original rule uses `rgba(255,255,255,0.08)` which is invisible on light backgrounds. The override uses a 4% black gradient that reads correctly on light surfaces.

## Verification Results

- `grep -c "forcedTheme" src/app/layout.tsx` → 0
- `grep -c 'defaultTheme="system"' src/app/layout.tsx` → 1
- `grep -c 'enableSystem={true}' src/app/layout.tsx` → 1
- `grep -c 'theme="system"' src/app/layout.tsx` → 1
- `grep -c "html:not(.dark) .border-gradient" src/app/globals.css` → 1
- `npm run build` → exit 0, compiled successfully

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The light-mode CSS variable block in `:root` was already fully defined pre-phase. No color values needed to be invented. The ThemeProvider is now fully unlocked and the CSS override is in place.

## Self-Check: PASSED

- `src/app/layout.tsx` modified and committed at ceb5f5a
- `src/app/globals.css` modified and committed at ceb5f5a
- Build exits 0 with zero TypeScript errors
