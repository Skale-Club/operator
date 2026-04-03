import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics } from './calls/actions'
import { DashboardMetrics } from '@/components/calls/dashboard-metrics'
import { VapiSetupBanner } from '@/components/dashboard/vapi-setup-banner'

async function hasVapiIntegration(): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('integrations')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'vapi')
    .eq('is_active', true)
  return (count ?? 0) > 0
}

export default async function DashboardPage() {
  const [hasVapi, metrics] = await Promise.all([
    hasVapiIntegration(),
    getDashboardMetrics(),
  ])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      {!hasVapi && <VapiSetupBanner />}
      <DashboardMetrics metrics={metrics} />
    </div>
  )
}
