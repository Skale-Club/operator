// SEED-025 Phase B: unified workflow runner.
//
// Single entry point for executing any workflow regardless of kind:
//   - kind='tool' (1-node)   → delegates to executeAction (Action Engine)
//   - kind='flow' (DAG)      → delegates to the Flow Engine (Phase F future merge)
//
// For Phase B we only need the tool-kind fast path; the flow-kind branch
// will route into lib/flows/engine.ts in a later phase. Both paths share
// the same `WorkflowRunResult` shape so downstream loggers, webhook
// handlers, and the Copilot's run_workflow tool stay uniform.

import { executeAction, type ActionContext } from '@/lib/action-engine/execute-action'
import type { GhlCredentials } from '@/lib/ghl/client'
import type { ToolConfigWithIntegration } from '@/lib/action-engine/resolve-tool'

export interface WorkflowRunInput {
  // The resolved tool/workflow (today this is the projected ToolConfigWithIntegration
  // produced by resolveTool/resolveWorkflowAsTool; once flow-kind is wired it
  // will accept a richer Workflow type).
  tool: ToolConfigWithIntegration
  // Params from the caller (Vapi tool-call arguments, ManyChat field map, etc.)
  params: Record<string, unknown>
  // Decrypted credentials for the integration this tool binds to.
  credentials: GhlCredentials
  // Per-call context (org id, supabase client, delegation chain, ...)
  context: ActionContext
}

export interface WorkflowRunResult {
  ok: boolean
  output: string
  error?: string
}

export async function runWorkflow(input: WorkflowRunInput): Promise<WorkflowRunResult> {
  try {
    const output = await executeAction(
      input.tool.action_type,
      input.params,
      input.credentials,
      input.context,
    )
    return { ok: true, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      output: input.tool.fallback_message,
      error: message,
    }
  }
}
