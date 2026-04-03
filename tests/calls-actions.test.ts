import { describe, it } from 'vitest'

describe('getCalls: pagination (OBS-02)', () => {
  it.todo('returns calls array and total count')
  it.todo('applies LIMIT 20 and correct OFFSET for page 1')
  it.todo('applies LIMIT 20 and correct OFFSET for page 2')
  it.todo('orders results by created_at descending')
})

describe('getCalls: filters (OBS-03)', () => {
  it.todo('filters by from date using gte on started_at')
  it.todo('filters by to date using lte on started_at')
  it.todo('filters by status (ended_reason equality match)')
  it.todo('filters by assistantId equality on assistant_id column')
  it.todo('filters by callType equality on call_type column')
  it.todo('applies multiple filters simultaneously')
})

describe('getCalls: search (OBS-04)', () => {
  it.todo('filters by q param using ILIKE on customer_number')
  it.todo('filters by q param using ILIKE on customer_name')
  it.todo('returns empty array when q matches nothing')
})
