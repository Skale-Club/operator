import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics } from './calls/actions'
import { DashboardMetrics } from '@/components/calls/dashboard-metrics'
import { VapiSetupBanner } from '@/components/dashboard/vapi-setup-banner'
import { CostTicker } from '@/components/dashboard/cost-ticker'

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
      {/* OBS-05: Per-org agent cost ticker */}
      <Suspense fallback={<div className="h-24 bg-muted/30 rounded-lg animate-pulse" />}>
        <CostTicker />
      </Suspense>
      <DashboardMetrics metrics={metrics} />
    </div>
  )
}
