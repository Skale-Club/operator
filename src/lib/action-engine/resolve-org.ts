// src/lib/action-engine/resolve-org.ts
// Resolves Vapi assistantId → organization_id via assistant_mappings table
// Called as first step in the webhook hot path (expect ~10-25ms with index)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function resolveOrg(
  assistantId: string,
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('assistant_mappings')
    .select('organization_id')
    .eq('vapi_assistant_id', assistantId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data.organization_id
}
