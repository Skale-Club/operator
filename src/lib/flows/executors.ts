// Per-node executors for the flow engine.
// Each executor receives interpolated config + accumulated run state and
// returns the step's output (merged into state.steps[stepId].output).

import type { FlowNodeData } from './schema'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface ExecutorContext {
  orgId: string
  supabase: SupabaseClient<Database>
  state: Record<string, unknown>
}

export interface ExecutorResult {
  output: Record<string, unknown>
}

// ─── http_request ────────────────────────────────────────────────────────────

async function executeHttpRequest(
  config: Record<string, unknown>,
): Promise<ExecutorResult> {
  const url = String(config.url ?? '')
  if (!url) throw new Error('http_request requires a url')

  const method = String(config.method ?? 'GET').toUpperCase()
  const headers = (config.headers as Record<string, string>) ?? { 'Content-Type': 'application/json' }
  const body = config.body
  const init: RequestInit = { method, headers }
  if (body !== undefined && body !== null && method !== 'GET') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const response = await fetch(url, init)
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* keep text */ }

  return {
    output: {
      status: response.status,
      ok: response.ok,
      body: parsed,
    },
  }
}

// ─── log (built-in no-op for debugging) ──────────────────────────────────────

async function executeLog(config: Record<string, unknown>): Promise<ExecutorResult> {
  console.log('[flow:log]', JSON.stringify(config))
  return { output: { logged: true, payload: config } }
}

// ─── stub: not-yet-wired actions ─────────────────────────────────────────────

async function executeStub(
  actionType: string,
  config: Record<string, unknown>,
): Promise<ExecutorResult> {
  // Phase B placeholder: returns a structured "would have done X" without
  // calling real integrations. Phase B+ wires send_whatsapp / send_email /
  // create_contact / etc. into the existing action-engine.
  return {
    output: {
      _stub: true,
      _action_type: actionType,
      _params: config,
      _note: 'Executor not yet wired. Action recorded but not dispatched.',
    },
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function executeNode(
  node: { id: string; type: string; data: FlowNodeData },
  resolvedConfig: Record<string, unknown>,
  _ctx: ExecutorContext,
): Promise<ExecutorResult> {
  const data = node.data

  if (data.kind === 'trigger') {
    // Trigger node simply emits its payload as output (already in state.trigger)
    return { output: {} }
  }

  if (data.kind === 'end') {
    return { output: { terminated: true } }
  }

  if (data.kind === 'condition') {
    // Handled by engine itself for branching; executor is a no-op
    return { output: {} }
  }

  if (data.kind === 'wait') {
    // Phase B v1 doesn't suspend execution; just record intent so the run
    // history shows the planned wait. Real suspension lands when pgmq/pg_cron
    // ship.
    return {
      output: {
        _wait_mode: data.mode,
        _wait_duration: data.duration ?? null,
        _wait_skipped: true,
        _note: 'Wait nodes are recorded but do not suspend execution in this engine version.',
      },
    }
  }

  if (data.kind === 'agent') {
    // Phase B placeholder. Phase C+ will spin up an agent loop.
    return {
      output: {
        _stub: true,
        _agent_id: data.agent_id ?? null,
        _note: 'Agent nodes are stubbed until Phase B agent runtime wiring.',
      },
    }
  }

  if (data.kind === 'action') {
    switch (data.action_type) {
      case 'http_request': return executeHttpRequest(resolvedConfig)
      case 'log':          return executeLog(resolvedConfig)
      default:             return executeStub(data.action_type, resolvedConfig)
    }
  }

  return { output: {} }
}
