'use client'

import { AlertTriangle } from 'lucide-react'

import { ConversationSummary } from '@/types/chat'

interface MessageBannerProps {
  conversation: ConversationSummary
}

/**
 * 24h Meta reply window warning banner.
 * Renders when the channel is non-widget and channel_metadata.window_expired === 'true'.
 */
export function MessageBanner({ conversation }: MessageBannerProps) {
  if (
    conversation.channel === 'widget' ||
    conversation.channelMetadata?.window_expired !== 'true'
  ) {
    return null
  }

  return (
    <div className="mx-4 mb-2 shrink-0 flex items-start gap-2.5 rounded-[8px] border border-warning/30 bg-[var(--warning-muted)] px-3 py-2.5">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
      <p className="text-[12px] font-medium leading-relaxed text-warning">
        The 24-hour Meta messaging window has expired. Automated replies are paused.
      </p>
    </div>
  )
}
