import { Megaphone } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function CampaignPulseWidget({ activeCampaigns }: { activeCampaigns: number }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">Active Campaigns</p>
        </div>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-4">
        <p className="text-2xl font-semibold text-text-primary tabular-nums">{activeCampaigns}</p>
        <p className="text-xs text-text-tertiary mt-1">
          {activeCampaigns === 0 ? 'No campaigns currently running' : `${activeCampaigns} campaign${activeCampaigns !== 1 ? 's' : ''} running`}
        </p>
      </CardContent>
    </Card>
  )
}
