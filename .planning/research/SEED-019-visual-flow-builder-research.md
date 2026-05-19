# SEED-019 Research: Visual Automation Builder Stack

**Researched:** 2026-05-19
**Goal:** Find the optimal stack of existing open-source pieces to compose a visual, AI-native workflow builder for Xphere, minimizing custom code while keeping everything embeddable in a multi-tenant SaaS.
**Mode:** Ecosystem + Comparison
**Overall confidence:** MEDIUM-HIGH (verified on official repos/docs; some product-UX claims are vendor-supplied)

---

## Executive Summary

1. **Canvas:** Use `@xyflow/react` v12 (React Flow). It is the de-facto standard, MIT-licensed, virtualizes for 100s–1000s of nodes, and powers virtually every notable open-source AI-flow builder (Flowise, Langflow, Dify, Sim Studio, OneSignal, Attio, Retool). No alternative is close on community/maturity.
2. **Engine:** Build a thin **homegrown step-runner** on top of **Supabase Postgres (`pgmq` + `pg_cron`) + Supabase Edge Functions**, with Vercel Fluid Compute as the synchronous fast path. Do **not** adopt Inngest or Trigger.dev as the primary engine — Inngest's server is SSPL (problematic to embed), Trigger.dev v3 self-hosting now needs CRIU + a separate Docker stack, and both fight the existing action-engine instead of complementing it. Steal *patterns* (durable steps, `step.sleep`, `step.waitForEvent`) but own the data model.
3. **AI builder:** Anthropic Claude **Structured Outputs** (released 2025, strict JSON Schema enforcement on Sonnet 4.5 / Opus 4.1) is the right primitive. Use **Vercel AI SDK 5** for streaming + tool-calling, with a small set of graph-mutation tools (`addNode`, `connectNodes`, `setNodeConfig`, `removeNode`, `explainFlow`). This is the same pattern Sim Studio's "Copilot" uses.
4. **Reference to study (not copy):** **Sim Studio** (Apache-2.0, Next.js + ReactFlow + Postgres + Drizzle, 28.5k stars, AI Copilot for flow generation) is the closest analog to what Xphere wants to build — it validates the entire architectural bet.
5. **Avoid:** n8n source (Sustainable Use License explicitly blocks embedding in a SaaS), heavy Java/Go orchestrators (Kestra, Temporal, Windmill — wrong runtime), and Tournament/n8n's expression language (custom syntax with no clean lib).

**Biggest unknowns / risks:**
- Whether `pgmq` + `pg_cron` on Supabase scales to per-tenant durability with `waitForEvent` semantics without us reinventing half of Inngest.
- Whether Claude's structured-output tool-call loop is fast enough for "real-time canvas mutation" UX (vs. batch-generate-then-render).
- License hygiene if we lift any UI/UX inspiration from Sim Studio (Apache-2.0 is permissive but attribution is required if we copy code).

---

## Recommended Stack

| Layer | Pick | License | Why |
|-------|------|---------|-----|
| Canvas | `@xyflow/react` v12 | MIT | Standard, virtualized, used by every comparable OSS product. [reactflow.dev](https://reactflow.dev) |
| Engine | Homegrown step-runner on Supabase | — | Owns RLS/tenant isolation; no impedance mismatch with existing action-engine |
| Queue / state | `pgmq` + `pg_cron` + workflow_runs table | PostgreSQL | Already inside Supabase; survives Vercel cold starts |
| Long-running steps | Supabase Edge Functions (150s) for work; Vercel Fluid Compute (≤800s Pro) for synchronous bursts; `step.sleep` modeled as scheduled DB row | — | Avoids per-tenant infra |
| Triggers | Declarative `workflow_triggers` table → existing action-engine router fires matching workflows on inbound events | — | Reuses already-built dispatch |
| AI builder | Anthropic Claude Sonnet 4.5 + Structured Outputs + Vercel AI SDK 5 tool-calling | — | Strict JSON Schema, streaming, generative-UI patterns |
| Schema | Zod (canonical) + zod-to-json-schema → fed to LLM tool defs | MIT | Single source of truth, already in stack |
| Interpolation | JSONata (with built-in 1s timeout + memory cap) for data transforms; simple `{{ path }}` regex for parameter strings | MIT | JSONata is the only mature, sandboxed expression lib; n8n uses JMESPath + JS, which is heavier |
| Reference to study | Sim Studio (Apache-2.0), Activepieces (MIT), LangGraph.js (MIT) | — | Architectural inspiration only |

---

## 1. Visual Canvas Libraries

| Library | Stars (npm trends + repo) | Weekly DLs | License | Last release | Verdict |
|---|---|---|---|---|---|
| **`@xyflow/react`** (React Flow v12) | 34.5k+ | 65k+ | MIT | March 2026 | **WINNER** — server-render w/ width/height, virtualized rendering, controlled viewport, mature custom-node API |
| Rete.js | 11.7k | 7.5k | MIT | active | Powerful, plugin-heavy, steeper learning curve; aimed at dataflow/visual programming, not workflows |
| Drawflow | 5.9k | 5.5k | MIT | maintenance | Vanilla JS, small, dated UX, no virtualization |
| Flume | 1.5k | 274 | MIT | inactive | Cute but not viable for production |
| JointJS+ | — | — | Commercial | — | Per-seat licensing, no-go for an OSS-leaning stack |
| GoJS | — | — | Commercial ($) | — | Same problem |
| Blockly | 12k+ | — | Apache-2.0 | active | Block-based puzzle UX (Scratch-style); wrong metaphor for ops automation |

Sources: [npm trends](https://npmtrends.com/drawflow-vs-flume-vs-gojs-vs-node-red-vs-noflo-runtime-base-vs-react-flow-renderer-vs-rete), [xyflow GitHub](https://github.com/xyflow/xyflow), [React Flow v12 release notes](https://xyflow.com/blog/react-flow-12-release), [Performance docs](https://reactflow.dev/learn/advanced-use/performance).

**Why React Flow wins for Xphere specifically:**
- Already powers Dify, Flowise, Langflow, Sim Studio, Tersa, Waldiez, OneSignal workflows, Attio CRM workflows, Retool — every comparable product in the OSS AI workflow space, per the [official showcase](https://reactflow.dev/showcase).
- v12 added SSR-safe rendering (define node width/height up-front, hydrate on client) — important if we want the canvas to be linkable/shareable via SSR.
- Virtualization means 100+ nodes is fine without code; thousands work with memoized custom nodes.
- The custom-node API is just React components — no separate DSL — so we can drop shadcn primitives directly into nodes (matches our stack).
- MIT, no commercial-use restriction.

**Performance caveats (verified):** Frequent state updates during node drag can cause re-renders unless custom nodes are wrapped in `React.memo` and node arrays are memoized. This is well-documented and a known engineering discipline, not a blocker.

---

## 2. Workflow Execution Engines

### The shortlist

| Engine | License | Self-host story | Vercel-compatible? | Fit for Xphere? |
|---|---|---|---|---|
| **Inngest** | SSPL (server) + Apache-2.0 (SDK) | Go server, Docker | SDK yes; engine needs its own host | **NO as engine** — SSPL on the server makes embedding in a hosted SaaS legally risky; we'd have to run their server alongside Supabase |
| **Trigger.dev v3** | Apache-2.0 | Docker + CRIU + separate worker pool | SDK yes; orchestrator does NOT run on Vercel | **NO as engine** — v3 self-host explicitly requires CRIU-capable hosts, separate from app deploy |
| **LangGraph.js** | MIT | In-process library | Yes | **Maybe** — great for *agent loops* inside a node, wrong shape for the whole platform (it's a graph DSL, not a multi-tenant scheduler) |
| **Mastra** | Apache-2.0 | In-process TS library | Yes | **Maybe** — has suspend/resume + workflows-as-code, but its abstractions assume you're building the agent (not exposing a visual editor on top) |
| **Temporal / Cadence** | MIT | Heavy: own cluster | No | Massive overkill |
| **Windmill** | AGPL/Other | Rust+Svelte monolith | No | Wrong runtime, AGPL is contagious |
| **Kestra** | Apache-2.0 | Java monolith | No | Wrong runtime, YAML-first DX |
| **BullMQ** | MIT | Needs Redis | Edge-compatible only via Upstash | Job queue, not a workflow engine — would need to layer our own state machine on top |
| **n8n core** | Sustainable Use License | OK for internal, **forbidden for SaaS embedding** | — | **HARD NO** — license literally bans this use case |
| **Activepieces engine** | MIT (community) | Self-host w/ separate worker | Needs separate worker pool | Extraction risk: tightly coupled to their app shell |

### Why we recommend "build the engine ourselves"

The engine we need is *small*. Xphere's existing **action-engine already** does the hard part: routing inbound events from many runtimes (Vapi, Meta, ManyChat, GHL, chat widget, multi-channel agents) to provider executors with tenant scoping. A workflow is just **a sequence of actions with state**. To turn the action-engine into a workflow engine we need:

1. A `workflow_runs` table (status, current_step_id, accumulated state JSON, org_id w/ RLS)
2. A `workflow_steps` table or a JSONB column representing the compiled graph
3. A worker loop that picks pending runs and advances them
4. Three primitives: `step.run` (idempotent execution), `step.sleep(duration)`, `step.waitForEvent(filter, timeout)`
5. A trigger system that turns inbound events into "advance this run" messages

That is ~1–2 phases of work. Adopting Inngest/Trigger.dev would force us to run a *second* dispatch layer next to the action-engine, duplicating tenant resolution, retries, and observability — and Inngest's SSPL makes that even worse legally for a hosted SaaS.

**What to steal from Inngest/Trigger.dev:**
- The **`step.*` API shape** is provably the right one (Inngest's [primer](https://www.inngest.com/blog/durable-functions-a-visual-javascript-primer) walks through why).
- **Memoize step output by step ID** so re-execution is safe (durability via DB, not via in-process state).
- **`waitForEvent` as a row in a "waiting" table** that gets satisfied when a matching event arrives.

Sources: [Inngest GitHub](https://github.com/inngest/inngest), [Trigger.dev v3 announcement](https://trigger.dev/blog/v3-announcement), [Mastra docs](https://mastra.ai/docs), [LangGraph.js](https://github.com/langchain-ai/langgraphjs).

### Where LangGraph.js *does* fit

Inside an **AI Agent node** that needs ReAct-style loops (call tool → observe → decide → call tool …), LangGraph.js (`@langchain/langgraph`, MIT, ~42k weekly downloads as of 2026) is the cleanest TS implementation. We can wrap it inside one node type without making it the whole platform. Used at Replit, Uber, LinkedIn, GitLab per their docs.

---

## 3. AI-Native Reference Implementations

| Product | OSS? | AI-builds-flow? | How they do it |
|---|---|---|---|
| **Sim Studio** | Apache-2.0, [github.com/simstudioai/sim](https://github.com/simstudioai/sim) (28.5k★, Next.js + ReactFlow + Postgres) | **Yes** — "Copilot to generate nodes, fix errors, iterate from natural language" | Closest analog. Requires their hosted Copilot API key on self-host (so the AI piece itself is closed) but the canvas is open |
| **Activepieces** | MIT (community) | **Partial** — AI Copilot suggests steps; AI coding assistant for code piece | Less ambitious than Sim; more "AI helps you" than "AI builds for you" |
| **Flowise** | Apache-2.0 | No "build me a flow" mode; you build manually | LangChain-flavored — strong RAG building, weak general workflow |
| **Langflow** | MIT, IBM-backed | No — visual IDE for humans | Python-only backend (does not fit our TS stack) |
| **n8n** | SUL | Yes (AI Assistant) | Cannot be embedded in our SaaS regardless |
| **Zapier** | Closed | Yes (Copilot — best-in-class UX) | Reference for what good looks like, not extractable |
| **MindStudio**, **Voiceflow**, **Gumloop** | Closed | Yes | UX reference |

**Honest verdict on "AI-native open-source flow builder":** It mostly does **not** exist as a turnkey OSS package. Sim Studio is the closest — and even Sim's AI Copilot calls back to their hosted endpoint. The visual canvas + workflow engine pieces are commodities; **the AI-builder layer is where Xphere's differentiation has to come from custom work**.

The good news: the *pattern* is well-understood. Define a small set of structured tools (`addNode`, `connectNodes`, `updateNodeConfig`, `removeNode`, `listNodes`, `explainFlow`), give the LLM the current flow JSON + the user's prompt, and stream tool calls back to the UI to render canvas mutations live. Vercel AI SDK 5's generative-UI patterns (`streamUI`, typed tool parts `tool-${toolName}`) make this straightforward.

Sources: [Sim Studio GitHub](https://github.com/simstudioai/sim), [Activepieces AI Copilot blog](https://www.activepieces.com/blog/ai-workflow-automation-tools), [Vercel AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces).

---

## 4. Schema & Validation

**Recommendation:** Zod as canonical, JSON Schema as the LLM-facing serialization, via `zod-to-json-schema`.

- Zod is already in the stack and used by react-hook-form. Keeping the flow schema in Zod means we get TS types for free.
- Anthropic's new [Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) (Sonnet 4.5, Opus 4.1) and OpenAI's function-calling both accept JSON Schema directly. With `strict: true`, Anthropic *compiles your schema into a grammar* and constrains token sampling — output is guaranteed valid.
- TypeBox was considered (faster runtime, JSON-Schema-native) but adopting it would mean a second validation system in the codebase and migration cost on every form.
- Mature platforms (Zapier, Make, n8n) use JSON Schema variants under the hood, so we're not pioneering — we're aligning with the industry default.

**Concrete shape we should converge on:**
```ts
const WorkflowNode = z.object({
  id: z.string(),
  type: z.enum(['trigger','action','condition','wait','agent','loop']),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.discriminatedUnion('kind', [/* per node type */]),
});
const Workflow = z.object({
  version: z.literal(1),
  nodes: z.array(WorkflowNode),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), sourceHandle: z.string().optional() })),
  triggers: z.array(z.object({ /* declarative trigger spec */ })),
});
```
This Zod schema is the single source of truth: it validates DB writes, types the React canvas state, and (via zod-to-json-schema) becomes the LLM tool-call schema.

---

## 5. Variable Interpolation

| Option | Notes | Verdict |
|---|---|---|
| **JSONata** | Rich transformation language, built-in 1s timeout + memory cap (AWS Step Functions adopted it). [jsonata.org](https://docs.jsonata.org) | **Pick** for data-shape transforms inside nodes |
| Simple `{{ path }}` regex over JSON | 30–50 lines of code, covers 90% of "set this field to that field" cases | **Pick** for parameter-string interpolation |
| JMESPath | Read-only query language; n8n uses it but pairs it with full JS | Skip — too limited alone, too much overlap with JSONata |
| Handlebars / Mustache / Liquid | Designed for HTML, not data transforms | Skip |
| Tournament (n8n's lib) | Custom, not a published standalone lib | Skip — n8n-specific |
| Sandboxed eval of JS (isolated-vm, vm2) | Powerful but security-sensitive; vm2 is deprecated/CVE-ridden | Defer — only if customers need code nodes; even then prefer Deno isolates via Supabase Edge Functions |

The pragmatic split: most variable references look like `{{ trigger.contact.email }}` — a 30-line interpolator handles this. When users need real transforms (filter array, reshape object, format date), expose JSONata as the expression language. AWS chose JSONata for Step Functions in late 2024, which is a strong "battle-tested for workflow engines" signal.

Sources: [JSONata in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html), [n8n expressions docs](https://docs.n8n.io/data/expressions/).

---

## 6. AI Tool-Calling for Graph Mutation

**Recommended pattern (verified against vendor docs):**

1. **Model:** Claude Sonnet 4.5 with Structured Outputs (`strict: true`). Reason: strict JSON Schema enforcement is now first-class (not tool-call emulation), and Anthropic compiles the schema into a grammar that constrains generation. OpenAI's equivalent is `response_format: { type: 'json_schema', strict: true }` — both work, Anthropic is currently sharper for tool-use loops.
2. **Tools exposed to the model** (Zod schemas, auto-serialized via zod-to-json-schema):
   - `listNodes()` → returns current flow snapshot
   - `addNode(type, position, data)` → returns node id
   - `connectNodes(sourceId, targetId, sourceHandle?)`
   - `updateNodeConfig(nodeId, configPatch)`
   - `removeNode(nodeId)` / `removeEdge(edgeId)`
   - `explainFlow()` / `validateFlow()` → returns natural-language description / list of issues
   - `runFlow(triggerEventStub)` / `pauseFlow()` for execute-on-demand
3. **Transport:** Vercel AI SDK 5 with `streamUI` (or `useChat` + typed tool parts). When a tool call arrives, the chat client dispatches it to the canvas Zustand store, which optimistically updates React Flow nodes/edges. The model sees the next snapshot via `listNodes()`.
4. **State:** Keep the full flow JSON in a Zustand store. Each tool call is a reducer. Persist to Supabase on debounce + on explicit save.
5. **Bidirectional editing:** User edits on the canvas write to the same Zustand store, so the next time the AI calls `listNodes()` it sees the human's changes. No special sync code.

**Reference:** This is exactly the v0-by-Vercel pattern but with a node graph instead of React components. Vercel AI SDK 5 [docs on generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) and the [multi-step pattern](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui) document `stepCountIs(N)` for capping tool-call loops (use ~10 for a flow-builder turn).

**Confidence:** HIGH that the pattern works (multiple OSS products implement it). MEDIUM that it will feel "magic" on first turn — almost certainly needs a system prompt with a few-shot of flow examples and rules like "always validate before terminating".

---

## 7. Solving the Vercel 10s Timeout

**Recommended pattern:** Three-tier execution model.

| Latency tier | Compute | Use cases |
|---|---|---|
| **Sync (<10s)** | Next.js API route on Vercel Fluid Compute (≤800s on Pro, free tier still 10s but fluid billing helps) | Synchronous test runs, simple 1–2 step flows the user triggers from the canvas |
| **Async (10s–150s)** | Supabase Edge Function (150s free / longer on paid) triggered via `pgmq` queue + `pg_cron` (runs every minute) | Most real workflow steps — API calls, agent loops, multi-step chains |
| **Durable (minutes–months)** | DB row in `workflow_runs` with `resume_at` timestamp + `waiting_for_event` filter, polled by pg_cron | `step.sleep('24h')`, `step.waitForEvent('inbound.message', { timeout: '7d' })` |

**Why this works:**
- `pgmq` is now first-party in Supabase ([blog](https://supabase.com/blog/processing-large-jobs-with-edge-functions)). Combined with `pg_cron`, Supabase explicitly documents this exact "queue + cron + edge function" pattern for background jobs.
- Edge Functions get a longer timeout than Vercel routes (150s on free, more on paid) and run in Supabase's network — closer to our DB, no Vercel function cost.
- `step.sleep` is implemented as `UPDATE workflow_runs SET resume_at = now() + interval '24h', status='sleeping'`. A pg_cron job every minute selects rows where `resume_at <= now() AND status='sleeping'` and enqueues them.
- `step.waitForEvent` is a row in `workflow_waits` (run_id, event_filter, timeout_at). The existing inbound-event router (action-engine) gets one new hook: after dispatch, also check waits, and resume matching runs.

**Vercel Fluid Compute** ([changelog](https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes)) gives us synchronous bursts up to 5 minutes (800s on Pro) and bills only for active compute. Useful for "test run this flow" without a queue round-trip.

**What we are *not* doing:** running a long-lived Node worker on a separate host (Heroku/Railway/Fly). That would defeat the value of Supabase + Vercel as the entire infra.

Sources: [Supabase queues + cron + edge functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions), [Vercel Fluid Compute](https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes), [Inngest blog on Next.js timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts).

---

## 8. Trigger Declaration

**Pattern:** Declarative triggers in a `workflow_triggers` table, fired by the existing action-engine router.

```sql
create table workflow_triggers (
  id uuid primary key,
  workflow_id uuid not null references workflows(id),
  org_id uuid not null,
  event_type text not null,            -- 'vapi.call.ended' | 'manychat.inbound' | 'cron' | 'webhook.custom' | ...
  filter jsonb,                        -- JSON-path / JSONata predicate over event payload
  schedule_cron text,                  -- only when event_type='cron'
  enabled boolean default true
);
create index on workflow_triggers (event_type, enabled);
```

**Flow:**
1. Inbound webhook lands in existing `/api/vapi/*` / `/api/manychat/` / `/api/meta/` handler.
2. Handler normalizes the event into the action-engine's existing event shape.
3. **New step in action-engine:** after dispatching to legacy single-shot tool_configs, query `workflow_triggers WHERE event_type = $1 AND enabled AND filter_matches($2)` and enqueue `pgmq` messages to start matching workflow runs.
4. Cron triggers are handled by a pg_cron job that scans `workflow_triggers WHERE event_type='cron'` and enqueues based on schedule.

This **reuses the action-engine entirely** — the workflow builder is a second consumer of the same dispatch stream.

**How the big players do it** (per their docs):
- **n8n / Zapier:** Same pattern — triggers are first-class DB entities; an event router activates matching workflows.
- **Inngest:** Event-driven by design — every workflow is `inngest.createFunction({ event: 'foo.bar' }, …)`. Same model, different syntax.

**Differentiator for Xphere:** Because our event sources (Vapi, ManyChat, Meta, GHL, Twilio, Evolution Go) are already normalized through the action-engine, the trigger table's `event_type` enum is small and stable. We don't have to support "every Zapier app's webhook shape" — only our six integration surfaces.

---

## 9. Reference Repos Worth Studying

| Repo | License | Stars | Last release | Why study it | Extraction risk |
|---|---|---|---|---|---|
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | MIT | 34.5k+ | v12 (March 2026) | The canvas itself | None — use as dependency |
| [simstudioai/sim](https://github.com/simstudioai/sim) | Apache-2.0 | 28.5k | May 19 2026 | **Closest UX analog**: Next.js + ReactFlow + Postgres + Drizzle, AI Copilot for flow generation | Low — Apache-2.0; can study patterns freely with attribution |
| [activepieces/activepieces](https://github.com/activepieces/activepieces) | MIT | 22.3k | May 6 2026 | Best OSS Zapier-style flow editor architecture | Low — MIT, "piece" plugin architecture is well-documented |
| [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) | Apache-2.0 | very large | v3.1 (March 2026) | LangChain-style visual builder; node component patterns in React | Low |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | MIT | active | 2026 | Use as a library *inside* an Agent node | None — use as dependency |
| [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | Apache-2.0 | 22k+ | v1.0 (Jan 2026) | TS-native workflow primitives (suspend/resume/time-travel) | Low — could adopt for the in-process step API if our homegrown engine stalls |
| [inngest/inngest](https://github.com/inngest/inngest) | **SSPL** (server) / Apache-2.0 (SDK) | 5.4k | v1.21 (May 19 2026) | The `step.*` API is the gold standard; study it, don't ship it | **High** — SSPL on server is a blocker for embedding in SaaS |
| [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Apache-2.0 | 15k | v4.4.6 (May 12 2026) | v3 task-run model, CRIU-based checkpointing | Medium — Apache OK, but architecture assumes separate orchestrator + worker pool |
| [n8n-io/n8n](https://github.com/n8n-io/n8n) | **Sustainable Use License** | very large | active | Best in class but **legally off-limits** for SaaS embedding | **Blocker** — license explicitly forbids what we're doing |
| [windmill-labs/windmill](https://github.com/windmill-labs/windmill) | AGPL/Other | 16k | active | Internal-tools-style orchestrator | High — AGPL contagion + wrong runtime |
| [kestra-io/kestra](https://github.com/kestra-io/kestra) | Apache-2.0 | 26.6k | active | YAML-first orchestrator | High — Java/JVM, wrong fit |
| [langflow-ai/langflow](https://github.com/langflow-ai/langflow) | MIT, IBM | very large | v1.8 (March 2026) | Visual IDE for LangChain | Medium — Python backend, only UI patterns transfer |

**Concrete recommended reading order** before/during phase 1:
1. Sim Studio's `apps/sim/components/workflow` and `apps/sim/lib/copilot` directories.
2. Activepieces' "piece" definition format (their plugin schema).
3. LangGraph.js' `StateGraph` API and checkpointing model.
4. Inngest's `step.*` docs (don't read the Go source — just the SDK).

---

## Key Risks

1. **AI Builder quality.** The pattern is well-understood, but "user says 'when a new lead comes in from Meta, wait 1 hour, then send a WhatsApp with their first name' and the AI builds it correctly" requires careful tool design + system prompt + few-shot. Risk of demos looking great and edge cases failing. **Mitigation:** ship `explainFlow` and `validateFlow` tools early so the AI can self-correct, and ship an undo stack so users can recover from bad mutations.
2. **`pgmq` + `pg_cron` durability at scale.** Supabase officially supports this but we'll be implementing per-tenant scheduling on top. Risk that `pg_cron`'s "runs every minute" granularity feels sluggish for "test this flow now" UX. **Mitigation:** synchronous test runs go through Vercel Fluid Compute directly, never through the queue.
3. **Scope creep into "we re-built Inngest poorly".** Step semantics, retries, idempotency, observability — easy to underestimate. **Mitigation:** ship the *minimum* primitives (`run`, `sleep`, `waitForEvent`), refuse to add `step.parallel` / `step.race` / fan-out until users explicitly ask. Keep the engine in <2k LOC.
4. **License hygiene for inspiration vs. copy.** Sim Studio is Apache-2.0 — fine to study, must attribute if we copy code. n8n is off-limits. Activepieces is MIT — safe.
5. **Multi-tenant secret handling in flow definitions.** A flow JSON will reference API keys / credentials. Must stay encrypted via the existing `src/lib/crypto.ts` AES-256-GCM path; never serialize secrets into the AI-visible flow snapshot. **Mitigation:** the LLM sees credential *references* (e.g. `{ credentialRef: 'ghl_main' }`), never raw values.
6. **React Flow re-render perf.** Solved problem if we discipline ourselves with `React.memo` on custom nodes and memoized node arrays. Mention this in the contributor guidelines for the package.

---

## Updated Phase Decomposition (proposed)

Based on findings, the SEED-019 milestone likely breaks down as:

**Phase A — Canvas foundation (1 wk)**
- Install `@xyflow/react`, build node-type registry (trigger / action / condition / wait / agent / loop)
- Zod schema for `Workflow`, persistence to a `workflows` table with RLS
- Zustand store + autosave + undo/redo
- Manual node-by-node builder works end-to-end (save, reload, edit, no execution yet)

**Phase B — Engine + triggers (2 wks)**
- `workflow_runs`, `workflow_steps_state`, `workflow_waits`, `workflow_triggers` tables (+ RLS)
- pgmq queue + pg_cron tick
- Edge Function worker that picks pending runs and dispatches via the existing action-engine
- `step.run` / `step.sleep` / `step.waitForEvent` primitives
- Action-engine hook: on inbound event, also activate matching triggers + satisfy matching waits
- Synchronous test-run path via Vercel Fluid Compute

**Phase C — AI builder (1.5 wks)**
- Define the 7-tool toolkit (listNodes / addNode / connectNodes / updateNodeConfig / removeNode / explainFlow / validateFlow)
- Wire up Vercel AI SDK 5 streaming with Claude Sonnet 4.5 + Structured Outputs
- Chat sidebar component that streams tool calls into Zustand reducers → optimistic canvas updates
- System prompt + few-shot library (covers ~10 archetypal flow patterns from existing Xphere customers)

**Phase D — Polish + observability (1 wk)**
- Run history view (per workflow, per run, per step)
- Error replays, manual retry from a failed step
- Variable interpolation: `{{ path }}` regex helper + JSONata expression nodes
- Documentation: piece authoring guide

**Total:** 5.5 weeks, which fits the 4-6 week milestone budget with a small buffer.

**Not in v1 (deliberate):** parallel/fan-out steps, sub-workflows, version history beyond simple undo, marketplace of community pieces, native code-node. These are post-v1 features once we know what real users hit limits on.

---

## Sources

- [React Flow v12 release](https://xyflow.com/blog/react-flow-12-release) · [xyflow GitHub](https://github.com/xyflow/xyflow) · [Performance docs](https://reactflow.dev/learn/advanced-use/performance) · [Showcase](https://reactflow.dev/showcase)
- [Sim Studio repo](https://github.com/simstudioai/sim) · [Activepieces repo](https://github.com/activepieces/activepieces) · [Flowise vs Langflow](https://www.leanware.co/insights/compare-langflow-vs-flowise)
- [Inngest GitHub](https://github.com/inngest/inngest) · [Inngest durable workflows](https://www.inngest.com/uses/durable-workflows) · [Inngest wait-for-event docs](https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event)
- [Trigger.dev v3 announcement](https://trigger.dev/blog/v3-announcement) · [Trigger.dev GitHub](https://github.com/triggerdotdev/trigger.dev)
- [LangGraph.js](https://github.com/langchain-ai/langgraphjs) · [LangGraph docs](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents) · [Mastra](https://github.com/mastra-ai/mastra)
- [n8n Sustainable Use License](https://docs.n8n.io/sustainable-use-license/) · [n8n license analysis](https://scalevise.com/resources/n8n-automation-license-commercial-use/)
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [Vercel AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) · [Vercel AI SDK multi-step](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
- [Supabase pgmq + cron + edge functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions) · [Vercel Fluid Compute](https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes) · [Inngest on Next.js timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts)
- [JSONata in AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html) · [n8n expressions docs](https://docs.n8n.io/data/expressions/)
- [npm trends — node editors](https://npmtrends.com/drawflow-vs-flume-vs-gojs-vs-node-red-vs-noflo-runtime-base-vs-react-flow-renderer-vs-rete) · [awesome node-based UIs](https://github.com/xyflow/awesome-node-based-uis)
