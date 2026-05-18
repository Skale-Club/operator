---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: CRM Expansion
status: defining_requirements
stopped_at: Milestone scaffolded; requirements + roadmap next
last_updated: "2026-05-18T00:00:00.000Z"
last_activity: 2026-05-18
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Xphere - State (v2.4 CRM Expansion)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-18 — Milestone v2.4 started

## Milestone Progress

- v1.0 MVP: ✅ Shipped 2026-04-03
- v1.1 Knowledge Base: ✅ Shipped 2026-04-03
- v1.2 Operator + Embedded Chatbot: ✅ Shipped 2026-04-05
- v1.3 Google Reviews Widget + Meta Messaging: ✅ Shipped 2026-05-05
- v1.4 Chat System Refactor: ✅ Shipped 2026-05-05
- v1.5 Tools Folder System: ✅ Shipped 2026-05-06
- v1.6 ManyChat Integration: ✅ Shipped 2026-05-07
- v1.7 Google Contacts Integration: ✅ Shipped 2026-05-07
- v1.8 Executor Completeness: ✅ Shipped 2026-05-08
- v1.9 GHL Lost-Lead Reengagement (SMS): ✅ Shipped 2026-05-16
- v2.0 Multi-Bot Platform: ✅ Shipped 2026-05-17
- v2.1 Calls + Contacts + Pipeline + Design Foundation: ✅ Shipped 2026-05-17
- v2.2 Chat Redesign — Schema + Server Actions Foundation: 🚧 separate workstream
- v2.3 Integrations Refactor + Twilio Multi-Number: 🚧 human_uat (workstreams/v23-integrations-multi-number)
- **v2.4 CRM Expansion: 🚧 defining_requirements (this workstream)**

## Project Reference

See `.planning/PROJECT.md` for vision, validated requirements, decisions.
See `.planning/MILESTONES.md` for shipped history.
See `.planning/workstreams/v24-crm-expansion/ROADMAP.md` for v2.4 phase details (written next).
See `.planning/seeds/SEED-016-accounts-crm-companies.md`, `SEED-017-custom-fields-system.md`, `SEED-018-contact-import-pipeline.md` for the source intent.

**Core value:** Xphere is a tenant-aware integration and orchestration platform — reusable platform capabilities over hardcoding any single client's playbook.
**App name:** Xphere (was Operator)
**Production origin:** https://xphere.skale.club

## Accumulated Context

### v2.4 Scope (from seeds)

Three coupled features that together promote contacts/opportunities into a full CRM model:

1. **Accounts (SEED-016)** — new `accounts` table (DB) / "Companies" (UI). FK from contacts and opportunities; CHECK constraint that opportunities have at least one of contact_id or account_id. Idempotent data migration auto-creates accounts from distinct `contacts.company` strings per org, keeping the legacy `company text` column as a nullable fallback for one milestone.

2. **Custom Fields System (SEED-017)** — `custom_field_definitions` metadata table on top of the existing `custom_fields jsonb` columns. Covers 3 entities (contact, opportunity, account). 13 field types: text, long_text, number, integer, boolean, date, datetime, select, multi_select, url, email, phone, currency. Settings UI with drag-reorder, groups, archive. Server-side zod validation. Dynamic columns + filters in entity lists.

3. **Contact Import Pipeline (SEED-018)** — replaces the current 5MB synchronous import with a queued, observable, runtime-portable pipeline. 50MB/200k row limits. Direct-to-Storage upload via signed URL (no Vercel body limit; real upload progress). Background worker (Edge Function in v1, swappable to Node post-Hetzner). Mapping wizard speaks custom-fields. Dedup preview (skip/update/create). Per-row errors persisted in `contact_import_errors` for review and retry. Realtime progress via `postgres_changes` on `contact_imports`.

### Decisions locked before requirements

- **Naming:** `accounts` in DB, "Companies" in UI. `organizations` stays reserved for the multi-tenant boundary.
- **Custom-fields types in v1:** basic (text/long_text/number/integer/boolean/date/datetime/select/multi_select) + URL/email/phone/currency. Relations and file uploads are deferred.
- **`contacts.company` migration strategy:** auto-create accounts from distinct values; keep `company text` as nullable fallback for one milestone for revertibility.
- **Custom-fields scope in v1:** contact + opportunity + account. Pipelines/stages deferred.
- **Hetzner-portable design:** worker behind interface, storage behind interface, queue = status column with `SELECT FOR UPDATE SKIP LOCKED`, no Vercel KV/Blob/edge runtime.
- **Execution order:** SEED-016 → SEED-017 → SEED-018 (accounts first so custom fields and import wizard cover all 3 entities from day one).

### Reserved for future milestones (NOT in v2.4)

- Account hierarchy (`parent_account_id`)
- Custom-field types: relation FK, file upload
- Custom fields on pipelines/stages
- Field type migration (`select` -> `text` after values exist)
- XLSX/JSON import (CSV only in v1)
- Billing-driven per-plan limits on imports / fields

### Cross-workstream awareness

- v2.3 (`workstreams/v23-integrations-multi-number`) is in `human_uat` — orthogonal, no schema/UI overlap with v2.4
- Hetzner migration memory: `project_hetzner_migration.md` — applies to SEED-018 worker/storage choices

## Decisions

(filled by roadmapper + planner during phase work)

## Pending Todos

- ⚠️ v2.3 HUMAN-UAT still owed — operator runs `workstreams/v23-integrations-multi-number/phases/63-polish/63-HUMAN-UAT.md` before v2.3 can be marked complete
- 🧹 Carried tech debt: `npm run lint` broken (Next.js 16 removed `next lint`) — wire eslint.config.js when convenient. Build gate: `npm run build` is the type-check authority

## Session Continuity

Last session: 2026-05-18
Stopped at: Milestone v2.4 scaffolded (PROJECT.md updated, STATE.md written). Next: define REQUIREMENTS.md, then spawn roadmapper.
