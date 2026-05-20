import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { TopOrg } from '@/app/(admin)/admin/_actions/get-platform-dashboard'

export function TopOrgsWidget({ orgs }: { orgs: TopOrg[] }) {
  const max = orgs[0]?.activity_score ?? 1

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <p className="text-sm font-semibold text-text-primary">Top 5 by Activity</p>
        <p className="text-xs text-text-tertiary">Calls + conversations total</p>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-4 space-y-3">
        {orgs.length === 0 ? (
          <p className="text-sm text-text-secondary">No activity data yet.</p>
        ) : (
          orgs.map((org, i) => (
            <div key={org.id}>
              <div className="flex items-center justify-between mb-1">
                <Link href={`/admin/orgs/${org.id}`} className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate flex-1">
                  <span className="text-text-tertiary mr-2 tabular-nums">{i + 1}.</span>
                  {org.name}
                </Link>
                <span className="text-xs text-text-secondary tabular-nums ml-3 shrink-0">{org.activity_score.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${max > 0 ? Math.round((org.activity_score / max) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
