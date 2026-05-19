---
phase: 82
slug: super-admin-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured in project) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 82-01-01 | 01 | 0 | ADM-01 | build | `npm run build` | ⬜ pending |
| 82-01-02 | 01 | 1 | ADM-01, ADM-02 | build + manual | `npm run build` | ⬜ pending |
| 82-02-01 | 02 | 2 | ADM-02, ADM-03 | build | `npm run build` | ⬜ pending |
| 82-03-01 | 03 | 3 | ADM-03, ADM-04 | build | `npm run build` | ⬜ pending |
| 82-04-01 | 04 | 4 | ADM-04, ADM-05 | build | `npm run build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/069_org_settings_jsonb.sql` — adds `settings jsonb DEFAULT '{}'::jsonb` to `organizations` table (CRITICAL: referenced throughout CONTEXT.md but missing from DB)
- [ ] `src/types/database.ts` updated to include `settings: Json | null` field on `organizations` row type

*Note: `createServiceRoleClient()` already exists at `src/lib/supabase/admin.ts` — no new infrastructure needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email gate blocks non-admin | ADM-01 | Requires browser session with non-admin account | Log in as any non-admin user and visit /admin — should redirect to /dashboard |
| Email gate allows admin | ADM-01 | Requires browser session with skale.club@gmail.com | Log in as skale.club@gmail.com and visit /admin — should load admin panel |
| Feature flag toggle persists | ADM-04 | Requires Supabase DB read-back | Toggle a feature flag, reload page, confirm toggle state is preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
