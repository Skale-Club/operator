'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '@/lib/supabase/server'
import { FlowDefinition } from '@/lib/flows/schema'
import { AI_BUILDER_TOOLS, dispatchTool } from '@/lib/flows/ai-tools'

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

const SYSTEM_PROMPT = `You are an expert automation builder for Xphere. You build visual workflow graphs by calling tools that mutate a canvas.

CANVAS MODEL:
- A flow is a directed graph: nodes connected by edges.
- Node types: trigger (start), action (call integration), condition (if/else branch), wait (sleep or wait for event), agent (AI loop), end (terminate).
- Every flow needs exactly ONE trigger node. Most flows benefit from an end node.
- Linear sequences are preferred — most automations are: trigger → 2-5 actions → end.

RULES:
1. Before mutating, call list_nodes to see the current state.
2. Place new nodes with sensible y-coordinates (top-to-bottom: trigger ~50, then +120 per row).
3. Use x ~250 for the main column. Branch nodes (condition) put left/right children at x=100/400.
4. Always set a clear, short label on each node (e.g. "Create contact", "Send welcome WhatsApp").
5. Connect nodes after creating them. Use source_handle "true"/"false" for condition branches.
6. End with one end node when the flow has a clear termination.
7. Don't over-engineer. Linear is fine. Add branching only when the user asks for it.
8. After mutations, briefly explain what you built in plain language.

ACTION TYPES available (set as data.action_type on action nodes):
http_request, send_whatsapp, send_email, create_contact, create_task, create_note,
update_pipeline_stage, query_knowledge, execute_flow, log.

For configurable params, populate the action's data.config with the right shape.
Use {{ trigger.payload.field }} or {{ steps.node_id.output.field }} for variable interpolation.`

export async function aiBuildFlow(input: {
  prompt: string
  currentDefinition: FlowDefinition
}): Promise<ActionResult<{ definition: FlowDefinition; summary: string }>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ai_not_configured' }

  const client = new Anthropic({ apiKey })

  // Working copy of the definition — tool dispatches mutate this in place
  const workingDef: FlowDefinition = JSON.parse(JSON.stringify(input.currentDefinition))

  type ChatMsg = Anthropic.MessageParam
  const messages: ChatMsg[] = [{ role: 'user', content: input.prompt }]
  let summary = ''
  const MAX_TURNS = 10

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response: Anthropic.Message
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: AI_BUILDER_TOOLS,
        messages,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `ai_error: ${msg}` }
    }

    // Collect text + tool uses from this turn
    const textParts: string[] = []
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    for (const block of response.content) {
      if (block.type === 'text') textParts.push(block.text)
      if (block.type === 'tool_use') {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: (block.input as Record<string, unknown>) ?? {},
        })
      }
    }

    if (textParts.length > 0) summary += textParts.join('\n')

    // No tool calls → we're done
    if (toolUses.length === 0) break

    // Echo assistant turn + tool results back to the model
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.MessageParam = {
      role: 'user',
      content: toolUses.map((tu) => {
        const dispatch = dispatchTool(tu.name, tu.input, workingDef)
        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: dispatch.success
            ? JSON.stringify({ ok: true, data: dispatch.data })
            : JSON.stringify({ ok: false, error: dispatch.error }),
          is_error: !dispatch.success,
        }
      }),
    }
    messages.push(toolResults)

    if (response.stop_reason === 'end_turn') break
  }

  return { ok: true, data: { definition: workingDef, summary: summary.trim() } }
}
