import { Building2, UserPlus, Phone, MessageSquare, Contact2, Zap, Megaphone, Calendar } from 'lucide-react'
import type { PlatformEvent, ActivityEventType } from '@/app/(admin)/admin/_actions/get-platform-activity'

const EVENT_META: Record<ActivityEventType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  org_created:          { icon: Building2,     color: 'text-amber-500' },
  member_joined:        { icon: UserPlus,      color: 'text-blue-400' },
  call_completed:       { icon: Phone,         color: 'text-emerald-500' },
  conversation_started: { icon: MessageSquare, color: 'text-accent' },
  contact_created:      { icon: Contact2,      color: 'text-purple-400' },
  workflow_run:         { icon: Zap,           color: 'text-yellow-400' },
  campaign_started:     { icon: Megaphone,     color: 'text-orange-400' },
  booking_created:      { icon: Calendar,      color: 'text-teal-400' },
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function ActivityEventItem({ event }: { event: PlatformEvent }) {
  const meta = EVENT_META[event.type]
  const Icon = meta.icon

  return (
    <div className="flex items-start gap-3 py-2.5 px-4 hover:bg-bg-tertiary transition-colors duration-100">
      <div className={`mt-0.5 h-7 w-7 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{event.description}</p>
        {event.org_name && (
          <p className="text-xs text-text-tertiary mt-0.5">{event.org_name}</p>
        )}
      </div>
      <span className="text-xs text-text-tertiary shrink-0 mt-0.5">{relativeTime(event.timestamp)}</span>
    </div>
  )
}
