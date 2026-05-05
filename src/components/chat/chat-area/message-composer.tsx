'use client'

import { useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface MessageComposerProps {
  onSendMessage: (content: string) => Promise<void>
  disabled?: boolean
}

/**
 * Message input form. Owns its own input state, submit handler, and
 * Enter-to-send / Shift+Enter-for-newline keyboard behavior.
 */
export function MessageComposer({ onSendMessage, disabled }: MessageComposerProps) {
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)

  async function handleSend() {
    const content = messageText.trim()
    if (!content || isSending) return
    setMessageText('')
    setIsSending(true)
    try {
      await onSendMessage(content)
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isDisabled = isSending || disabled

  return (
    <div className="px-4 py-4 md:px-6 md:py-5 border-t bg-background/95 backdrop-blur shrink-0 supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex items-end gap-3 max-w-4xl mx-auto w-full z-20 pointer-events-auto">
        <Textarea
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className="flex-1 resize-none min-h-[52px] max-h-[200px] text-[15px] p-3.5 pr-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all pointer-events-auto shadow-inner"
          rows={1}
        />
        <Button
          size="icon"
          className={`absolute right-2 bottom-1.5 h-10 w-10 rounded-xl pointer-events-auto transition-all ${
            !messageText.trim() || isDisabled
              ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-md hover:shadow-lg'
          }`}
          onClick={(e) => {
            e.preventDefault()
            handleSend()
          }}
          disabled={!messageText.trim() || isDisabled}
        >
          <Send className="h-5 w-5 ml-0.5" />
        </Button>
      </div>
    </div>
  )
}
