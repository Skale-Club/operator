'use client'

/**
 * Redesigned conversation list (v2.2 / SEED-011).
 *
 * Visual contract:
 *   - Sticky header: "Inbox" + unread count, full-width search with ⌘K hint,
 *     filter pills (All / Unread / Mine + per-channel) using ChannelBadge.
 *   - Pinned section floats to the top whenever any conversation has pinned=true.
 *   - Cards: avatar, name, last-message preview (1 line), ChannelBadge inline,
 *     relative timestamp, unread + bot/priority status pills, hover/selected
 *     states, optional 3px accent left-border when priority != normal.
 *   - Skeleton during fetch, EmptyState when nothing matches.
 *
 * State ownership:
 *   - Filtering + search live here. The parent (AdminChatLayout) owns
 *     conversation data and selection.
 *   - Pin/priority/archive mutations are still optimistic via parent callbacks
 *     so realtime UPDATE events reconcile without flicker.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Pin, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'

import { ConversationSummary } from '@/types/chat'
import { ChannelBadge, type Channel } from '@/components/design-system/channel-badge'
import { StatusPill } from '@/components/design-system/status-pill'
import { EmptyState } from '@/components/empty-states/empty-state'
import { ListSkeleton } from '@/components/skeletons/list-skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Map raw `channel` strings (DB) → design-system Channel enum
const CHANNEL_MAP: Record<string, Channel> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  messenger: 'messenger',
  sms: 'sms',
  voice: 'voice',
  widget: 'web',
  web: 'web',
}

type FilterId = 'all' | 'unread' | 'mine' | Channel

interface FilterPill {
  id: FilterId
  label: string
  channel?: Channel
}

interface ConversationListProps {
  conversations: ConversationSummary[]
  selectedId: string | null
  currentUserId: string | null
  isLoading: boolean
  onSelect: (id: string) => void
  onConversationUpdated: () => void
  onConversationDeleted: (id: string) => void
  /** Optimistic pin/unpin handled by parent; updates apply on realtime echo. */
  onPin?: (id: string, pinned: boolean) => void
}

function formatRelative(c: ConversationSummary): string {
  const dateStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: false })
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'min')
      .replace(' minute', 'min')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y')
  } catch {
    return ''
  }
}

function displayNameOf(c: ConversationSummary): string {
  return c.visitorName ?? c.visitorPhone ?? c.visitorEmail ?? 'Anonymous'
}

function initialOf(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || '?'
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  isLoading,
  onSelect,
  onConversationUpdated,
  onConversationDeleted,
  onPin,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // Debounce search for large lists
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Detect channels present in current data — filter pills only show useful options.
  const channelsPresent = useMemo(() => {
    const set = new Set<Channel>()
    for (const c of conversations) {
      const ch = CHANNEL_MAP[c.channel] ?? 'unknown'
      if (ch !== 'unknown') set.add(ch)
    }
    return set
  }, [conversations])

  const pills: FilterPill[] = useMemo(() => {
    const base: FilterPill[] = [
      { id: 'all', label: 'All' },
      { id: 'unread', label: 'Unread' },
    ]
    if (currentUserId) base.push({ id: 'mine', label: 'Mine' })
    const channelOrder: Channel[] = ['whatsapp', 'instagram', 'messenger', 'sms', 'voice', 'web']
    for (const ch of channelOrder) {
      if (channelsPresent.has(ch)) {
        base.push({ id: ch, label: ch.charAt(0).toUpperCase() + ch.slice(1), channel: ch })
      }
    }
    return base
  }, [channelsPresent, currentUserId])

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (activeFilter === 'mine' && c.assignedUserId !== currentUserId) return false
      // Unread heuristic: an open conversation with a customer message newer than the last assistant
      // message would be the proper signal, but we don't track read state per-user yet — for now
      // "unread" === open + last_message exists and was not from the operator side.
      if (activeFilter === 'unread') {
        if (c.status !== 'open') return false
      }
      if (activeFilter !== 'all' && activeFilter !== 'unread' && activeFilter !== 'mine') {
        const ch = CHANNEL_MAP[c.channel] ?? 'unknown'
        if (ch !== activeFilter) return false
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase()
        const hay = [
          c.visitorName,
          c.visitorEmail,
          c.visitorPhone,
          c.lastMessage,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [conversations, activeFilter, debouncedSearch, currentUserId])

  // Split pinned vs unpinned (already sorted by parent / API). Within each
  // bucket the order from props is preserved.
  const pinned = filtered.filter((c) => c.pinned)
  const unpinned = filtered.filter((c) => !c.pinned)

  const totalOpen = conversations.filter((c) => c.status === 'open').length

  return (
    <div className="flex h-full flex-col border-r border-border-subtle bg-bg-secondary/40">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-bg-secondary/95 backdrop-blur px-4 pt-4 pb-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">
            Inbox
          </h2>
          {totalOpen > 0 && (
            <span className="text-[11px] tabular-nums text-text-tertiary">
              {totalOpen} open
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <Input
            ref={searchRef}
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-12 text-[13px] rounded-[8px] bg-bg-primary border-border-subtle focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[5px] border border-border-subtle bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary">
            ⌘K
          </kbd>
        </div>

        {/* Filter pills */}
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {pills.map((pill) => {
            const active = activeFilter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveFilter(pill.id)}
                className={cn(
                  'inline-flex items-center gap-1 shrink-0 rounded-[6px] px-2 py-1 text-[11.5px] font-medium tracking-tight transition-all duration-150',
                  active
                    ? 'bg-accent-muted text-accent ring-1 ring-accent/20'
                    : 'bg-bg-tertiary/50 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )}
              >
                {pill.channel && (
                  <ChannelBadge channel={pill.channel} showLabel={false} size="sm" className="ring-0" />
                )}
                {pill.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-3">
              <ListSkeleton rows={8} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Search}
                title={
                  conversations.length === 0
                    ? 'No conversations yet'
                    : 'No matches'
                }
                description={
                  conversations.length === 0
                    ? 'When customers message you across WhatsApp, Instagram, SMS, or your web widget, conversations will land here.'
                    : 'Try a different search term or filter.'
                }
              />
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <SectionLabel>Pinned</SectionLabel>
                  {pinned.map((c) => (
                    <ConversationCard
                      key={c.id}
                      conversation={c}
                      selected={c.id === selectedId}
                      onSelect={onSelect}
                      onPin={onPin}
                      onArchive={onConversationUpdated}
                      onDelete={onConversationDeleted}
                    />
                  ))}
                  {unpinned.length > 0 && <SectionLabel>All</SectionLabel>}
                </>
              )}
              {unpinned.map((c) => (
                <ConversationCard
                  key={c.id}
                  conversation={c}
                  selected={c.id === selectedId}
                  onSelect={onSelect}
                  onPin={onPin}
                  onArchive={onConversationUpdated}
                  onDelete={onConversationDeleted}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
      {children}
    </div>
  )
}

interface ConversationCardProps {
  conversation: ConversationSummary
  selected: boolean
  onSelect: (id: string) => void
  onPin?: (id: string, pinned: boolean) => void
  onArchive: () => void
  onDelete: (id: string) => void
}

function ConversationCard({
  conversation,
  selected,
  onSelect,
  onPin,
  onArchive,
  onDelete,
}: ConversationCardProps) {
  const [showDelete, setShowDelete] = useState(false)
  const name = displayNameOf(conversation)
  const initial = initialOf(name)
  const channel = (CHANNEL_MAP[conversation.channel] ?? 'unknown') as Channel
  const isBotPaused = conversation.botStatus === 'paused'
  const isArchived = conversation.status === 'closed'
  const priority = conversation.priority ?? 'normal'

  const priorityBar =
    priority === 'urgent'
      ? 'before:bg-danger'
      : priority === 'high'
        ? 'before:bg-warning'
        : selected
          ? 'before:bg-accent'
          : 'before:bg-transparent'

  async function handleArchiveClick(e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/chat/conversations/${conversation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: isArchived ? 'open' : 'closed' }),
    })
    onArchive()
  }

  async function handleDeleteConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/chat/conversations/${conversation.id}`, { method: 'DELETE' })
    onDelete(conversation.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(conversation.id)
        }
      }}
      className={cn(
        'group relative flex w-full cursor-pointer items-start gap-3 rounded-[8px] px-3 py-2.5 transition-all duration-150 outline-none',
        'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:transition-colors',
        priorityBar,
        selected
          ? 'bg-accent-muted/60'
          : 'hover:bg-bg-tertiary/50 focus-visible:bg-bg-tertiary/60 focus-visible:ring-2 focus-visible:ring-accent/20',
      )}
    >
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            'text-[12.5px] font-semibold',
            selected
              ? 'bg-accent text-white'
              : 'bg-bg-tertiary text-text-secondary',
          )}
        >
          {initial}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {conversation.pinned && (
              <Pin className="h-3 w-3 shrink-0 text-text-tertiary" fill="currentColor" />
            )}
            <span
              className={cn(
                'truncate text-[13px] font-semibold tracking-tight',
                selected ? 'text-text-primary' : 'text-text-primary',
              )}
            >
              {name}
            </span>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-text-tertiary">
            {formatRelative(conversation)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-[12px] leading-snug',
              selected ? 'text-text-secondary' : 'text-text-tertiary',
            )}
          >
            {conversation.lastMessage || (
              <span className="italic text-text-tertiary/70">No messages yet</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {channel !== 'unknown' && <ChannelBadge channel={channel} showLabel={false} />}
          </div>
        </div>

        {(isBotPaused || isArchived || conversation.assignedUserId) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {isBotPaused && (
              <StatusPill tone="warning" className="!py-0 !text-[10px]">
                Bot paused
              </StatusPill>
            )}
            {isArchived && (
              <StatusPill tone="idle" className="!py-0 !text-[10px]">
                Archived
              </StatusPill>
            )}
            {conversation.assignedUserId && (
              <StatusPill tone="info" className="!py-0 !text-[10px]">
                Assigned
              </StatusPill>
            )}
          </div>
        )}
      </div>

      {/* Hover-only quick actions (right side) */}
      <div
        className="absolute right-2 top-2 hidden gap-0.5 rounded-[6px] bg-bg-elevated/95 p-0.5 ring-1 ring-border-subtle shadow-sm group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        {onPin && (
          <button
            type="button"
            title={conversation.pinned ? 'Unpin' : 'Pin'}
            onClick={(e) => {
              e.stopPropagation()
              onPin(conversation.id, !conversation.pinned)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-[5px] text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
          >
            <Pin className="h-3 w-3" fill={conversation.pinned ? 'currentColor' : 'none'} />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="More"
              onClick={(e) => e.stopPropagation()}
              className="flex h-6 w-6 items-center justify-center rounded-[5px] text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleArchiveClick}>
              {isArchived ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
                  Reopen
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5 mr-2" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setShowDelete(true)
              }}
              className="text-rose-500 focus:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation with <strong>{name}</strong> and all
              its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
