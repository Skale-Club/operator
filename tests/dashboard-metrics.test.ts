import { describe, it } from 'vitest'

describe('getDashboardMetrics (OBS-07)', () => {
  it.todo('returns callsToday count (calls since start of current day)')
  it.todo('returns callsWeek count (calls in last 7 days)')
  it.todo('returns callsMonth count (calls since first of current month)')
  it.todo('returns toolSuccessRate as integer percentage (0-100)')
  it.todo('returns null for toolSuccessRate when no action_logs exist')
  it.todo('returns recentCalls array with at most 10 items')
  it.todo('returns recentFailures array of error/timeout action_logs from last 24h')
  it.todo('all counts and arrays are scoped to current org via RLS')
})
