# Phase 40 Research: Agent Observability Dashboard

**Date:** 2026-05-17
**Phase:** 40 — Agent Observability Dashboard

## ## RESEARCH COMPLETE

---

## 1. Data Source: `agent_invocations` Table

The `agent_invocations` table (Migration 034) has all the columns we need for every OBS requirement:

| Column | Type | Use |
|--------|------|-----|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Org scoping (RLS) |
| `agent_id` | uuid | Per-agent metrics (OBS-04, OBS-07) |
| `parent_invocation_id` | uuid | Delegation tree parent (OBS-06, OBS-07) |
| `trace_id` | uuid | Groups a full delegation chain |
| `conversation_id` | uuid | Links invocations to conversations (OBS-06, OBS-08) |
| `status` | enum | success/error/aborted/skipped/denied/running — filter target (OBS-07) |
| `cost_usd` | numeric | Cost ticker (OBS-05), total cost (OBS-04) |
| `duration_ms` | integer | p50/p95 latency (OBS-04) |
| `tokens_in` / `tokens_out` | integer | Token counts |
| `tool_calls` | jsonb | Tool call log — success rate = not-denied / total (OBS-04) |
| `error_detail` | text | Filter by error (OBS-07) |
| `created_at` | timestamptz | Time-window queries |

The `organizations` table has `daily_cost_cap_usd_override` for OBS-05 cap calculation.

---

## 2. Per-Agent Metrics Widget (OBS-04)

**Route:** `/dashboard/agents/[id]` — already exists at `src/app/(dashboard)/agents/[id]/page.tsx`

**Metrics to compute:**
- **Invocation count**: `COUNT(*) WHERE agent_id = $id AND created_at >= $window_start`
- **p50 / p95 latency**: Percentile of `duration_ms` — PostgreSQL has `percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)` and same for 0.95. BUT this is complex via Supabase JS client. Simpler: fetch `duration_ms` array and compute p50/p95 in JavaScript.
- **Total cost**: `SUM(cost_usd)`
- **Tool-call success rate**: From `tool_calls` JSONB — requires fetching the array and parsing. Simpler to compute in JS: count entries with `denied:false` vs total entries.

**Windows:** 24h / 7d / 30d — implemented as server action query param.

**Pattern reference:** `getDashboardMetrics()` in `src/app/(dashboard)/calls/actions.ts` shows how to do parallel queries and return to a client component.

**UI pattern:** Card widget similar to `DashboardMetrics` in `src/components/calls/dashboard-metrics.tsx`. Use `recharts` BarChart for trend (library already installed).

---

## 3. Per-Org Cost Ticker (OBS-05)

**Route:** `/dashboard` — `src/app/(dashboard)/page.tsx`

**Compute:**
- 1h total: `SUM(cost_usd) WHERE created_at >= NOW() - INTERVAL '1 hour'`
- 24h total: `SUM(cost_usd) WHERE created_at >= NOW() - INTERVAL '24 hours'`
- 7d total: `SUM(cost_usd) WHERE created_at >= NOW() - INTERVAL '7 days'`
- % of cap: `(24h_total / daily_cost_cap_usd) * 100` — cap from `organizations.daily_cost_cap_usd_override` with fallback to `AGENT_DAILY_COST_CAP_USD` env var (default `$50.00`)
- Alert when `%` ≥ 80

**Pattern:** The `guardrails.ts::checkDailyCostCap()` already implements the cap logic — the cost ticker server action can share the same query pattern.

**UI:** New `CostTicker` card component in `src/components/dashboard/` — shows three sub-metrics (1h, 24h, 7d) and a progress bar + alert badge at ≥80%.

---

## 4. Conversation Delegation Tree (OBS-06)

**Route:** `/dashboard/conversations/[id]` — NEW page

**Data shape:** `agent_invocations` rows are a tree via `parent_invocation_id`. Strategy:
1. Fetch all invocations for `conversation_id = $id` in a single query
2. Build a tree in memory (parent → children map)
3. Render as a recursive collapsible tree component

**Root nodes:** invocations where `parent_invocation_id IS NULL` (or whose parent is outside this conversation)

**Node display:** agent name (joined via `agents` table), cost_usd, duration_ms, status badge

**Agent name resolution:** Need to join `agents.name` — use Supabase `.select('*, agents(name, slug)')` join

**UI:** Recursive `DelegationNode` client component with shadcn `Collapsible`. Each node shows: agent badge, status pill, cost + latency.

**Access from Chat Inbox:** The admin inbox at `/chat` shows conversations — add a "View Delegation Tree" link button in the conversation header → `/conversations/[id]`

---

## 5. Invocations List with Filters (OBS-07)

**Route:** `/dashboard/agents/[id]/invocations` — NEW sub-page (sibling to existing `prompt-history`)

**Query:** `agent_invocations WHERE agent_id = $id` with filters:
- Status: `eq('status', value)`
- Min cost: `gte('cost_usd', value)`
- Error: `ilike('error_detail', '%${q}%')` 
- Pagination: `.range(offset, offset + PAGE_SIZE - 1)` (same pattern as `getCalls()`)

**Clicking an invocation:** Opens a drawer/modal showing delegation tree for that specific `trace_id` / invocation subtree

**Agent name context:** Already on agent detail page so agent is known

**UI pattern:** Table similar to calls list. Filter bar with status dropdown + cost input + error search. Clickable rows opening `InvocationDetailDrawer`.

---

## 6. Agent Badge on Chat Messages (OBS-08)

**Route:** Chat inbox → `src/components/chat/chat-area/message-list.tsx`

**Data source:** The `agent_invocations` table has `conversation_id` + `agent_id`. BUT `conversation_messages` has no `agent_id` column.

**Strategy options:**
1. **Join invocations → messages by time**: Too fragile (timing correlation)
2. **Store agent_id in message metadata**: When `runAgentStreaming()` calls `persistMessage()`, pass `invocationId` + `agent_id` in the `metadata` JSONB. Then the message-list reads `message.metadata.agent_id` and shows the badge.
3. **No message-level data**: Just show conversation-level agent from `conversations.agent_id`

**Recommended approach (option 2):**
- `persistMessage()` in `src/lib/chat/persist.ts` already has a `metadata` parameter
- The streaming path calls `persistMessage({ ..., role: 'assistant', content: ... })` in `after()` 
- We need to pass `{ agent_id: resolvedAgentId, invocation_id: invocationId }` as metadata
- Then `conversation_messages.metadata.agent_id` is available to the inbox
- The admin chat API at `/api/chat/conversations/[id]/messages` returns `metadata` already (it's in the `ConversationMessage` type)

**What to display:** Agent name badge — requires resolving `agent_id → agent.name`. Options:
- Fetch agents list once in `AdminChatLayout` and pass down as a map
- Or fetch agents in the server component and pass `agentMap: Record<string, {name, slug}>`

**UI:** Small pill/chip below/beside assistant message bubble showing agent name. Subtle styling — not intrusive.

---

## 7. Architecture Decisions

### Server Actions Pattern
All data fetching uses Next.js Server Actions (`'use server'`) following existing patterns in `calls/actions.ts`. Never call `supabase.auth.getUser()` directly — use `getUser()` from `@/lib/supabase/server`.

### No New Database Migrations Needed
All required data already exists in `agent_invocations`. The only schema change is adding `agent_id` + `invocation_id` to `conversation_messages.metadata` JSONB — this is a soft change (JSONB is schema-free).

### Latency Percentiles in JavaScript
PostgreSQL `percentile_cont` requires raw SQL. Rather than an RPC, fetch `duration_ms` values (bounded by time window) and compute p50/p95 in TypeScript. Max rows per window: if invocations = 10,000/day, 30d = 300,000 — need to cap fetch. Better: fetch with limit 10,000 sorted by `created_at DESC` — sufficient statistical accuracy.

### Cost Ticker Refresh
The dashboard page is a server component — it refreshes on navigation. No real-time updates needed (acceptable for an observability ticker). Could add a manual refresh button using `router.refresh()`.

### Conversations Page — New Route
`/conversations/[id]` is a new page in `src/app/(dashboard)/conversations/[id]/page.tsx`. Add a `Conversations` nav link... actually, no nav link needed since the page is accessed from the chat area. The sidebar stays as-is.

---

## 8. File Map (New Files)

```
src/app/(dashboard)/
  conversations/[id]/page.tsx                    — NEW: delegation tree page (OBS-06)
  agents/[id]/invocations/page.tsx               — NEW: invocations list (OBS-07)

src/components/
  agents/
    agent-metrics-widget.tsx                     — NEW: per-agent metrics card (OBS-04)
    invocation-detail-drawer.tsx                 — NEW: single invocation detail (OBS-07)
  conversations/
    delegation-tree.tsx                          — NEW: recursive tree (OBS-06, OBS-07)
  dashboard/
    cost-ticker.tsx                              — NEW: cost ticker card (OBS-05)

src/lib/
  agent-runtime/observability.ts                 — NEW: shared query helpers for metrics
```

## 9. Modified Files

```
src/app/(dashboard)/agents/[id]/page.tsx         — Add metrics widget below existing form
src/app/(dashboard)/page.tsx                     — Add CostTicker to dashboard
src/components/chat/chat-area/message-list.tsx   — Add agent badge to assistant messages
src/lib/agent-runtime/run-agent.ts               — Pass agent_id to persistMessage metadata
src/lib/chat/persist.ts                         — Accept + write metadata with agent_id
```

---

## 10. Validation Architecture

### Automated Checks
- TypeScript build (`npm run build`) catches type errors in new server actions and components
- RLS: all queries use `createClient()` (auth-scoped) — org isolation guaranteed by Supabase RLS

### Manual UAT (for HUMAN-UAT.md)
- OBS-04: Navigate to agent detail page, verify metrics widget shows 3 window tabs
- OBS-05: Navigate to dashboard, verify cost ticker shows 1h/24h/7d columns
- OBS-06: Trigger an agent conversation with delegation, navigate to conversation page, verify tree
- OBS-07: Navigate to invocations sub-page, apply each filter type, click a row
- OBS-08: Open chat inbox, find an assistant message, verify agent badge appears
