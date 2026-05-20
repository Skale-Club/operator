'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ActivityEventItem } from './activity-event-item'
import type { PlatformEvent, ActivityEventType } from '@/app/(admin)/admin/_actions/get-platform-activity'

const FILTER_OPTIONS: { type: ActivityEventType | 'all'; label: string }[] = [
  { type: 'all',                 label: 'All' },
  { type: 'org_created',         label: 'Orgs' },
  { type: 'member_joined',       label: 'Members' },
  { type: 'call_completed',      label: 'Calls' },
  { type: 'conversation_started',label: 'Conversations' },
  { type: 'workflow_run',        label: 'Workflows' },
  { type: 'contact_created',     label: 'Contacts' },
  { type: 'campaign_started',    label: 'Campaigns' },
  { type: 'booking_created',     label: 'Bookings' },
]

export function ActivityFeed({ events }: { events: PlatformEvent[] }) {
  const [filter, setFilter] = useState<ActivityEventType | 'all'>('all')

  const visible = filter === 'all' ? events : events.filter(e => e.type === filter)

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Activity Feed</p>
          <span className="text-xs text-text-tertiary">{visible.length} events</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => setFilter(opt.type)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors duration-100 ${
                filter === opt.type
                  ? 'bg-accent text-white border-accent'
                  : 'bg-transparent border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-0">
        {visible.length === 0 ? (
          <p className="text-sm text-text-secondary p-4">No events match the selected filter.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {visible.map(e => <ActivityEventItem key={e.id} event={e} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
