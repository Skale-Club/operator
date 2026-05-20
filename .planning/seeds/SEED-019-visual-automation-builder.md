---
id: SEED-019
status: shipped
shipped: 2026-05-20
phases_shipped: [A, B, C, D]
planted: 2026-05-19
planted_during: post-v2.8 Scheduling Hardening
research: .planning/research/SEED-019-visual-flow-builder-research.md
trigger_when: explicit user request OR milestone planning with theme "automations 2.0", "no-code", "workflow builder", "flow editor", "AI agents that build automations"; OR first paying client asks for branching/conditional logic; OR competitor analysis shows ManyChat/n8n parity expected
scope: Large
priority: high
depends_on: [SEED-002 (multi-bot platform — agent runtime exists)]
---

# SEED-019: Visual Automation Builder — AI-Native, Drag-and-Drop, Multi-Channel

Build a **node-based visual workflow editor** on top of the existing Action Engine. Flows can be triggered by any runtime (Vapi voice, chat widget, multi-channel agents, inbound webhooks, schedules, manual), execute multi-step sequences with variable passing, conditional branching, and time-based waits, and call any existing integration.

The defining principle: **AI is the primary builder.** Drag-and-drop is the fallback for power users who want to fine-tune. Most users will say *"create a flow that adds new contacts to a Google Sheet and sends them a welcome WhatsApp"* and the AI builds the canvas. AI can also **read existing flows, explain them, edit them, and execute them on demand.**

Visually inspired by ManyChat / n8n / Zapier. Conceptually different: the LLM is a first-class collaborator, not a chat sidebar bolted onto a canvas.

---

## Why This Matters

### 1. The current `/automations` page is single-shot, stateless
Today's `tool_configs` map one LLM-callable name → one backend action. That's enough for *"the AI assistant on a call needs to create a contact in GHL"*, but it cannot express:
- *"When SMS arrives from a phone matching a Lost lead, create a task AND send a WhatsApp follow-up AND wait 24h AND if no reply, escalate to a human."*
- *"Every Monday at 9am, query GHL for opportunities won last week, render a CSV, email to the operator."*
- *"When a booking is created via /scheduling, check if the contact has a custom field plan=premium, if yes book a 60min slot, if no book 30min."*

Competitors (ManyChat, n8n, Make, Zapier) sell flows specifically because business logic is **multi-step, conditional, and time-aware**. Xphere is at parity on integrations but a step behind on orchestration.

### 2. AI-native is the differentiator
n8n / Zapier require business users to drag nodes and wire them manually — which is why those tools are mostly used by developers. ManyChat is easier but locked to one channel.

Xphere already has the agent runtime, the integration library, and the multi-channel inbox. Adding **"tell the AI what you want and it builds the flow"** is the wedge: a non-technical operator can describe an automation in Portuguese, see it materialize on the canvas, tweak visually if needed, and ship. The research found **no turnkey OSS package** delivers this well today — Sim Studio comes closest but its AI Copilot calls back to a hosted endpoint. Building the AI-builder layer ourselves is the differentiation.

### 3. The Action Engine is the substrate — flows are a layer on top
We don't throw away `tool_configs`. A flow is a graph of nodes; each "action node" calls the existing `executeAction()` dispatcher. The engine, integrations, credential storage, and `action_logs` — all reused. We add: flow schema, execution state machine, visual editor, trigger expansion, AI generator.

Code-surface impact is **bounded** — most new code is the canvas, the state machine, and the AI prompting layer. Provider executors don't change.

### 4. The 80/20 of flows is linear
Looking at real ManyChat/n8n templates, ~80% of flows are: trigger → 3-5 actions in sequence → end. Branching, loops, and delays are the 20% that matter for advanced cases. **Ship linear flows first**, where AI generation works cleanly, then add the harder primitives over follow-up milestones.

### 5. Long-term, flows become the agent's playbook
Once flows exist, an AI agent on a chat can call `executeFlow('lead_qualification', { contact_id })` instead of being told to manually invoke 5 different tools. The flow IS the playbook. The agent becomes a thin natural-language wrapper around well-tested flow definitions.

---

## When to Surface

**Primary triggers:**
- Explicit user request for a workflow builder, visual editor, "automation 2.0", or n8n-style flows
- Milestone planning with theme "no-code", "AI agents that build automations", "workflow editor"
- First paying client asks for branching/conditional logic that `tool_configs` can't express
- Multi-step automation request that today requires custom code

**Secondary triggers:**
- Competitor analysis (sales team loses a deal because ManyChat has visual flows)
- Operator pain point: *"I have to ask Claude to chain 3 actions every time, I want this to be reusable"*
- Need for scheduled automations beyond GHL reengagement (currently single-purpose cron)

**Negative triggers (don't surface):**
- Milestone focused on a single new channel or integration — flows reuse what's there, no urgency
- When the customer base hasn't yet validated `tool_configs` as a need — premature investment

---

## Recommended Stack (from research)

Full research with sources and license analysis: [`.planning/research/SEED-019-visual-flow-builder-research.md`](../research/SEED-019-visual-flow-builder-research.md)

| Layer | Pick | License | Rationale |
|-------|------|---------|-----------|
| **Canvas** | `@xyflow/react` v12 (React Flow) | MIT | De-facto standard; powers Dify, Flowise, Langflow, Sim Studio, Attio, Retool, OneSignal workflows. SSR-safe in v12, virtualizes 100s of nodes, custom nodes are just React components |
| **Engine** | **Homegrown** thin step-runner on Supabase | — | Inngest server is SSPL (legally risky to embed in SaaS), Trigger.dev v3 needs CRIU + separate orchestrator, n8n's Sustainable Use License **explicitly forbids** embedding in SaaS. Our action-engine already does dispatch + tenant routing; flows are just stateful sequences of action-engine calls |
| **Queue / durability** | `pgmq` + `pg_cron` + `workflow_runs` table | PostgreSQL | First-party in Supabase, survives Vercel cold starts, no extra infra |
| **Long-running steps** | Three-tier execution model | — | Vercel Fluid Compute (sync ≤800s on Pro) → Supabase Edge Functions (≤150s async via pgmq) → DB row with `resume_at` / `wait_for_event` (durable minutes–months) |
| **Triggers** | Declarative `workflow_triggers` table; existing action-engine fires matching workflows on inbound events | — | Reuses already-built dispatch from Vapi/Meta/ManyChat/GHL/Twilio/Evolution routes |
| **AI builder** | Anthropic Claude Sonnet 4.5 + Structured Outputs (`strict: true`) + Vercel AI SDK 5 streaming + 7 graph-mutation tools | — | Strict JSON Schema compiles into a grammar — output guaranteed valid. AI SDK 5's generative-UI patterns make canvas-mutation streaming straightforward |
| **Schema** | Zod (canonical) + zod-to-json-schema for LLM tool defs | MIT | Single source of truth: validates DB writes, types React canvas state, becomes the LLM's tool-call schema |
| **Variable interpolation** | Simple `{{ path }}` regex for parameter strings + JSONata for data transforms | MIT | AWS Step Functions adopted JSONata in late 2024 — battle-tested for workflow engines. Custom regex covers 90% of "set this field to that field" cases |
| **Agent loops inside nodes** | LangGraph.js (only inside an "Agent" node type) | MIT | Don't make it the platform; do use it for ReAct-style loops where they're needed |

---

## Locked Decisions

| Decision | Value | Reasoning |
|----------|-------|-----------|
| Visual library | `@xyflow/react` v12 | See stack table |
| Execution engine | Build homegrown, ~1.5k LOC, cap at 2k | All viable OSS engines have license blockers, separate-host requirements, or architectural impedance against our action-engine |
| Storage | JSONB definition on `workflow_versions` (immutable snapshots) + a `workflows` header row | Versioning, optimistic locking, fast snapshot reads — no graph DB |
| Execution semantics | **Linear-first.** Branching/loops/parallel in v2 | Ship the 80% case first; AI generates linear flows reliably |
| Trigger model | Coexist with existing webhook receivers — they call `triggerRouter.fire(event, payload)` alongside legacy logic | Don't break Vapi/Meta/ManyChat routes |
| AI builder transport | LLM never returns raw JSON. Strict tool-call schema via Vercel AI SDK 5; each tool mutates a Zustand store; React Flow renders from that store | Bidirectional editing works naturally — user drags a node, AI sees the new snapshot next turn |
| AI executor | New `action_type = execute_flow` in the existing enum | Flows become callable from any runtime exactly like every other action — clean reuse |
| Backwards compat | `tool_configs` survive untouched; **"Upgrade to flow"** button creates a 1-node flow as starting point | Don't force a migration; operator chooses when to graduate |
| Variable interpolation syntax | Mustache-style `{{ node_id.output.field }}` for params; JSONata expressions for transformation nodes | Familiar UX for params; powerful when needed |
| Error handling | Per-node policy: halt-flow / skip-node / fallback-edge (default halt) | Three explicit options on each node, configurable |
| Observability | `workflow_runs` + `workflow_run_steps` tables; reuse `action_logs` for the underlying action calls | Per-run state + per-node timing; query joins reconstruct full execution |
| Secret handling | LLM sees credential **references** (`{ credentialRef: 'ghl_main' }`), never raw values | Encryption layer in `src/lib/crypto.ts` stays the source of truth |
| Long-running flows | `step.sleep('24h')` = `UPDATE workflow_runs SET resume_at = now() + '24h'` polled by pg_cron every minute; `step.waitForEvent` = row in `workflow_waits` satisfied by the trigger router | Officially documented Supabase pattern — no extra infra |

---

## Scope Estimate

**Large.** Research tightened the v1 milestone to **4 phases / ~5.5 weeks**, down from the 8-phase first draft. The total feature surface to reach Zapier-equivalent UX will likely span 3 milestones:

- **Milestone A — v3.0 (this seed):** linear flows, AI builder, AI executor, manual + webhook + cron triggers, `step.sleep` + `step.waitForEvent`
- **Milestone B — v3.1:** branching nodes, scheduled triggers UI, retry policies, debug/step-through, version history beyond undo
- **Milestone C — v3.2:** loops, sub-flows, parallel branches, marketplace templates, custom code nodes (Deno isolates)

### Milestone A — Phase decomposition (proposed)

**Phase A — Canvas Foundation (1 week)**
- Install `@xyflow/react@^12`; build node-type registry (`trigger`, `action`, `condition`, `wait`, `agent`, `loop`)
- Zod schema for `Workflow`; tables `workflows`, `workflow_versions` with RLS
- Zustand store + autosave on debounce + simple undo/redo stack
- Manual node-by-node builder works end-to-end (save, reload, edit) — **no execution yet**

**Phase B — Engine + Trigger Router (2 weeks)**
- Tables: `workflow_runs`, `workflow_run_steps`, `workflow_waits`, `workflow_triggers` (+ RLS, indexes)
- `pgmq` queue + `pg_cron` tick (every minute)
- Supabase Edge Function worker that picks pending runs and dispatches steps via the existing action-engine
- Primitives: `step.run` (idempotent, memoized by step_id) / `step.sleep(duration)` / `step.waitForEvent(filter, timeout)`
- Action-engine hook: on inbound event, also activate matching triggers + satisfy matching waits
- Synchronous "test run" path via Vercel Fluid Compute (no queue round-trip)

**Phase C — AI Builder (1.5 weeks)**
- Define the 7-tool toolkit: `listNodes`, `addNode`, `connectNodes`, `updateNodeConfig`, `removeNode`, `explainFlow`, `validateFlow`
- Wire Vercel AI SDK 5 streaming with Claude Sonnet 4.5 + Structured Outputs (`strict: true`)
- Chat sidebar component streams tool calls into Zustand reducers → optimistic canvas updates
- System prompt + few-shot library of ~10 archetypal flows from existing Xphere customer use cases
- `runFlowNow(flowId, inputVars)` server action for manual triggering from the canvas

**Phase D — Polish + Observability (1 week)**
- Run history view (`/automations/flows/[id]/runs`) — per workflow, per run, per step
- `/automations/flows/runs/[id]` — visual replay of execution with per-node status, input/output, timing, errors
- Manual retry from a failed step
- JSONata expression node + the `{{ path }}` regex helper for params
- New `execute_flow` action_type wired into action-engine; agents can call flows from chat
- Documentation: piece authoring guide + AI builder prompt-engineering guide

**Total: ~5.5 weeks** with buffer.

### Database schema (Phase A + B)

```sql
-- Header
workflows(
  id uuid pk, org_id uuid, name text, slug text unique-per-org,
  description text, is_active boolean,
  created_by uuid, created_at, updated_at
)

-- Immutable versioned snapshots
workflow_versions(
  id uuid pk, workflow_id uuid fk, version_number int,
  definition jsonb,  -- { nodes, edges, variables, metadata }
  created_at, created_by
)

-- Declarative triggers
workflow_triggers(
  id uuid pk, org_id uuid, workflow_id uuid fk,
  event_type text,           -- 'vapi.call.ended' | 'manychat.inbound' | 'cron' | 'webhook.custom' | 'manual'
  filter jsonb,              -- JSON-path / JSONata predicate over event payload
  schedule_cron text,        -- only when event_type='cron'
  enabled boolean default true
)

-- One row per execution
workflow_runs(
  id uuid pk, org_id uuid, workflow_id uuid, workflow_version_id uuid,
  trigger_type text, trigger_payload jsonb,
  status text,              -- queued | running | sleeping | waiting | succeeded | failed | cancelled
  resume_at timestamptz,    -- for step.sleep
  state jsonb,              -- accumulated step outputs (memoized)
  started_at, ended_at, error text
)

-- Per-step trace (joins with action_logs for the underlying action call)
workflow_run_steps(
  id uuid pk, run_id uuid fk, step_id text, node_id text,
  status text, input jsonb, output jsonb, error text,
  started_at, ended_at
)

-- Pending waits — satisfied by the trigger router
workflow_waits(
  id uuid pk, run_id uuid fk, event_filter jsonb,
  timeout_at timestamptz, created_at
)
```

### Components to build

**Backend (Phases A + B):**
- `src/lib/flows/engine.ts` — `runFlow(version, triggerPayload, context)`: walks nodes, calls executors, persists state
- `src/lib/flows/step.ts` — `step.run(id, fn)` / `step.sleep(duration)` / `step.waitForEvent(filter, timeout)`
- `src/lib/flows/interpolate.ts` — `{{ node_5.output.email }}` → resolved value from runtime state
- `src/lib/flows/jsonata.ts` — sandboxed JSONata wrapper with 1s timeout + memory cap
- `src/lib/flows/schema.ts` — Zod schema for flow definition; emit JSON Schema for LLM tool defs
- `src/lib/flows/trigger-router.ts` — given an event, find flows whose triggers match and enqueue runs
- `supabase/functions/flow-worker/index.ts` — Edge Function: poll pgmq, advance runs, handle timeouts

**Visual editor (Phases A + C):**
- `src/app/(dashboard)/automations/flows/page.tsx` — list flows
- `src/app/(dashboard)/automations/flows/[id]/page.tsx` — canvas editor (drag-and-drop)
- `src/app/(dashboard)/automations/flows/build/page.tsx` — split: chat on left, canvas on right (AI builder mode)
- `src/app/(dashboard)/automations/flows/runs/[id]/page.tsx` — visual replay of execution
- `src/components/flows/canvas.tsx` — React Flow root
- `src/components/flows/nodes/{trigger,action,condition,wait,agent,end}-node.tsx` — node types
- `src/components/flows/palette.tsx` — left sidebar with grouped integration nodes
- `src/components/flows/node-config-panel.tsx` — right sidebar form per node
- `src/components/flows/variable-picker.tsx` — dropdown showing valid `{{ node_id.output.* }}` references at the current point
- `src/components/flows/ai-builder-chat.tsx` — streaming AI chat that mutates the canvas via tool calls
- `src/stores/flow-store.ts` — Zustand store: single source of truth for canvas state + undo stack

**Coexistence:**
- Keep `/automations` (tool_configs) page intact
- Add `/automations/flows` as the new entry point
- "Upgrade to flow" button on each tool_config creates a 1-node flow as starting point

### Out of scope (deferred to Milestones B and C)

- **Branching / conditional nodes** — if/else logic, switch on variable values (Milestone B)
- **Loop nodes** — for-each over arrays, with iteration limit guards (Milestone C)
- **Scheduled triggers UI** — cron-style execution UI ("every Monday 9am") — engine supports it, UI in B
- **Sub-flows** — call one flow from another, nested execution (Milestone C)
- **Parallel branches** — fork execution into multiple paths, await all (Milestone C)
- **Flow marketplace / templates** — shareable templates (Milestone C)
- **Real-time collaboration** — multiple operators editing the same canvas (out of scope indefinitely)
- **Version diff visualization** — show what changed between versions (Milestone B)
- **Time-travel debugging** — replay execution from any step (Milestone B)
- **Custom code nodes** — arbitrary JS execution via Deno isolates (Milestone C)
- **External webhook trigger URLs** — `https://xphere.skale.club/flows/[id]/trigger` (Milestone B)

---

## AI Builder — Implementation Pattern (from research)

This is the part nobody has shipped well as OSS. The pattern (verified against vendor docs):

1. **Strict tool schema, not free-form JSON.** LLM has 7 tools (`addNode`, `connectNodes`, `setNodeConfig`, `removeNode`, `listNodes`, `explainFlow`, `validateFlow`). Each tool call mutates Zustand state and triggers re-render. The LLM never writes raw flow JSON.

2. **Bounded action types.** LLM only sees the existing `action_type` enum + node primitives (`trigger`, `action`, `condition`, `wait`, `agent`, `end`). Cannot invent new node types — typecheck on every tool call via Zod.

3. **Variable awareness.** LLM has a `getAvailableVariables(atNodeId)` tool that returns valid `{{ node_id.output.* }}` references at that point. Prevents hallucinated variable paths.

4. **Round-trip editing.** User drags a node, asks AI *"do the rest"*, AI calls `listNodes()` and sees current state, continues from there. No "AI builds in one shot or never" — continuous collaboration.

5. **Streaming UI.** Vercel AI SDK 5's `streamUI` + typed tool parts (`tool-${toolName}`) dispatch into the canvas store as tool calls arrive. User sees the AI working in real time.

6. **Explain mode.** AI renders any flow in natural language: *"When an SMS arrives from a phone number matching a contact tagged 'lead', create a task for the owner and send a Slack notification."*

7. **Run mode.** From the chat: *"Run my lead qualification flow for contact ID 123."* AI invokes `execute_flow` with the right params. Confirms the result and links to the run page.

8. **Debug mode.** AI reads recent `workflow_runs` for a flow, identifies which step failed, suggests a fix, offers to apply it via `setNodeConfig` with the fix.

9. **System prompt enforces simplicity.** *"Most flows are linear, don't add branching unless explicitly asked."* *"Ship a 3-node flow first, iterate."* Explain tradeoffs in plain language.

10. **Validate before terminate.** AI's loop is capped at ~10 tool calls per turn via `stepCountIs(10)`. Last step always calls `validateFlow()` and surfaces issues.

---

## Open Questions (resolve in /gsd:discuss-phase)

1. **Should flows replace `tool_configs` eventually, or coexist forever?** Migration story has UX implications.
2. **Trigger granularity:** is `event_type = 'message.received'` enough, or `event_type = 'message.received' AND channel = 'whatsapp' AND keyword LIKE 'hello'`? (Tend toward the richer filter via JSONata in the trigger row.)
3. **AI model:** Claude Sonnet 4.5 (recommended) vs OpenAI GPT-4.1 vs both? Tool-calling quality matters more than reasoning here.
4. **Canvas perf:** 50+ node flows — performance disciplines (`React.memo`, memoized arrays), do we need a mini-map and search?
5. **Versioning UX:** semantic versions auto? Operator-named drafts? Force a new version on every save?
6. **Per-node retry policy:** default retry 3x with exponential backoff, or no retry? Configurable per node?
7. **Concurrent runs of the same flow:** how many max? Per-tenant rate limit to protect the worker pool?
8. **Run history retention:** keep 30 days of `workflow_runs` and `workflow_run_steps`? More? Configurable per org?
9. **Variable types:** string-only at first? Or typed (string/number/boolean/array/object) with validation?
10. **Trigger backfill:** when operator activates a new trigger, do we backfill matching past events? (e.g., *"send WhatsApp to all contacts created in the last 24h"*)
11. **Permission model:** can any org member edit flows, or only admins? Read-only viewer role?
12. **Public webhook endpoints for flows:** `https://xphere.skale.club/api/flows/[id]/trigger` callable from external? With HMAC signing? (Probably Milestone B.)
13. **Empirical test:** is `pg_cron`'s 1-minute granularity acceptable for "test run feels instant" UX, given that sync test runs bypass the queue?

---

## Codebase Hints (for the researcher when promoted)

- **Action engine:** `src/lib/action-engine/execute-action.ts` is the dispatcher — flows call it. Don't bypass.
- **Existing executors:** all under `src/lib/action-engine/executors/` plus provider libs (`src/lib/ghl/`, `src/lib/twilio/`, `src/lib/manychat/`, `src/lib/google-contacts/`, `src/lib/custom-webhook/`, `src/lib/knowledge/`). Every `action_type` already has a working executor.
- **Action types:** `Database['public']['Enums']['action_type']` — current ~31 values. Add `execute_flow` (callable from any runtime) and possibly `flow_trigger` (for AI agents that can fire flows).
- **Multi-tenancy:** all new tables follow the RLS pattern with `(SELECT public.get_current_org_id())`. Service role bypasses.
- **Agent runtime:** `src/lib/agent-runtime/run-agent.ts` — chat agents already have tool-calling. Adding `execute_flow` as a callable tool is a small change.
- **Migration cadence:** numbered SQL files in `supabase/migrations/`, applied via `npx supabase db push`. Last applied: 073.
- **Webhook receivers:** `src/app/api/{vapi,meta,manychat,evolution,ghl,twilio,chat}/**` — integration points for the new trigger registry.
- **React Flow:** install `@xyflow/react@^12`. Built-in pan/zoom/mini-map. Custom node types via `nodeTypes={{ trigger: TriggerNode, action: ActionNode, end: EndNode }}`. SSR-safe in v12.
- **dnd-kit already installed:** used in pipeline kanban and custom fields settings. Useful for palette → canvas drag.
- **Anthropic SDK:** used in `src/lib/chat/stream/anthropic.ts` — strong tool-calling support. Use the same client for the AI builder.
- **Vercel AI SDK:** add `ai@^5` for streaming UI patterns (current chat streaming uses raw provider SDKs — fine, but the AI builder benefits from AI SDK's typed tool parts).
- **Supabase pgmq:** [supabase.com/docs/guides/queues](https://supabase.com/docs/guides/queues) — first-party, no extra setup.
- **Supabase pg_cron:** already used elsewhere in the project (`supabase/migrations/` mentions pg_cron jobs).
- **Existing scheduled cron pattern:** `src/lib/automations/ghl-reengagement/runner.ts` shows how to run a scheduled job today. Flows generalize this.
- **Custom Fields validation pattern:** `src/lib/custom-fields/validate.ts` — pure-function model is a good reference for the flow definition validator.
- **Sim Studio source to study:** [github.com/simstudioai/sim](https://github.com/simstudioai/sim) `apps/sim/components/workflow` and `apps/sim/lib/copilot` (Apache-2.0, attribute if borrowed).
- **Activepieces source to study:** [github.com/activepieces/activepieces](https://github.com/activepieces/activepieces) "piece" plugin schema (MIT).

---

## Key Risks (from research)

1. **AI Builder quality on edge cases.** Pattern is well-understood; demos look great; edge cases fail. **Mitigation:** ship `explainFlow` and `validateFlow` tools from day one so the AI can self-correct; ship undo stack so users recover from bad mutations.
2. **`pgmq` + `pg_cron` scaling for `waitForEvent` semantics.** Supabase supports this but we'll be implementing per-tenant scheduling on top. Risk that 1-minute cron granularity feels sluggish. **Mitigation:** synchronous test runs go through Vercel Fluid Compute directly, never through the queue.
3. **"Rebuilding Inngest poorly" scope creep.** Step semantics, retries, idempotency, observability — easy to underestimate. **Mitigation:** ship minimum primitives only (`step.run`, `step.sleep`, `step.waitForEvent`); refuse `step.parallel` / `step.race` / fan-out until users explicitly ask. **Cap engine at ~2k LOC.**
4. **License hygiene.** Sim Studio is Apache-2.0 — study freely, attribute if code is copied. n8n is off-limits for embedding regardless. Activepieces is MIT — safe.
5. **Multi-tenant secret handling.** Flow JSON references credentials. Must stay encrypted via `src/lib/crypto.ts`; never serialize secrets into the AI-visible flow snapshot. **Mitigation:** LLM sees `{ credentialRef: 'ghl_main' }`, never raw values.
6. **React Flow re-render perf.** Solved problem with `React.memo` on custom nodes and memoized node arrays — discipline issue, not architectural blocker.

---

## References

- **Research file:** [`.planning/research/SEED-019-visual-flow-builder-research.md`](../research/SEED-019-visual-flow-builder-research.md) — full source list with citations
- React Flow (xyflow): https://reactflow.dev/
- Sim Studio (architectural reference): https://github.com/simstudioai/sim
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Vercel AI SDK 5: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- Supabase pgmq + pg_cron + Edge Functions: https://supabase.com/blog/processing-large-jobs-with-edge-functions
- Vercel Fluid Compute (long-running routes): https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes
- JSONata in AWS Step Functions: https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html

---

**Status:** Dormant until trigger surfaces.

When promoted, this seed becomes the basis for the **v3.0 Visual Automation Builder (Milestone A)** roadmap. The discussion phase resolves the 13 open questions; the planning phase decomposes Phases A–D into individual plans. Expect **~5.5 weeks of focused work** — the biggest single feature in Xphere's roadmap.
