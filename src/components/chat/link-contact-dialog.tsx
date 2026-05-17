'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, User } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  linkContactToConversation,
  searchContactsForLink,
} from '@/app/(dashboard)/chat/actions'

interface ContactHit {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  company: string | null
}

interface LinkContactDialogProps {
  conversationId: string | null
  trigger: React.ReactNode
  onLinked?: () => void
}

/**
 * Modal that lets the operator search for an existing contact and link it
 * to the current conversation. Pair with NewContactDialog for the two
 * paths: "this person is already in my CRM" vs "create a new contact".
 */
export function LinkContactDialog({
  conversationId,
  trigger,
  onLinked,
}: LinkContactDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [results, setResults] = React.useState<ContactHit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [linkingId, setLinkingId] = React.useState<string | null>(null)
  const router = useRouter()

  // Debounce the query so typing fires at most one request every 250ms.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // Fetch results when dialog opens or query changes.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    searchContactsForLink(debounced).then((data) => {
      if (cancelled) return
      setResults(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, debounced])

  const reset = () => {
    setQuery('')
    setResults([])
    setLinkingId(null)
  }

  async function handleLink(contactId: string) {
    if (!conversationId) {
      toast.error('No conversation selected')
      return
    }
    setLinkingId(contactId)
    const res = await linkContactToConversation(conversationId, contactId)
    setLinkingId(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Contact linked to conversation')
    setOpen(false)
    reset()
    onLinked?.()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Link existing contact</DialogTitle>
          <DialogDescription>
            Search your CRM and pick a contact to associate with this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            autoFocus
            placeholder="Search by name, phone, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1">
          {loading && (
            <div className="flex items-center justify-center py-8 text-[12.5px] text-text-tertiary">
              Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <User className="h-6 w-6 text-text-tertiary" />
              <p className="text-[13px] text-text-secondary">
                {query.trim() ? 'No contacts match this query' : 'No contacts yet'}
              </p>
            </div>
          )}
          {!loading &&
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={linkingId !== null}
                onClick={() => handleLink(c.id)}
                className="flex items-center gap-3 rounded-[8px] border border-border-subtle bg-bg-tertiary/30 px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-bg-tertiary disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[12px] font-semibold text-accent">
                  {(c.name || c.email || c.phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-text-primary">
                    {c.name || 'Unnamed contact'}
                  </div>
                  <div className="truncate text-[11.5px] text-text-tertiary">
                    {[c.phone, c.email, c.company].filter(Boolean).join(' · ') || 'No contact info'}
                  </div>
                </div>
                {linkingId === c.id && (
                  <span className="text-[11px] text-text-tertiary">Linking…</span>
                )}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
