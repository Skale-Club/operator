import { Zap } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { WorkflowStats } from '@/app/(admin)/admin/_actions/get-platform-dashboard'

export function WorkflowStatsWidget({ stats }: { stats: WorkflowStats }) {
  const successRate = stats.total > 0 ? Math.round((stats.succeeded / stats.total) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">Workflow Runs (7d)</p>
        </div>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-4">
        {stats.total === 0 ? (
          <p className="text-sm text-text-secondary">No workflow runs in the last 7 days.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-2xl font-semibold text-text-primary tabular-nums">{stats.total.toLocaleString()}</p>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-text-secondary">{stats.succeeded} succeeded</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-text-secondary">{stats.failed} failed</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${successRate}%` }} />
            </div>
            <p className="text-xs text-text-tertiary">{successRate}% success rate</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
