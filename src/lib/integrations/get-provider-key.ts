// src/lib/integrations/get-provider-key.ts
// Fetches and decrypts the API key for a given provider from an org's integrations.
// Returns null if no active integration found for that provider.

import { decrypt } from '@/lib/crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type IntegrationProvider = Database['public']['Enums']['integration_provider']

export async function getProviderKey(
  provider: IntegrationProvider,
  organizationId: string,
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data } = await supabase
    .from('integrations')
    .select('encrypted_api_key')
    .eq('organization_id', organizationId)
    .eq('provider', provider)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!data) return null
  try {
    return await decrypt(data.encrypted_api_key)
  } catch {
    return null
  }
}
