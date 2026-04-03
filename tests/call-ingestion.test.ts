import { describe, it } from 'vitest'

describe('call-ingestion: VapiEndOfCallMessageSchema', () => {
  it.todo('parses a valid end-of-call-report payload with artifact.messages array')
  it.todo('rejects payload missing message.type field')
  it.todo('rejects payload with wrong message.type value')
  it.todo('accepts payload where artifact.messages is empty array')
  it.todo('accepts payload where customer fields are absent (optional)')
})

describe('call-ingestion: webhook route handler', () => {
  it.todo('returns 200 for valid end-of-call payload and inserts calls row')
  it.todo('returns 200 for malformed JSON without throwing')
  it.todo('returns 200 for payload with wrong message.type without inserting')
  it.todo('sets vapi_call_id from call.id')
  it.todo('stores artifact.messages array as transcript_turns JSONB column')
  it.todo('stores analysis.summary as summary column')
  it.todo('stores call.type as call_type column')
})
