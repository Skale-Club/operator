// tests/agent-schema-seed.test.ts
// Phase 33 Plan 01 — Wave 1 RED scaffold, FLIPPED GREEN by Plan 07 Wave 4.
// Pins the seed-completeness contract for AGENT-09 + TOOL-01 + GATE-07 prerequisites.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

let admin: SupabaseClient<Database>

beforeAll(() => {
  admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
})

describe('AGENT-09 + TOOL-01 + GATE-07 prerequisites: Main Agent seed', () => {
  it("every organization has exactly one row in agents WHERE name = 'Main Agent'", async () => {
    const { count: orgCount, error: orgErr } = await admin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
    expect(orgErr).toBeNull()

    const { count: agentCount, error: agentErr } = await admin
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('name', 'Main Agent')
    expect(agentErr).toBeNull()

    expect(agentCount).toBe(orgCount)
  })

  it('every Main Agent has agent_tools rows for every active tool_config in its org', async () => {
    const { data: orgs, error: orgsErr } = await admin
      .from('organizations')
      .select('id')
    expect(orgsErr).toBeNull()

    for (const org of orgs ?? []) {
      const { count: toolConfigCount } = await admin
        .from('tool_configs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('is_active', true)

      const { count: agentToolCount } = await admin
        .from('agent_tools')
        .select('*, agents!inner(organization_id, name)', { count: 'exact', head: true })
        .eq('agents.organization_id', org.id)
        .eq('agents.name', 'Main Agent')

      expect(agentToolCount).toBe(toolConfigCount)
    }
  })

  it('every Main Agent has an agent_channel_defaults row for web_widget (D-33-09)', async () => {
    const { data: orgs, error: orgsErr } = await admin
      .from('organizations')
      .select('id')
    expect(orgsErr).toBeNull()

    for (const org of orgs ?? []) {
      const { count } = await admin
        .from('agent_channel_defaults')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('channel', 'web_widget')

      expect(count).toBe(1)
    }
  })

  it('every Main Agent has agents.active_prompt_version_id pointing at agent_prompt_versions.version=1', async () => {
    const { data: agents, error } = await admin
      .from('agents')
      .select('id, active_prompt_version_id')
      .eq('name', 'Main Agent')
    expect(error).toBeNull()

    for (const agent of agents ?? []) {
      expect(agent.active_prompt_version_id).not.toBeNull()

      const { data: version, error: vErr } = await admin
        .from('agent_prompt_versions')
        .select('version')
        .eq('id', agent.active_prompt_version_id!)
        .single()
      expect(vErr).toBeNull()
      expect(version!.version).toBe(1)
    }
  })
})
