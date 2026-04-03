import { getIntegrations } from './actions'
import { IntegrationsTable } from '@/components/integrations/integrations-table'

export default async function IntegrationsPage() {
  const integrations = await getIntegrations()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Manage GoHighLevel credentials for your organization.
        </p>
      </div>
      <IntegrationsTable integrations={integrations} />
    </div>
  )
}
