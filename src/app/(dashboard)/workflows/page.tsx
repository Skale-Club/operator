// SEED-025 Phase E: unified workflows page. No more tabs separating
// "Action Tools" and "Visual Flows" — everything is a Workflow with a
// kind/trigger badge, surfaced in one list.

import Link from 'next/link'
import { Workflow, Plus, ScrollText, Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { listUnifiedWorkflows } from '@/lib/workflows/list'
import { WorkflowsList } from '@/components/workflows/workflows-list'

export default async function WorkflowsPage() {
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const workflows = orgId
    ? await listUnifiedWorkflows(orgId as string, supabase)
    : []

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Build"
        eyebrowIcon={Workflow}
        title="Workflows"
        description="Tools and flows in one place. Triggered by events, schedules, agents, or webhooks."
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {workflows.length === 0
            ? 'No workflows yet.'
            : `${workflows.length} workflow${workflows.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/copilot/conversations">
              <Sparkles className="h-3.5 w-3.5" /> Build with Copilot
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/workflows/logs">
              <ScrollText className="h-3.5 w-3.5" /> Logs
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/workflows/flows/new">
              <Plus className="h-3.5 w-3.5" /> New workflow
            </Link>
          </Button>
        </div>
      </div>

      <WorkflowsList workflows={workflows} />
    </PageContainer>
  )
}
