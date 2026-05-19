'use server'

import { createClient, getUser } from '@/lib/supabase/server'

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

export interface CopilotRunDetail {
  id: string
  conversation_id: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  status: string
  error: string | null
  started_at: string
  ended_at: string | null
  toolCalls: Array<{
    id: string
    tool_name: string
    input: Record<string, unknown>
    output: unknown
    error: string | null
    status: string
    duration_ms: number
    created_at: string
  }>
}

export async function getCopilotRun(id: string): Promise<ActionResult<CopilotRunDetail>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()

  const { data: run, error } = await supabase
    .from('copilot_runs')
    .select('id, conversation_id, provider, model, input_tokens, output_tokens, estimated_cost_usd, status, error, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!run) return { ok: false, error: 'not_found' }

  const { data: calls } = await supabase
    .from('copilot_tool_calls')
    .select('id, tool_name, input, output, error, status, duration_ms, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true })

  return {
    ok: true,
    data: {
      ...run,
      estimated_cost_usd: Number(run.estimated_cost_usd),
      toolCalls: (calls ?? []).map((c) => ({
        ...c,
        input: (c.input as Record<string, unknown>) ?? {},
        output: c.output,
      })),
    },
  }
}
