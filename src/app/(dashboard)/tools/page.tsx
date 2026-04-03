import { getToolConfigs } from './actions'
import { getIntegrations } from '@/app/(dashboard)/integrations/actions'
import { ToolsTable } from '@/components/tools/tools-table'

export default async function ToolsPage() {
  const [toolConfigs, integrations] = await Promise.all([
    getToolConfigs(),
    getIntegrations(),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Tool Configurations</h1>
        <p className="text-sm text-muted-foreground">
          Map Vapi tool names to GoHighLevel actions.
        </p>
      </div>
      <ToolsTable toolConfigs={toolConfigs} integrations={integrations} />
    </div>
  )
}
