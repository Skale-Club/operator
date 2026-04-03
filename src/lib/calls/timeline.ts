// src/lib/calls/timeline.ts
// Pure utility: merges Vapi transcript turns and action_logs into a single chronological array.
// Used server-side in the call detail page to build the timeline before render.

import type { ArtifactMessage } from '@/types/vapi'
import type { Database } from '@/types/database'

type ActionLogRow = Database['public']['Tables']['action_logs']['Row']

export type TurnItem = {
  kind: 'turn'
  role: string
  message: string
  offset: number
}

export type ToolItem = {
  kind: 'tool'
  toolName: string
  status: 'success' | 'error' | 'timeout'
  executionMs: number
  errorDetail: string | null
  offset: number
}

export type TranscriptItem = TurnItem | ToolItem

export function buildTimeline(
  turns: ArtifactMessage[],
  actionLogs: ActionLogRow[],
  callStartedAt: string
): TranscriptItem[] {
  const startMs = new Date(callStartedAt).getTime()

  const turnItems: TurnItem[] = turns
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => ({
      kind: 'turn' as const,
      role: t.role,
      message: t.message ?? '',
      offset: t.secondsFromStart ?? 0,
    }))

  const toolItems: ToolItem[] = actionLogs.map((log) => ({
    kind: 'tool' as const,
    toolName: log.tool_name,
    status: log.status,
    executionMs: log.execution_ms,
    errorDetail: log.error_detail,
    offset: (new Date(log.created_at).getTime() - startMs) / 1000,
  }))

  return [...turnItems, ...toolItems].sort((a, b) => a.offset - b.offset)
}
