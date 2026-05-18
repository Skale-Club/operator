# GHL Lost-Lead Reengagement (SMS) — Operator Setup

**Phase:** 32 (milestone v1.9)
**Automation type:** scheduled outbound SMS via GHL Conversations API
**Target:** Skleanings GHL sub-account; one SMS per Lost opportunity > 180 days (configurable) — never re-sent.

***

## Overview

A GitHub Actions workflow POSTs to a protected internal endpoint every 15 minutes (pulse). The actual schedule lives in the database (`public.automation_schedules`, row `automation_key='ghl_reengagement_sms'`) — the runner decides whether each pulse should actually dispatch.

Per pulse, when due, the runner:

1. Lists GHL Lost opportunities older than `THRESHOLD_DAYS`
2. Skips contacts already in the `ghl_reengagement_sent` anti-loop table
3. Renders the SMS body by substituting `{{first_name}}` (falls back to `amigo(a)`)
4. Claim-first INSERT into `ghl_reengagement_sent`
5. Dispatches via the GHL Conversations API (`sendSmsViaGhl`) — using `contactId` direct
6. On GHL failure (e.g. contact has no phone), rolls back the claim (the contact retries next due run)
7. Logs every attempt in `action_logs` with `tool_name='ghl_reengagement_sms'`
8. Updates `automation_schedules` with `last_run_at`, `next_run_at = now + interval_minutes`, `last_run_status`, `last_run_result`

The endpoint returns JSON: `{ processed, sent, skipped, failed, errors[] }` (when it actually ran), or `{ skipped: 'inactive' }` / `{ skipped: 'not_due_yet', next_run_at }` when the schedule said skip.

***

## Required Vercel Environment Variables

Set these on the **production** scope of the Vercel project:

| Variable | Required | Description |
|----------|----------|-------------|
| `GHL_REENGAGEMENT_LOCATION_ID` | yes | GHL sub-account (location) ID for Skleanings |
| `GHL_REENGAGEMENT_INTEGRATION_ID` | yes | `integrations.id` (UUID) for the row holding the Skleanings GHL Private Integration Token. This row provides creds for BOTH listing opportunities AND sending SMS (D-32-04). Must have `provider='gohighlevel'` and `is_active=true`. |
| `GHL_REENGAGEMENT_MESSAGE` | yes | SMS template — must contain `{{first_name}}` (e.g. `"Olá {{first_name}}, sentimos sua falta na Skleanings! Quer agendar uma limpeza?"`) |
| `GHL_REENGAGEMENT_TRIGGER_SECRET` | yes | Bearer secret for the runner endpoint. Generate with `openssl rand -hex 32`. Same value goes into the GitHub secret below. |
| `GHL_REENGAGEMENT_THRESHOLD_DAYS` | no (default `180`) | Only opportunities whose `updatedAt` is older than this many days are eligible |
| `GHL_REENGAGEMENT_BATCH_LIMIT` | no (default `20`) | Max successful sends per due run. Default sized for Vercel Hobby 10s function timeout. Raise to 50-100 only on Vercel Pro. |
| `GHL_REENGAGEMENT_FROM_NUMBER` | no (no default) | Optional override for the GHL sub-account default SMS sending number. When unset, GHL picks the default. |

There is **no `GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID`** — SMS goes through the GHL Conversations API, not a separate provider.

How to set on Vercel:
1. Open the Vercel project → Settings → Environment Variables
2. Add each variable scoped to **Production** (and optionally Preview)
3. Redeploy so the new values are picked up by the running deployment

***

## Required GitHub Repository Secrets

Set these in **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Value |
|--------|-------|
| `OPERATOR_BASE_URL` | `https://xphere.skale.club` (or the active production origin) |
| `GHL_REENGAGEMENT_TRIGGER_SECRET` | Same value as the Vercel env var of the same name |

If they diverge, the workflow will receive HTTP 401 from the runner.

***

## How the Schedule Works

The cron lives in **two places**:

1. **GitHub Actions** (`.github/workflows/ghl-reengagement.yml`) — fires every 15 minutes (`cron: '*/15 * * * *'`). This is just a "pulse" that calls the runner endpoint. It does NOT decide when the work actually happens.

2. **Database** (`public.automation_schedules` row with `automation_key='ghl_reengagement_sms'`) — holds the real schedule:
   - `is_active` — set to `false` to pause the automation
   - `next_run_at` — when the next dispatch should happen
   - `interval_minutes` — how long after each successful run until the next (`1440` = daily, `60` = hourly)

On each 15-minute pulse, the runner:
- Returns `{ skipped: 'inactive' }` if `is_active=false`
- Returns `{ skipped: 'not_due_yet', next_run_at }` if `next_run_at > now()` (unless `?force=1`)
- Otherwise runs, then sets `next_run_at = now() + interval_minutes minutes` for the following run

### Change the schedule with SQL (no UI in v1.9)

Run these in Supabase Studio → SQL Editor. The seed values from migration 033 are daily at 14:00 UTC.

**Pause the automation:**

```sql
UPDATE public.automation_schedules
   SET is_active = false,
       updated_at = now()
 WHERE automation_key = 'ghl_reengagement_sms';
```

**Resume:**

```sql
UPDATE public.automation_schedules
   SET is_active = true,
       updated_at = now()
 WHERE automation_key = 'ghl_reengagement_sms';
```

**Run again immediately on the next pulse:**

```sql
UPDATE public.automation_schedules
   SET next_run_at = now(),
       updated_at = now()
 WHERE automation_key = 'ghl_reengagement_sms';
```

**Change cadence to hourly:**

```sql
UPDATE public.automation_schedules
   SET interval_minutes = 60,
       updated_at = now()
 WHERE automation_key = 'ghl_reengagement_sms';
```

**Move the daily run to 17:00 UTC instead of 14:00 UTC:**

```sql
UPDATE public.automation_schedules
   SET next_run_at = (date_trunc('day', now()) + interval '1 day 17 hours'),
       interval_minutes = 1440,
       updated_at = now()
 WHERE automation_key = 'ghl_reengagement_sms';
```

***

## Manual Trigger (`?force=1`)

To run the automation ad-hoc (e.g. testing after changing env vars):

1. Open the GitHub repository → **Actions** tab
2. Select **GHL Lost-Lead Reengagement (SMS) — pulse**
3. Click **Run workflow**
4. Set `force` input to `true` → the workflow appends `?force=1` to the URL → the runner bypasses `next_run_at`
5. Confirm

Via `gh` CLI:

```sh
gh workflow run ghl-reengagement.yml -f force=true
```

Without `force=true` (or by editing the URL by hand), the manual run still respects the DB schedule and will likely return `{ skipped: 'not_due_yet' }`.

***

## Operational Verification

After a run completes (scheduled or manual):

1. **GitHub Actions log:** the `POST runner endpoint` step prints `HTTP Status: 200` and the JSON body
2. **`action_logs` table:** one row per dispatch attempt with `tool_name='ghl_reengagement_sms'` and `vapi_call_id='cron:ghl-reengagement:<iso>'`
3. **`ghl_reengagement_sent` table:** one row per successfully-sent contact (no row for failed dispatches — claim was rolled back)
4. **`automation_schedules` row:** `last_run_at` updated; `next_run_at` advanced by `interval_minutes`; `last_run_status` is `'success'` (when no failures) or `'error'` (when any dispatch failed); `last_run_result` is the full JSON returned by the runner

Query in Supabase Studio:

```sql
SELECT vapi_call_id, count(*), sum(case when status='success' then 1 else 0 end) as ok
  FROM public.action_logs
 WHERE tool_name = 'ghl_reengagement_sms'
 GROUP BY vapi_call_id
 ORDER BY 1 DESC
 LIMIT 10;
```

Schedule status:

```sql
SELECT automation_key, is_active, next_run_at, interval_minutes,
       last_run_at, last_run_status, last_run_result
  FROM public.automation_schedules
 WHERE automation_key = 'ghl_reengagement_sms';
```

***

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Workflow shows HTTP 401 | Bearer mismatch between GitHub secret and Vercel env | Reset both to the same `openssl rand -hex 32` value |
| HTTP 500, body `missing required env var: X` | Env var `X` not set in Vercel production scope | Add via Vercel dashboard, redeploy |
| HTTP 500, body `automation_schedules row missing for ghl_reengagement_sms` | Migration 033 not applied OR seed row deleted | Re-run `npx supabase db push` or re-INSERT the seed row from migration 033 |
| HTTP 500, body mentions provider mismatch / inactive integration | `GHL_REENGAGEMENT_INTEGRATION_ID` points at a row that is not `provider='gohighlevel'` or has `is_active=false` | Look up the correct `integrations.id` in Supabase; verify `provider` and `is_active` |
| Response `{ skipped: 'inactive' }` every pulse | `automation_schedules.is_active=false` | Run the "Resume" SQL above |
| Response `{ skipped: 'not_due_yet' }` every pulse | `next_run_at` is in the future (normal between scheduled runs) | Use `?force=1` for an immediate manual run |
| Many `action_logs` rows with status='error' citing "no phone" / "messaging not enabled" | The GHL contact has no SMS-capable phone on file | Clean up the contact in GHL or remove from the Lost stage |
| Sent 0 / Processed 0 every run | All Lost opportunities younger than threshold OR GHL date-filter param name is wrong | Lower `GHL_REENGAGEMENT_THRESHOLD_DAYS`; if still 0, change `GHL_DATE_FILTER_PARAM` in `src/lib/ghl/list-opportunities.ts` (see 32-RESEARCH.md Pitfall 1) |
| Vercel function timeout | `GHL_REENGAGEMENT_BATCH_LIMIT` too high for current plan | Lower to 20 (Hobby) or 50 (Pro default) |

***

## Out of Scope for v1.9

These behaviors are intentionally NOT implemented:

- Dashboard UI for the schedule (use SQL above)
- Multi-tenant rules (Skleanings-only)
- Email / WhatsApp channels (GHL SMS only)
- Retry with backoff (failure rolls back the claim; the next due run re-attempts)
- STOP / opt-out auto-handling (manual GHL cleanup)
- Advanced template substitution (only `{{first_name}}`)
- Cron-expression scheduling in the DB (we use `interval_minutes` for simplicity)

Future Automations Platform milestone will address these.

***

## File References

- Runner library: `src/lib/automations/ghl-reengagement/runner.ts`
- GHL SMS executor: `src/lib/ghl/send-sms.ts`
- Opportunities list: `src/lib/ghl/list-opportunities.ts`
- Template helper: `src/lib/automations/ghl-reengagement/render-template.ts`
- Route handler: `src/app/api/automations/ghl-reengagement/run/route.ts`
- Migration (anti-loop): `supabase/migrations/032_ghl_reengagement_sent.sql`
- Migration (schedule): `supabase/migrations/033_automation_schedules.sql`
- Workflow: `.github/workflows/ghl-reengagement.yml`
- Phase planning: `.planning/phases/32-ghl-lost-lead-reengagement-sms-automation/`
