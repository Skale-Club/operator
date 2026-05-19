'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteConversation } from '../_actions/conversations'

export function DeleteConversationButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this conversation?')) return
        start(async () => {
          await deleteConversation(id)
          router.refresh()
        })
      }}
      className="rounded p-2 text-text-tertiary hover:bg-bg-tertiary hover:text-red-500 disabled:opacity-50"
      title="Delete conversation"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
