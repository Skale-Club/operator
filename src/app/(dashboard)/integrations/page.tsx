// SEED-042 — Unified Integrations page.
// Single grouped list rendered from INTEGRATION_REGISTRY. Per-integration
// configuration lives in a side Sheet (see IntegrationList → IntegrationSheet).

import { Plug } from 'lucide-react'

import { getIntegrationsForDisplay } from './actions'
import { IntegrationList } from '@/components/integrations/integration-list'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import type { SavedIntegration } from '@/lib/integrations/registry'

interface PageProps {
  searchParams: Promise<{ open?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const [integrations, sp] = await Promise.all([
    getIntegrationsForDisplay(),
    searchParams,
  ])

  // Index by provider so the list can match registry entries to saved rows
  // in O(1). WhatsApp lives outside the integrations table (its own
  // whatsapp_providers store); the WhatsApp panel reads that itself.
  const saved: Record<string, SavedIntegration> = {}
  for (const row of integrations) {
    saved[row.provider] = {
      id: row.id,
      provider: row.provider,
      name: row.name,
      masked_api_key: row.masked_api_key,
      location_id: row.location_id,
      config: row.config,
      is_active: row.is_active,
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Connections"
        eyebrowIcon={Plug}
        title="Integrations"
        description="Wire Xphere into the rest of your stack — messaging, voice, CRM, scheduling and AI providers."
      />

      <IntegrationList saved={saved} initialOpen={sp.open} />
    </PageContainer>
  )
}
