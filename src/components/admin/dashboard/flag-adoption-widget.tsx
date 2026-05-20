import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { FlagAdoption } from '@/app/(admin)/admin/_actions/get-platform-dashboard'

export function FlagAdoptionWidget({ flags }: { flags: FlagAdoption[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <p className="text-sm font-semibold text-text-primary">Feature Adoption</p>
        <p className="text-xs text-text-tertiary">% of orgs with flag enabled</p>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-4 space-y-4">
        {flags.map(f => {
          const pct = f.total > 0 ? Math.round((f.count / f.total) * 100) : 0
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-primary">{f.label}</span>
                <span className="text-xs text-text-secondary tabular-nums">{f.count}/{f.total} ({pct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
