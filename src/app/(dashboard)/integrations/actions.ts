'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto'

// Type returned to UI — encrypted_api_key is NEVER included
export type IntegrationForDisplay = {
  id: string
  organization_id: string
  provider: 'gohighlevel' | 'twilio' | 'calcom' | 'custom_webhook'
  name: string
  masked_api_key: string // ••••••••last4 — never full key
  location_id: string | null
  config: unknown
  is_active: boolean
  created_at: string
}

export async function createIntegration(data: {
  name: string
  provider: string
  apiKey: string
  locationId: string
}): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) return { error: 'No organization found for this user.' }

  const encryptedKey = await encrypt(data.apiKey)

  const { error } = await supabase.from('integrations').insert({
    organization_id: member.organization_id,
    provider: data.provider as 'gohighlevel' | 'twilio' | 'calcom' | 'custom_webhook',
    name: data.name,
    encrypted_api_key: encryptedKey,
    location_id: data.locationId || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/integrations')
}

export async function updateIntegration(
  id: string,
  data: { name: string; locationId: string; apiKey?: string }
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const updateData: Record<string, unknown> = {
    name: data.name,
    location_id: data.locationId || null,
  }

  if (data.apiKey && data.apiKey.trim().length > 0) {
    updateData.encrypted_api_key = await encrypt(data.apiKey)
  }

  const { error } = await supabase.from('integrations').update(updateData).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/integrations')
}

export async function getIntegrations(): Promise<IntegrationForDisplay[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('integrations')
    .select('id, name, provider, encrypted_api_key, location_id, config, is_active, created_at, organization_id')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    provider: row.provider,
    name: row.name,
    masked_api_key: maskApiKey(row.encrypted_api_key),
    location_id: row.location_id,
    config: row.config,
    is_active: row.is_active,
    created_at: row.created_at,
  }))
}

export async function testConnection(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: integration, error: fetchError } = await supabase
    .from('integrations')
    .select('encrypted_api_key, location_id, provider')
    .eq('id', integrationId)
    .single()

  if (fetchError || !integration) return { success: false, error: 'Integration not found.' }

  let apiKey: string
  try {
    apiKey = await decrypt(integration.encrypted_api_key)
  } catch {
    return { success: false, error: 'Failed to decrypt credentials.' }
  }

  const locationId = integration.location_id ?? ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28',
        },
        signal: controller.signal,
      }
    )

    if (response.ok || response.status === 200 || response.status === 201) {
      return { success: true }
    }

    return { success: false, error: `GHL returned status ${response.status}` }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Connection timed out after 5 seconds.' }
    }
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error.' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function deleteIntegration(id: string): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('integrations').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/integrations')
}
