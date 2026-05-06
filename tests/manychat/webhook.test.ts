import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock createServiceRoleClient — webhook uses service role, no user session
vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase/admin'

// Build a minimal mock Supabase client for webhook tests
function buildWebhookMockSupabase(channelRow: { id: string; org_id: string } | null) {
  const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null })

  const fromMock = vi.fn((table: string) => {
    if (table === 'manychat_channels') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: channelRow, error: null }),
      }
    }
    if (table === 'manychat_events') {
      return { insert: insertSpy }
    }
    return {}
  })

  return { from: fromMock, _insertSpy: insertSpy }
}

function makePostRequest(body: string, secret: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret !== null) {
    headers['x-operator-secret'] = secret
  }
  return new Request('http://localhost/api/manychat/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

describe('WEBHOOK-02: invalid or missing X-Operator-Secret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Channel lookup returns null — secret does not match any channel
    vi.mocked(createServiceRoleClient).mockReturnValue(
      buildWebhookMockSupabase(null) as ReturnType<typeof createServiceRoleClient>
    )
  })

  it('returns 403 when X-Operator-Secret header is missing', async () => {
    const { POST } = await import('@/app/api/manychat/webhook/route')
    const response = await POST(makePostRequest('{}', null))
    expect(response.status).toBe(403)
  })

  it('returns 403 when X-Operator-Secret does not match any channel', async () => {
    const { POST } = await import('@/app/api/manychat/webhook/route')
    const response = await POST(makePostRequest('{}', 'invalid-secret'))
    expect(response.status).toBe(403)
  })
})

describe('WEBHOOK-01, WEBHOOK-03, WEBHOOK-04: valid secret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Channel lookup succeeds — valid secret
    vi.mocked(createServiceRoleClient).mockReturnValue(
      buildWebhookMockSupabase({ id: 'channel-1', org_id: 'org-1' }) as ReturnType<typeof createServiceRoleClient>
    )
  })

  it('WEBHOOK-04: returns 200 when X-Operator-Secret is valid', async () => {
    const { POST } = await import('@/app/api/manychat/webhook/route')
    const response = await POST(makePostRequest(
      JSON.stringify({ event_type: 'flow_completed', subscriber_id: 'sub-1' }),
      'valid-secret-uuid'
    ))
    expect(response.status).toBe(200)
    const json = await response.json() as { ok: boolean }
    expect(json.ok).toBe(true)
  })

  it('WEBHOOK-03: logs event to manychat_events with status unmatched', async () => {
    const mockClient = buildWebhookMockSupabase({ id: 'channel-1', org_id: 'org-1' })
    vi.mocked(createServiceRoleClient).mockReturnValue(
      mockClient as ReturnType<typeof createServiceRoleClient>
    )

    const { POST } = await import('@/app/api/manychat/webhook/route')
    await POST(makePostRequest(
      JSON.stringify({ event_type: 'flow_completed', subscriber_id: 'sub-1' }),
      'valid-secret-uuid'
    ))

    expect(mockClient._insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        channel_id: 'channel-1',
        status: 'unmatched',
      })
    )
  })

  it('WEBHOOK-04: returns 200 even when event payload is malformed JSON', async () => {
    const { POST } = await import('@/app/api/manychat/webhook/route')
    const response = await POST(makePostRequest('not-valid-json{{{', 'valid-secret-uuid'))
    expect(response.status).toBe(200)
  })
})
