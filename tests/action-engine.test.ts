import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---- Helpers for building mock Supabase query chains ----
function makeSingleChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

function makeInsertChain(result: { data: unknown; error: unknown }) {
  return {
    insert: vi.fn().mockResolvedValue(result),
  }
}

// ---- ACTN-01: Org resolution ----

describe('ACTN-01: Org resolution by assistant ID', () => {
  beforeEach(() => vi.resetModules())

  it('resolveOrg(assistantId) returns organization_id for a known active assistant mapping', async () => {
    const chain = makeSingleChain({ data: { organization_id: 'org_abc' }, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveOrg } = await import('@/lib/action-engine/resolve-org')
    const result = await resolveOrg('asst_known', supabase)

    expect(supabase.from).toHaveBeenCalledWith('assistant_mappings')
    expect(chain.select).toHaveBeenCalledWith('organization_id')
    expect(chain.eq).toHaveBeenCalledWith('vapi_assistant_id', 'asst_known')
    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
    expect(result).toBe('org_abc')
  })

  it('resolveOrg(assistantId) returns null for unknown assistant ID', async () => {
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveOrg } = await import('@/lib/action-engine/resolve-org')
    const result = await resolveOrg('asst_unknown', supabase)

    expect(result).toBeNull()
  })

  it('resolveOrg(assistantId) returns null for inactive assistant mapping (is_active=false)', async () => {
    // Inactive mapping: DB query filters is_active=true, so returns no rows → error
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveOrg } = await import('@/lib/action-engine/resolve-org')
    const result = await resolveOrg('asst_inactive', supabase)

    expect(result).toBeNull()
  })
})

// ---- ACTN-02: Tool config routing ----

describe('ACTN-02: Tool config routing', () => {
  beforeEach(() => vi.resetModules())

  const mockToolConfig = {
    id: 'tc_001',
    organization_id: 'org_abc',
    integration_id: 'int_001',
    tool_name: 'create_lead',
    action_type: 'create_contact' as const,
    config: {},
    fallback_message: 'Sorry, I could not create the contact.',
    is_active: true,
    integrations: {
      id: 'int_001',
      encrypted_api_key: 'encrypted:abc',
      location_id: 'loc_xyz',
      provider: 'gohighlevel' as const,
      config: {},
    },
  }

  it('resolveTool(orgId, toolName) returns tool_config row with integration for a matching active config', async () => {
    const chain = makeSingleChain({ data: mockToolConfig, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveTool } = await import('@/lib/action-engine/resolve-tool')
    const result = await resolveTool('org_abc', 'create_lead', supabase)

    expect(supabase.from).toHaveBeenCalledWith('tool_configs')
    expect(chain.select).toHaveBeenCalledWith('*, integrations(*)')
    expect(chain.eq).toHaveBeenCalledWith('organization_id', 'org_abc')
    expect(chain.eq).toHaveBeenCalledWith('tool_name', 'create_lead')
    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
    expect(result).toEqual(mockToolConfig)
    expect(result?.integrations.encrypted_api_key).toBe('encrypted:abc')
  })

  it('resolveTool(orgId, toolName) returns null for unknown tool name in that org', async () => {
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveTool } = await import('@/lib/action-engine/resolve-tool')
    const result = await resolveTool('org_abc', 'unknown_tool', supabase)

    expect(result).toBeNull()
  })

  it('resolveTool(orgId, toolName) returns null for inactive tool config (is_active=false)', async () => {
    // Inactive config: DB query filters is_active=true, so returns no rows → error
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient<Database>

    const { resolveTool } = await import('@/lib/action-engine/resolve-tool')
    const result = await resolveTool('org_abc', 'inactive_tool', supabase)

    expect(result).toBeNull()
  })
})

describe('ACTN-11: Fallback message on failure', () => {
  it.todo('POST /api/vapi/tools returns HTTP 200 with fallback_message when GHL executor throws')
  it.todo('POST /api/vapi/tools returns HTTP 200 with "Service unavailable." for unknown assistant ID')
  it.todo('POST /api/vapi/tools never returns HTTP non-200 — catches all errors in outer try/catch')
})

describe('ACTN-12: 500ms response budget', () => {
  it.todo('action_logs insert happens via after() — not awaited before Response.json() is returned')
  it.todo('GHL fetch uses AbortController with 400ms timeout signal')
})
