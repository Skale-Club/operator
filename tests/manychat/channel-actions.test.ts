import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth + DB
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}))

// Mock crypto — encrypt and maskApiKey
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn().mockResolvedValue('iv-base64:ciphertext-base64'),
  maskApiKey: vi.fn().mockReturnValue('••••••••key4'),
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient, getUser } from '@/lib/supabase/server'
import { encrypt, maskApiKey } from '@/lib/crypto'

function buildMockSupabaseClient(insertError: string | null = null, deleteError: string | null = null) {
  const insertSpy = vi.fn().mockResolvedValue({ data: null, error: insertError ? { message: insertError } : null })
  const eqSpy = vi.fn().mockResolvedValue({ data: null, error: deleteError ? { message: deleteError } : null })

  const fromMock = vi.fn((table: string) => {
    if (table === 'manychat_channels') {
      return {
        insert: insertSpy,
        delete: vi.fn().mockReturnValue({ eq: eqSpy }),
      }
    }
    return {}
  })

  return { from: fromMock, _insertSpy: insertSpy, _eqSpy: eqSpy }
}

describe('CHANNEL-01: createManychatChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(getUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as Awaited<ReturnType<typeof getUser>>)
    vi.mocked(createClient).mockResolvedValue(
      buildMockSupabaseClient() as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('calls encrypt() with the provided API key', async () => {
    const { createManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    await createManychatChannel({ channelName: 'Main Bot', apiKey: 'real-api-key-value' })
    expect(encrypt).toHaveBeenCalledWith('real-api-key-value')
  })

  it('calls maskApiKey() to produce the key_hint', async () => {
    const { createManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    await createManychatChannel({ channelName: 'Main Bot', apiKey: 'real-api-key-value' })
    expect(maskApiKey).toHaveBeenCalledWith('real-api-key-value')
  })

  it('inserts encrypted_api_key and key_hint — never the raw API key', async () => {
    const mockClient = buildMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const { createManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    await createManychatChannel({ channelName: 'Main Bot', apiKey: 'real-api-key-value' })

    expect(mockClient._insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        encrypted_api_key: 'iv-base64:ciphertext-base64',
        key_hint: '••••••••key4',
        channel_name: 'Main Bot',
      })
    )
    // Raw key MUST NOT appear in any insert call argument
    const insertArg = mockClient._insertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(JSON.stringify(insertArg)).not.toContain('real-api-key-value')
  })

  it('returns error object when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const { createManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    const result = await createManychatChannel({ channelName: 'Bot', apiKey: 'key' })
    expect(result).toEqual({ error: expect.any(String) })
  })
})

describe('CHANNEL-05: deleteManychatChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(getUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as Awaited<ReturnType<typeof getUser>>)
    vi.mocked(createClient).mockResolvedValue(
      buildMockSupabaseClient() as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('calls delete().eq("id", channelId) on manychat_channels', async () => {
    const mockClient = buildMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const { deleteManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    await deleteManychatChannel('channel-uuid-123')

    expect(mockClient._eqSpy).toHaveBeenCalledWith('id', 'channel-uuid-123')
  })

  it('returns error object when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const { deleteManychatChannel } = await import('@/app/(dashboard)/integrations/manychat/actions')
    const result = await deleteManychatChannel('channel-uuid-123')
    expect(result).toEqual({ error: expect.any(String) })
  })
})
