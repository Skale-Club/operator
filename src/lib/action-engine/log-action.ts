// src/lib/action-engine/log-action.ts
// Writes an action_logs row after the Vapi response is sent.
// IMPORTANT: This function MUST be called inside after() from next/server.
// It must never throw — a logging failure must never prevent Vapi from getting a response.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

export interface LogActionPayload {
  organization_id: string
  tool_config_id: string | null
  vapi_call_id: string
  tool_name: string
  status: 'success' | 'error' | 'timeout'
  execution_ms: number
  request_payload: Json
  response_payload: Json
  error_detail: string | null
}

export async function logAction(
  payload: LogActionPayload,
  supabase: SupabaseClient<Database>
): Promise<void> {
  try {
    await supabase.from('action_logs').insert(payload)
  } catch (err) {
    // Swallow all errors — log failure must never crash the caller or block Vapi response
    console.error('[logAction] Failed to write action_logs row:', {
      error: err instanceof Error ? err.message : String(err),
      vapi_call_id: payload.vapi_call_id,
      tool_name: payload.tool_name,
    })
  }
}
