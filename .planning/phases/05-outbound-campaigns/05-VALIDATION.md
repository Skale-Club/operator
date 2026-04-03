---
phase: 5
slug: outbound-campaigns
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (already installed) |
| **Config file** | `vitest.config.ts` — exists from Phase 1 |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 01 | 1 | CAMP-01, CAMP-07 | grep/SQL | `grep -c "REPLICA IDENTITY FULL" supabase/migrations/005_campaigns.sql` | ✅ | ⬜ pending |
| 05-01-T2 | 01 | 1 | CAMP-01 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-02-T1 | 02 | 1 | CAMP-02, CAMP-06 | unit | `npx vitest run tests/csv-parser.test.ts tests/campaign-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-T2 | 02 | 1 | CAMP-01–07 | unit | `npx vitest run tests/campaigns.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-T1 | 03 | 2 | CAMP-05, CAMP-06 | unit | `npx vitest run tests/campaigns.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-T2 | 03 | 2 | CAMP-04, CAMP-06 | unit | `npx vitest run tests/campaign-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-T1 | 04 | 3 | CAMP-01, CAMP-03, CAMP-04 | unit | `npx vitest run tests/campaigns.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-T2 | 04 | 3 | CAMP-03, CAMP-04, CAMP-05 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-05-T1 | 05 | 4 | CAMP-01, CAMP-02, CAMP-06 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-05-T2 | 05 | 4 | CAMP-03 | grep | `grep "active: true" src/components/layout/app-sidebar.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/campaigns.test.ts` — stubs for CAMP-01, CAMP-03, CAMP-04, CAMP-05, CAMP-07
- [ ] `tests/csv-parser.test.ts` — stubs for CAMP-02
- [ ] `tests/campaign-webhook.test.ts` — stubs for CAMP-06
- [ ] `npm install papaparse @types/papaparse` — required before implementation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time contact status updates in UI | CAMP-06 | Requires live Supabase Realtime connection | Start campaign, watch contact rows update from pending→calling→completed in browser |
| Outbound call actually dials | CAMP-05 | Requires live Vapi API key + phone number | Create 1-contact campaign, start it, verify call is initiated in Vapi dashboard |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 test files)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
