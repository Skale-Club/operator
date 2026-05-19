'use client'

import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { MessageBubble } from '@/components/copilot/message-bubble'
import { useCopilotStore } from '@/stores/copilot-store'
import type { ConversationMessage } from '../../_actions/conversations'

export function ReplayedMessages({
  conversationId,
  messages,
}: {
  conversationId: string
  messages: ConversationMessage[]
}) {
  const setOpen = useCopilotStore((s) => s.setOpen)
  const setConversationId = useCopilotStore((s) => s.setConversationId)

  function resume() {
    setConversationId(conversationId)
    setOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <Button onClick={resume} size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Resume in panel
        </Button>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-bg-secondary p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={{ id: m.id, role: m.role, parts: m.parts }} />
        ))}
      </div>
    </div>
  )
}
