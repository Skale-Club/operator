import { Wrench } from 'lucide-react'

import { getToolConfigs, getFolders } from './actions'
import { getIntegrations } from '@/app/(dashboard)/integrations/actions'
import { ToolsTable } from '@/components/tools/tools-table'
import { PageContainer, PageHeader } from '@/components/layout/page-header'

export default async function ToolsPage() {
  const [toolConfigs, integrations, folders] = await Promise.all([
    getToolConfigs(),
    getIntegrations(),
    getFolders(),
  ])

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Action engine"
        eyebrowIcon={Wrench}
        title="Automations"
        description="Map LLM-callable tool names to platform actions and integrations. Wired once here, automations fire from voice calls (Vapi), the chat widget, multi-channel agents (WhatsApp, Instagram, Messenger), and inbound webhooks (ManyChat, GHL)."
      />
      <ToolsTable toolConfigs={toolConfigs} integrations={integrations} folders={folders} />
    </PageContainer>
  )
}
