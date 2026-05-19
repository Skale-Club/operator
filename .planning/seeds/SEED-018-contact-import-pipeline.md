---
id: SEED-018
status: shipped
shipped_in: v2.4
planted: 2026-05-18
planted_during: post-v2.1, before CRM Expansion milestone
trigger_when: alongside SEED-017 (Custom Fields) — import flow must speak the same custom-field model. Can run before SEED-016 if accounts are out of scope, but easier together.
scope: Large
depends_on: SEED-017 (Custom Fields) preferred; SEED-016 (Accounts) optional
---

# SEED-018: Contact Import Pipeline — Production-Grade Bulk Upload

Replace the current single-threaded synchronous CSV import ([`src/components/contacts/import-csv-dialog.tsx`](src/components/contacts/import-csv-dialog.tsx) + [`src/lib/contacts/csv.ts`](src/lib/contacts/csv.ts)) with a structured, queued, observable import pipeline that scales to large lists, recovers from errors, integrates with custom fields and accounts, and exposes real progress to the user.

**Current state (to be replaced):**
- 5 MB hard limit, fully in-memory on the server action
- Naive heuristic mapping covering only 6 base fields (name, phone, email, company, notes, tags)
- One synchronous server action does parse + dedup + insert + return summary
- Progress bar is a fake `animate-pulse` div at `w-1/3`
- No queue: simultaneous imports compete for connection slots; no rate limiting
- No dry-run preview of dedup outcomes or invalid rows
- No persistence: refresh the page mid-import and you lose all state
- No retry on partial failure; entire job either succeeds or fails

**Target state:** durable jobs in the database, large files in Supabase Storage, chunked background processing, real-time progress over Supabase Realtime, dedup preview before commit, custom-field-aware mapping, per-org concurrency cap, and a full job history page.

## Schema

```sql
CREATE TYPE contact_import_status AS ENUM (
  'uploading',     -- file is being uploaded to Storage
  'parsing',       -- worker is reading rows + validating
  'previewing',    -- waiting for user to confirm mapping + dedup strategy
  'queued',        -- accepted, waiting for a worker slot
  'processing',    -- rows being inserted
  'completed',     -- all rows processed
  'partial',       -- finished with errors
  'failed',        -- aborted (system error / cancelled)
  'cancelled'      -- user cancelled
);

CREATE TYPE contact_import_dedup_strategy AS ENUM (
  'skip_existing',     -- existing match -> ignore row
  'update_existing',   -- existing match -> merge fields (non-empty wins)
  'create_duplicate'   -- always insert (rare; opt-in)
);

contact_imports (
  id uuid PK,
  org_id uuid FK -> organizations (RLS),

  -- File
  storage_path text NOT NULL,        -- bucket key in supabase storage
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text,

  -- State machine
  status contact_import_status NOT NULL DEFAULT 'uploading',
  status_message text,               -- last human-readable detail
  error_summary text,                -- on failure

  -- Config
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "CSV Header": "contact.email" | "custom.linkedin_url" | null }
  dedup_strategy contact_import_dedup_strategy NOT NULL DEFAULT 'skip_existing',
  dedup_keys text[] DEFAULT ARRAY['phone','email'],  -- ordered match priority
  default_tags text[],                          -- applied to every imported contact
  default_source text DEFAULT 'csv_import',
  default_assigned_to uuid FK -> auth.users,

  -- Counters (updated by worker)
  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  inserted_rows int DEFAULT 0,
  updated_rows int DEFAULT 0,
  skipped_rows int DEFAULT 0,
  error_rows int DEFAULT 0,

  -- Progress for the UI
  progress_percent int GENERATED ALWAYS AS (
    CASE WHEN total_rows > 0
      THEN LEAST(100, (processed_rows * 100 / total_rows))
      ELSE 0
    END
  ) STORED,

  -- Timestamps
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid FK -> auth.users,
  created_at, updated_at
);

-- Per-row errors persisted for the user to review and fix
contact_import_errors (
  id uuid PK,
  import_id uuid FK -> contact_imports (ON DELETE CASCADE),
  row_number int NOT NULL,           -- 1-based, matches the CSV row
  raw_row jsonb NOT NULL,            -- echo back the failing row
  field text,                        -- which field failed (nullable for whole-row errors)
  message text NOT NULL,             -- human-readable error
  created_at timestamptz DEFAULT now()
);

-- Indexes
idx_imports_org_status_created (org_id, status, created_at DESC)
idx_import_errors_import_id (import_id, row_number)
```

**Realtime:** publish `contact_imports` updates on the `postgres_changes` channel so the dialog/page can subscribe and show live progress without polling.

## Limits

Defaults are generous but bounded so a single org cannot DoS the worker pool.

| Limit                          | Default | Rationale                                          |
|--------------------------------|---------|----------------------------------------------------|
| Max file size                  | 50 MB   | ~1M short rows, well under Storage object limits   |
| Max rows per file              | 200,000 | sane upper bound; explicit error above this        |
| Max concurrent imports per org | 2       | prevent one tenant from blocking workers           |
| Max concurrent imports global  | 8       | matches worker pool sizing                         |
| Chunk size (insert)            | 500     | balance between roundtrips and statement size      |
| Retry attempts (chunk)         | 3       | transient DB errors                                |
| Default dedup keys             | phone, email | most users dedup on phone first              |

All limits are configurable per-org via `org_settings` (future plan-driven billing).

## Architecture

```
┌────────────────┐    ┌───────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ Browser dialog │───▶│ /api/contacts │───▶│ Object storage   │    │ Background worker   │
│ (upload + map) │    │ /imports POST │    │ (Supabase Storage│◀──▶│ (Edge Function v1;  │
└────────────────┘    └───────────────┘    │  on v1; S3-compat│    │  Node worker post-  │
        ▲                      │           │  swappable)      │    │  Hetzner migration) │
        │                      ▼           └──────────────────┘    └──────┬──────────────┘
        │              ┌───────────────┐                                  │
        │              │ contact_      │    realtime              ┌───────▼────────────┐
        └──────────────│ imports row   │◀───────postgres─────────│ updates rows       │
                       └───────────────┘                          │ + writes errors    │
                                                                  └────────────────────┘
```

**Runtime-portable by design** (Vercel → Hetzner migration on the roadmap):

- **Worker location is an implementation detail.** The contract is *"any process that periodically claims `contact_imports` rows in `queued` state and processes them."* v1 uses a Supabase Edge Function (Deno) on `pg_cron` because it matches the existing [`supabase/functions/process-embeddings/`](supabase/functions/process-embeddings/) pattern and is immune to Vercel function timeouts today. Post-Hetzner, a long-lived Node worker (or BullMQ on the already-installed `redis`) replaces it with **zero schema change** — only the binary that polls changes.
- **Storage behind a thin interface.** Define `ContactImportStorage` with two methods: `getSignedUploadUrl(orgId, filename)` and `streamFile(path): ReadableStream`. v1 implementation uses `supabase-js` Storage client. Post-migration, an S3-compatible implementation (`@aws-sdk/client-s3` is already a dependency) can target MinIO, R2, or self-hosted Supabase Storage with no caller change.
- **Queue is just a status column.** No BullMQ/`pg-boss` dependency in v1 — atomic claim via `SELECT ... FOR UPDATE SKIP LOCKED` on `contact_imports`. Portable everywhere. If post-migration we want richer queue semantics (priorities, scheduled retries, multi-worker coordination), drop in BullMQ on top of the existing redis dep without rewriting callers.

**Rejected (Vercel-only or migration-hostile):** Vercel KV, Vercel Blob, `runtime: 'edge'` for the import endpoints, `next/after()` for the actual row processing (fine for tiny inline tasks, terrible for jobs > 5s — does not survive redeploys, ties work to a request lifecycle).

## What needs to be built

**Schema and types:**
1. Migration: enums, `contact_imports`, `contact_import_errors`, indexes, RLS, generated `progress_percent`
2. Supabase Storage bucket `contact-imports` with per-org RLS path policy (`org_id/<uuid>/<filename>`)
3. Update `src/types/database.ts`

**Upload + parse:**
4. `POST /api/contacts/imports` — creates row in `contact_imports` with `status='uploading'`, returns a signed Storage upload URL
5. Client uploads directly to Storage (avoids Vercel body limits, real progress per byte)
6. `POST /api/contacts/imports/[id]/parse` — moves status to `parsing`; enqueues a worker job (insert into `import_jobs` table or via `pg_notify`)
7. Worker downloads the file via Storage stream, counts rows, samples first 50 rows for preview, suggests mapping, transitions to `previewing`

**Mapping wizard (UI):**
8. Drag-and-drop or `<input type=file>` with progress bar bound to `XMLHttpRequest.upload` events
9. After parse, mapping screen with:
   - Each CSV column on the left, dropdown on the right with grouped options: **Contact fields** (name, phone, email, company, notes, tags), **Custom fields** (loaded from SEED-017 definitions), **Skip**
   - Heuristic suggestions pre-applied (regex over header name, sample-value sniffing for email/phone)
   - Live preview table (first 5 rows) reflecting the current mapping
   - Validation: required mapping for at least one of {phone, email}; warning for unmapped columns
10. Dedup strategy picker (skip / update / always create) + dedup-keys ordering
11. Default tags + assignee + source pickers
12. "Validate" button performs a dry-run on the first 1,000 rows and shows: would-insert, would-update, would-skip, would-error breakdown
13. "Start import" button transitions to `queued`

**Queue + concurrency control:**
14. `import_jobs` queue (or use a `next_runnable_at` field on `contact_imports`) processed by an Edge Function on `pg_cron` every 10s
15. Worker query: pick oldest `queued` job WHERE the org has < `max_concurrent_imports_per_org` jobs in `processing` AND global processing count < `max_concurrent_imports_global`
16. Lock via `UPDATE ... SET status='processing' WHERE id=... AND status='queued' RETURNING ...` (atomic claim)

**Processing:**
17. Stream rows from Storage in chunks of 500
18. For each chunk: validate (core fields + custom fields via SEED-017 validator), run dedup query (`WHERE org_id=? AND (phone IN (...) OR email IN (...))`), bucket rows into insert/update/skip/error
19. Bulk insert/update in a single transaction per chunk
20. Update `processed_rows`, `inserted_rows`, etc. after each chunk (drives realtime progress bar)
21. Persist failing rows into `contact_import_errors` with row number + raw row + field + message
22. On global error (storage 5xx, schema mismatch), set `status='failed'` + `error_summary`
23. On normal finish: status = `completed` if `error_rows == 0` else `partial`

**Progress UI:**
24. Imports page `/dashboard/contacts/imports` listing all import jobs with status pill, progress bar, counts
25. Detail page `/dashboard/contacts/imports/[id]` with live counters, log of state transitions, errors table with row number + field + message + raw values, "Download error rows as CSV" button
26. In-dialog (compact) progress when started from the contacts list: realtime status, dismissible (job continues), reopen via toast or imports page
27. Toast notifications on status changes (queued -> processing -> done/partial/failed)

**Cancellation + retry:**
28. "Cancel" button while `queued` or `processing` — sets a `cancel_requested=true` flag; worker checks every chunk and exits cleanly to `cancelled`
29. "Retry failed rows" — creates a new import job seeded with the error rows from the previous job (same mapping)

**Integration:**
30. Accounts (SEED-016): if a mapped row has a company name and account auto-create is enabled, ensure the account exists (idempotent `INSERT ... ON CONFLICT`) and set `contact.account_id`
31. Custom fields (SEED-017): mapping targets include all `filterable=true OR visible_in_list=true` custom field definitions for the contact entity; validator enforces type per definition
32. Tags + assignee + source defaults applied uniformly

**Safety / abuse guard:**
33. Per-IP rate limit on the upload-create endpoint (10/hour) via the existing rate-limit lib
34. Reject files where `size > 50MB` server-side before signed URL is issued
35. Reject files where the worker counts more than 200,000 rows (transition to `failed`)

**Cleanup:**
36. Cron: delete `contact_imports` older than 30 days + corresponding Storage objects (keeps the page light, no compliance footprint)

**Tests:**
37. RLS: org A cannot see org B's imports or errors
38. Upload flow: signed URL only valid for the creating org
39. Worker concurrency: 3 jobs queued for the same org, only 2 enter `processing`
40. Chunk transactional: failure mid-chunk rolls back chunk, advances to next, marks chunk rows as error
41. Cancellation mid-processing leaves no orphaned rows
42. Retry flow re-imports only the previously failing rows
43. Custom-field validation rejects bad rows with row-level errors (not a global failure)
44. Realtime: subscriber receives every status transition

## Decisions to make before planning

1. **Worker location (v1):** Supabase Edge Function (Deno) vs Next.js Node route with `after()`. Recommendation: **Edge Function** — matches the embeddings worker pattern, immune to Vercel timeouts. Post-Hetzner this swaps to a Node worker process without touching callers (see Architecture).
2. **Cron driver:** `pg_cron` invoking the worker vs `setInterval` in a long-lived process. Recommendation: **pg_cron** in v1 (portable: works on Supabase Cloud and post-Hetzner self-host alike). On Hetzner, a Node worker with its own loop becomes viable but `pg_cron` still works.
3. **Queue mechanism:** separate `import_jobs` table, `pg-boss`, BullMQ, or reuse `contact_imports.status`. Recommendation: **reuse the status field** in v1 (zero new dependencies, atomic `SELECT FOR UPDATE SKIP LOCKED` works fine). Migrate to BullMQ post-Hetzner only if needed (`redis` is already a dep).
4. **CSV parser:** keep the in-house parser or move to `papaparse`? `papaparse` is already a dependency. Files up to 50 MB warrant the streaming parser. Recommendation: **use `papaparse` in worker (Node + Deno builds available)** — streaming, well-tested edge cases, drop the in-house one for new code.
5. **Other formats (XLSX, JSON)?** v1 = CSV only. Stub the parser interface so XLSX can be added later without refactoring callers.
6. **Email lookup pre-import:** sniff free public providers (`@gmail.com`, etc.) to avoid creating an account per personal email when accounts auto-create is on. Recommendation: default block-list shipped in code, editable per org later.
7. **Hard-fail vs soft-fail on missing required mapping:** if `phone` and `email` are both unmapped, recommendation: **block start**, do not let the import begin.
8. **Storage backend:** Supabase Storage in v1 (already in stack). Post-Hetzner, evaluate self-hosted Supabase Storage vs MinIO vs R2 — but the `ContactImportStorage` interface keeps this swap a one-file change.

## Post-migration considerations (Vercel → Hetzner)

When the migration happens, this pipeline should need only configuration changes:

- **Swap worker binary:** replace the Deno Edge Function with a Node worker process managed by PM2/systemd/Docker. Same SQL contract (`SELECT ... FOR UPDATE SKIP LOCKED` on `contact_imports`). Optionally promote to BullMQ if multi-worker coordination grows messy.
- **Swap storage impl** if Supabase Storage is dropped: implement `ContactImportStorage` against S3/MinIO/R2 via the existing `@aws-sdk/client-s3` dep. Migrate existing objects with a one-shot script; the schema's `storage_path` column does not change.
- **Tighten timeouts and chunk sizes:** Hetzner lets larger chunks run safely. Increase `CHUNK_SIZE` from 500 → 2,000 once on Hetzner; the constant lives in one place.
- **Drop the Vercel-specific concurrency cap** if Hetzner gives us more headroom. Per-org cap stays for fairness; global cap can rise from 8 to something derived from worker count.

All of this is configuration / replacement, not redesign — the schema and HTTP contracts are intentionally portable.

## References to existing code

- [`src/lib/contacts/csv.ts`](src/lib/contacts/csv.ts) — in-house parser (will be replaced or scoped to small preview)
- [`src/components/contacts/import-csv-dialog.tsx`](src/components/contacts/import-csv-dialog.tsx) — UI baseline, to be split into upload + mapping + progress + done stages backed by realtime
- [`supabase/functions/process-embeddings/`](supabase/functions/process-embeddings/) — Edge Function pattern (Deno + Storage stream)
- `pg_cron` keepalive job — driver for periodic worker tick
- `conversations` realtime subscription (post-v1.4) — pattern for client-side realtime hook

## Dependencies

- **SEED-017 (Custom Fields)** strongly recommended — so the mapping wizard can target custom fields from day one and the validator enforces types. Without it, mapping is limited to base contact fields and custom_fields keys are blind strings.
- **SEED-016 (Accounts)** optional — if shipped first, account auto-create from `company` happens in-line during import.

## Scope

**Large — 4–5 phases, ~14 plans.**

Suggested phase breakdown:
1. Schema + Storage bucket + realtime channel + types + RLS + cleanup cron
2. Upload + signed URL + parse worker + preview/mapping endpoints
3. Mapping wizard UI (heuristics + custom fields + dry-run validation + dedup picker)
4. Queue + processing worker (chunked, transactional, cancellable, with per-row errors)
5. Imports page + detail + error CSV export + retry-failed + tests
