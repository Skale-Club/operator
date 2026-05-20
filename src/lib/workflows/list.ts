// SEED-025 Phase E: unified workflow list query.
//
// During the SEED-025 transition there are two data sources:
//   - workflows + workflow_versions (new, post-migration 082 backfill)
//   - tool_configs (legacy, still authoritative until Phase F cutover)
//
// This function reads from BOTH and dedups by legacy_tool_config_id so the
// UI shows a single list regardless of which source a workflow lives in.
// Once Phase F removes tool_configs, the legacy half becomes a no-op.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface UnifiedWorkflow {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  kind: 'tool' | 'flow'
  trigger_type: 'tool_call' | 'event' | 'schedule' | 'manual' | 'webhook_url'
  trigger_config: Record<string, unknown>
  health_blocked: boolean
  health_blocked_reason: string | null
  updated_at: string
  folder_id: string | null
  position: number
  archived_at: string | null
}

export interface ListWorkflowsOptions {
  includeArchived?: boolean
}

export async function listUnifiedWorkflows(
  orgId: string,
  supabase: SupabaseClient<Database>,
  options: ListWorkflowsOptions = {},
): Promise<UnifiedWorkflow[]> {
  let query = supabase
    .from('workflows')
    .select(
      'id, name, slug, description, is_active, kind, trigger_type, trigger_config, health_blocked, health_blocked_reason, updated_at, legacy_tool_config_id, folder_id, position, archived_at, deleted_at',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false })

  if (!options.includeArchived) {
    query = query.is('archived_at', null)
  }

  const { data: rows, error } = await query

  if (error || !rows) return []

  const seenLegacyIds = new Set<string>()
  for (const r of rows) {
    const legacy = (r as { legacy_tool_config_id: string | null }).legacy_tool_config_id
    if (legacy) seenLegacyIds.add(legacy)
  }

  // Fallback: surface any tool_configs that haven't been backfilled yet
  // (defensive; the migration is idempotent so this is normally empty).
  const { data: legacyToolConfigs } = await supabase
    .from('tool_configs')
    .select('id, tool_name, action_type, fallback_message, is_active, created_at, updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })

  const unbackfilled = (legacyToolConfigs ?? []).filter(
    (tc) => !seenLegacyIds.has(tc.id as string),
  )

  const fromWorkflows: UnifiedWorkflow[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: r.description as string | null,
    is_active: r.is_active as boolean,
    kind: r.kind as 'tool' | 'flow',
    trigger_type: r.trigger_type as UnifiedWorkflow['trigger_type'],
    trigger_config: (r.trigger_config ?? {}) as Record<string, unknown>,
    health_blocked: r.health_blocked as boolean,
    health_blocked_reason: r.health_blocked_reason as string | null,
    updated_at: r.updated_at as string,
    folder_id: (r as { folder_id: string | null }).folder_id ?? null,
    position: (r as { position: number }).position ?? 0,
    archived_at: (r as { archived_at: string | null }).archived_at ?? null,
  }))

  const fromLegacy: UnifiedWorkflow[] = unbackfilled.map((tc) => ({
    id: tc.id as string,
    name: tc.tool_name as string,
    slug: (tc.tool_name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: `Legacy tool (${tc.action_type as string}) — run \`npx supabase db push\` to migrate.`,
    is_active: tc.is_active as boolean,
    kind: 'tool',
    trigger_type: 'tool_call',
    trigger_config: { tool_name: tc.tool_name as string },
    health_blocked: false,
    health_blocked_reason: null,
    updated_at: (tc.updated_at as string) ?? (tc.created_at as string),
    folder_id: null,
    position: 0,
    archived_at: null,
  }))

  return [...fromWorkflows, ...fromLegacy].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )
}
