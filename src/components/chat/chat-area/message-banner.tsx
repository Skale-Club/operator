'use client'

import { ConversationSummary } from '@/types/chat'

interface MessageBannerProps {
  conversation: ConversationSummary
}

/**
 * 24h Meta reply window warning banner.
 * Renders when the channel is non-widget and channel_metadata.window_expired === 'true'
 * (string comparison — preserved exactly from chat-area.tsx).
 */
export function MessageBanner({ conversation }: MessageBannerProps) {
  if (
    conversation.channel === 'widget' ||
    conversation.channelMetadata?.window_expired !== 'true'
  ) {
    return null
  }

  return (
    <div className="shrink-0 mx-4 mb-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-300 flex items-start gap-2.5">
      <span className="text-base leading-none mt-0.5" aria-hidden="true">⚠</span>
      <p className="text-xs leading-relaxed font-medium">
        The 24-hour Meta messaging window has expired. Automated replies are paused.
      </p>
    </div>
  )
}
