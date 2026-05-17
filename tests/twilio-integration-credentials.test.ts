// tests/twilio-integration-credentials.test.ts
// v2.1 — verifies that the Twilio Voice token endpoint reads ALL credentials
// from the per-org integration row (encrypted_api_key + config) and never
// touches process.env.TWILIO_*. Regression guard for moving Twilio Voice SDK
// credentials out of env vars in v2.1.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock supabase server clients ─────────────────────────────────────────────
const rpcMock = vi.fn()
const integrationSelectMock = vi.fn()
const callSettingsSelectMock = vi.fn()

const fromMock = vi.fn((table: string) => {
  if (table === 'call_settings') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: callSettingsSelectMock,
    }
  }
  if (table === 'integrations') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: integrationSelectMock,
    }
  }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
  getUser: vi.fn(async () => ({ id: 'user-1', email: 'u@example.com' })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: fromMock })),
}))

// Mock decrypt so we can fully control which credentials the route sees.
const decryptMock = vi.fn()
vi.mock('@/lib/crypto', () => ({
  decrypt: decryptMock,
  encrypt: vi.fn(async (v: string) => `enc(${v})`),
  maskApiKey: vi.fn((v: string) => `${v.slice(0, 2)}••${v.slice(-4)}`),
}))

beforeEach(() => {
  vi.clearAllMocks()
  rpcMock.mockReset()
  integrationSelectMock.mockReset()
  callSettingsSelectMock.mockReset()
  decryptMock.mockReset()

  // Strip every Twilio env var so an accidental fall-through to process.env
  // would surface as an error rather than masking a regression.
  delete process.env.TWILIO_API_KEY_SID
  delete process.env.TWILIO_API_KEY_SECRET
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_TWIML_APP_SID
  delete process.env.TWILIO_SIP_DOMAIN

  rpcMock.mockResolvedValue({ data: 'org-1', error: null })
  callSettingsSelectMock.mockResolvedValue({
    data: { twilio_client_identity: 'user-abcd1234', routing_mode: 'browser' },
    error: null,
  })
})

describe('POST /api/twilio/token — credentials are read per-org', () => {
  it('returns 200 with a JWT when all four Voice SDK fields are present in the integration', async () => {
    integrationSelectMock.mockResolvedValue({
      data: {
        encrypted_api_key: 'BLOB',
        config: { from_number: '+19990000000', twiml_app_sid: 'APtest123' },
      },
      error: null,
    })
    decryptMock.mockResolvedValue(
      JSON.stringify({
        account_sid: 'ACorgspecific',
        auth_token: 'tok-org-specific',
        api_key_sid: 'SKorgspecific',
        api_key_secret: 'secret-org-specific',
      }),
    )

    const { POST } = await import('@/app/api/twilio/token/route')
    const res = await POST()
    expect(res.status).toBe(200)
    const json = (await res.json()) as { token: string; identity: string }
    // JWTs are three dot-separated base64url segments
    expect(json.token.split('.')).toHaveLength(3)
    expect(json.identity).toBe('user-abcd1234')

    // decrypt was called exactly with the encrypted blob from the integration
    expect(decryptMock).toHaveBeenCalledWith('BLOB')
  })

  it('returns 400 with a helpful error when api_key_sid is missing from the integration blob', async () => {
    integrationSelectMock.mockResolvedValue({
      data: {
        encrypted_api_key: 'BLOB',
        config: { from_number: '+19990000000', twiml_app_sid: 'APtest123' },
      },
      error: null,
    })
    decryptMock.mockResolvedValue(
      JSON.stringify({
        account_sid: 'ACorgspecific',
        auth_token: 'tok-org-specific',
        // api_key_sid + api_key_secret missing — Voice SDK is not configured
      }),
    )

    const { POST } = await import('@/app/api/twilio/token/route')
    const res = await POST()
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toMatch(/API Key|TwiML App/i)
  })

  it('returns 400 when twiml_app_sid is missing from integration.config', async () => {
    integrationSelectMock.mockResolvedValue({
      data: {
        encrypted_api_key: 'BLOB',
        config: { from_number: '+19990000000' },
      },
      error: null,
    })
    decryptMock.mockResolvedValue(
      JSON.stringify({
        account_sid: 'ACorgspecific',
        auth_token: 'tok-org-specific',
        api_key_sid: 'SKorgspecific',
        api_key_secret: 'secret-org-specific',
      }),
    )

    const { POST } = await import('@/app/api/twilio/token/route')
    const res = await POST()
    expect(res.status).toBe(400)
  })

  it('returns 400 when no Twilio integration row exists for the org', async () => {
    integrationSelectMock.mockResolvedValue({ data: null, error: null })

    const { POST } = await import('@/app/api/twilio/token/route')
    const res = await POST()
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toMatch(/not connected/i)
  })

  it('does NOT touch process.env.TWILIO_* for credentials even when those env vars are set', async () => {
    // Set env vars to nonsense — if the route uses them, the generated token
    // will be signed with these instead of the per-org secret, and decrypt
    // won't be invoked. We assert the opposite.
    process.env.TWILIO_API_KEY_SID = 'SK_FROM_ENV_SHOULD_BE_IGNORED'
    process.env.TWILIO_API_KEY_SECRET = 'env-secret-should-be-ignored'
    process.env.TWILIO_TWIML_APP_SID = 'AP_FROM_ENV'
    process.env.TWILIO_ACCOUNT_SID = 'AC_FROM_ENV'

    integrationSelectMock.mockResolvedValue({
      data: {
        encrypted_api_key: 'BLOB',
        config: { from_number: '+19990000000', twiml_app_sid: 'APorgconfig' },
      },
      error: null,
    })
    decryptMock.mockResolvedValue(
      JSON.stringify({
        account_sid: 'ACorgblob',
        auth_token: 'tok-org-blob',
        api_key_sid: 'SKorgblob',
        api_key_secret: 'secret-org-blob',
      }),
    )

    const { POST } = await import('@/app/api/twilio/token/route')
    const res = await POST()
    expect(res.status).toBe(200)
    const json = (await res.json()) as { token: string }

    // Decode the JWT payload (segment 1, base64url) and confirm:
    //   sub = ACorgblob          (NOT AC_FROM_ENV)
    //   iss = SKorgblob          (NOT SK_FROM_ENV_SHOULD_BE_IGNORED)
    //   grants.voice.outgoing.application_sid = APorgconfig (NOT AP_FROM_ENV)
    const [, payloadB64] = json.token.split('.')
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const payload = JSON.parse(Buffer.from(padded + padding, 'base64').toString('utf8')) as {
      sub: string
      iss: string
      grants: { voice: { outgoing: { application_sid: string } } }
    }
    expect(payload.sub).toBe('ACorgblob')
    expect(payload.iss).toBe('SKorgblob')
    expect(payload.grants.voice.outgoing.application_sid).toBe('APorgconfig')

    // And explicitly confirm decrypt was the source of truth.
    expect(decryptMock).toHaveBeenCalledWith('BLOB')
  })
})
