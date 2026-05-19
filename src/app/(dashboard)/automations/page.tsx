import Link from 'next/link'
import { Wrench, Workflow, ArrowRight } from 'lucide-react'

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

      <Link
        href="/automations/flows"
        className="group flex items-center gap-3 rounded-lg border border-dashed border-border bg-card hover:bg-muted/30 hover:border-border/80 transition-colors px-4 py-3 mb-6"
      >
        <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
          <Workflow className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Visual flows <span className="text-[10px] text-muted-foreground ml-1">· new</span></p>
          <p className="text-xs text-muted-foreground">Multi-step workflows with branching, waits, and AI-built canvas.</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>

      <ToolsTable toolConfigs={toolConfigs} integrations={integrations} folders={folders} />
    </PageContainer>
  )
}
