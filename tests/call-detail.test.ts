import { describe, it } from 'vitest'

describe('buildTimeline: basic transcript (OBS-05)', () => {
  it.todo('returns empty array when both turns and actionLogs are empty')
  it.todo('maps user role turn to kind=turn with role=user')
  it.todo('maps assistant role turn to kind=turn with role=assistant')
  it.todo('excludes turns with role other than user or assistant')
  it.todo('preserves message text and secondsFromStart offset')
})

describe('buildTimeline: tool badge interleaving (OBS-06)', () => {
  it.todo('maps action_log to kind=tool item with toolName, status, executionMs, errorDetail')
  it.todo('computes offset from (log.created_at - callStartedAt) / 1000')
  it.todo('sorts merged array by offset ascending')
  it.todo('tool badge appears between correct transcript turns when offset is between them')
  it.todo('uses ?? 0 fallback when secondsFromStart is undefined')
  it.todo('errorDetail is null when log.error_detail is null')
  it.todo('errorDetail is string when log.error_detail has value')
})
