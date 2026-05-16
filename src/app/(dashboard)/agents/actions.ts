'use server'

// Server actions for Phase 36 Agent CRUD Dashboard.
// - Plan 03 adds: getAgents, getActiveAgents, getChannelDefaults, setChannelDefault,
//   toggleAgentActive, softDeleteAgent
// - Plan 04 adds: getAgentById, createAgent, updateAgent, setAgentTools, getToolPickerData
//
// All actions use cached `getUser()` + `createClient()` from `@/lib/supabase/server`
// and rely on RLS via `(SELECT public.get_current_org_id())` for tenant scoping.

import { revalidatePath } from 'next/cache'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { AgentChannel } from '@/lib/agents/channels'

type AgentRow = Database['public']['Tables']['agents']['Row']

export interface AgentListItem extends AgentRow {
  tool_count: number
}

/**
 * Returns all org agents (active + inactive) ordered by created_at DESC,
 * each augmented with a `tool_count` derived from the agent_tools junction.
 * RLS auto-scopes to the active org.
 */
export async function getAgents(): Promise<AgentListItem[]> {
  const user = await getUser()
  if (!user) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select('*, agent_tools(count)')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((a) => {
    const { agent_tools: rel, ...rest } = a as AgentRow & {
      agent_tools: { count: number }[]
    }
    return { ...(rest as AgentRow), tool_count: rel?.[0]?.count ?? 0 }
  })
}

/**
 * Returns only is_active=true agents — used by Channel Defaults dropdowns
 * and (future) partner pickers. Inactive agents are excluded per D-36-08.
 */
export async function getActiveAgents(): Promise<
  Pick<AgentRow, 'id' | 'name' | 'slug'>[]
> {
  const user = await getUser()
  if (!user) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('agents')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name', { ascending: true })
  return data ?? []
}

/**
 * Returns the 6 channels with their currently-assigned agent_id.
 * Channels without an explicit default return null (runtime falls back to Main Agent).
 */
export async function getChannelDefaults(): Promise<
  Record<AgentChannel, string | null>
> {
  const empty: Record<AgentChannel, string | null> = {
    web_widget: null,
    whatsapp: null,
    messenger: null,
    instagram: null,
    manychat: null,
    telegram: null,
  }
  const user = await getUser()
  if (!user) return empty
  const supabase = await createClient()
  const { data } = await supabase
    .from('agent_channel_defaults')
    .select('channel, agent_id')
  if (!data) return empty
  const result = { ...empty }
  for (const row of data) {
    result[row.channel as AgentChannel] = row.agent_id
  }
  return result
}

/**
 * UPSERTs `agent_channel_defaults(org_id, channel, agent_id)` when agentId is provided,
 * or DELETEs the row when agentId is null (clears the default; runtime falls back to
 * the seeded Main Agent).
 */
export async function setChannelDefault(
  channel: AgentChannel,
  agentId: string | null
): Promise<{ error?: string } | void> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated.' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return { error: 'No organization found.' }

  if (agentId === null) {
    const { error } = await supabase
      .from('agent_channel_defaults')
      .delete()
      .eq('channel', channel)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('agent_channel_defaults')
      .upsert(
        { organization_id: orgId, channel, agent_id: agentId },
        { onConflict: 'organization_id,channel' }
      )
    if (error) return { error: error.message }
  }
  revalidatePath('/agents')
}

/**
 * Flips agents.is_active. Used by the list-row Switch (optimistic UI in the
 * client; this server action persists the change). Per D-36-08, deactivating
 * an agent automatically excludes it from Channel Defaults dropdowns.
 */
export async function toggleAgentActive(
  id: string,
  active: boolean
): Promise<{ error?: string } | void> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('agents')
    .update({ is_active: active, updated_by: user.id })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/agents')
}

/**
 * Soft-deletes an agent per D-36-07:
 *  1. Refuses if the target IS the Main Agent (orgs always need one).
 *  2. Refuses if no active Main Agent exists (no reassignment target).
 *  3. Reassigns any `agent_channel_defaults` rows pointing at this agent → Main Agent.
 *  4. Sets `is_active=false` on the target.
 *
 * Historical `agent_invocations` rows stay queryable (AGENT-10 requirement).
 */
export async function softDeleteAgent(
  id: string
): Promise<{ error?: string; reassignedCount?: number } | void> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated.' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return { error: 'No organization found.' }

  const { data: mainAgent } = await supabase
    .from('agents')
    .select('id')
    .eq('name', 'Main Agent')
    .eq('is_active', true)
    .maybeSingle()
  if (!mainAgent) {
    return {
      error:
        'Cannot delete: no active Main Agent to reassign channel defaults to.',
    }
  }
  if (mainAgent.id === id) {
    return { error: 'Cannot delete the Main Agent.' }
  }

  const { data: reassigned, error: reassignError } = await supabase
    .from('agent_channel_defaults')
    .update({ agent_id: mainAgent.id })
    .eq('agent_id', id)
    .select('id')
  if (reassignError) return { error: reassignError.message }

  const { error } = await supabase
    .from('agents')
    .update({ is_active: false, updated_by: user.id })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/agents')
  return { reassignedCount: reassigned?.length ?? 0 }
}
