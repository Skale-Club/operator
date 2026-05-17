'use client'

/**
 * Redesigned 3-column chat inbox (v2.2 / SEED-011).
 *
 *   ┌──────────────┬─────────────────────────┬──────────────┐
 *   │  Conv. list  │  Chat area (messages)   │  Contact info│
 *   │   320px      │  1fr                    │  360px       │
 *   └──────────────┴─────────────────────────┴──────────────┘
 *
 * Responsibilities owned here:
 *   - Fetch + cache conversations (REST) and messages (REST + realtime)
 *   - Realtime subscriptions for INSERT/UPDATE on conversations + messages
 *   - Typing indicator via Supabase Realtime broadcast (no DB writes)
 *   - Pin / priority / assign / bot-toggle mutations (optimistic)
 *   - Mobile drawer behaviour (list / chat / info, one column visible at a time)
 *
 * The left/middle/right column components are presentational and receive
 * pre-computed state. Realtime UPDATE events from Supabase reconcile any
 * optimistic state with the canonical DB.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import {
  ConversationSummary,
  ConversationMessage,
  ConversationPriority,
} from '@/types/chat'
import {
  toggleBotStatus,
  pinConversation,
  setConversationPriority,
  assignConversation,
  listOrgMembers,
  type OrgMember,
} from '@/app/(dashboard)/chat/actions'
import { createClient } from '@/lib/supabase/client'
import { ConversationList } from '@/components/chat/conversation-list'
import { ChatArea } from '@/components/chat/chat-area'
import { ContactInfoPanel } from '@/components/chat/contact-info-panel'
import { cn } from '@/lib/utils'

function mapConversationRow(row: Record<string, unknown>): ConversationSummary {
  const meta = (row.channel_metadata as Record<string, string>) ?? {}
  const pageId = meta?.page_id ?? null
  return {
    id: row.id as string,
    status: (row.status as string) ?? 'open',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    visitorName: (row.visitor_name as string | null) ?? null,
    visitorEmail: (row.visitor_email as string | null) ?? null,
    visitorPhone: (row.visitor_phone as string | null) ?? null,
    lastMessage: (row.last_message as string | null) ?? null,
    channel: (row.channel as string) ?? 'widget',
    channelMetadata: meta,
    botStatus: (row.bot_status as string) ?? 'active',
    channelAccountName: pageId,
    pinned: Boolean(row.pinned),
    priority: ((row.priority as string) ?? 'normal') as ConversationPriority,
    contactId: (row.contact_id as string | null) ?? null,
    assignedUserId: (row.assigned_user_id as string | null) ?? null,
  }
}

function mapMessageRow(row: Record<string, unknown>): ConversationMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }
}

interface ChatLayoutProps {
  currentOrgId: string | null
  currentUserId: string | null
  agentMap?: Record<string, string>
}

type MobileView = 'list' | 'chat' | 'info'

export function ChatLayout({ currentOrgId, currentUserId, agentMap }: ChatLayoutProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isConvLoading, setIsConvLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const [botTogglingId, setBotTogglingId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [infoOpen, setInfoOpen] = useState(true)
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  // Keep ref in sync (fetchMessages reads it to guard stale responses)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  // ───────────────────────── Data fetching ─────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // Fail silently — realtime will catch up.
    } finally {
      setIsConvLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (id: string) => {
    setIsMessagesLoading(true)
    try {
      const res = await fetch(`/api/chat/conversations/${id}/messages?includeInternal=true`)
      if (!res.ok) return
      const data = await res.json()
      if (selectedIdRef.current === id) {
        setMessages(data.messages ?? [])
      }
    } catch {
      // ignore
    } finally {
      setIsMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    fetchMessages(selectedId)
  }, [selectedId, fetchMessages])

  // Fetch org members once for the assign dropdown
  useEffect(() => {
    listOrgMembers().then(setMembers).catch(() => setMembers([]))
  }, [])

  // ───────────────────────── Realtime: conversations ─────────────────────────

  useEffect(() => {
    if (!currentOrgId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-inbox-conversations-${currentOrgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `org_id=eq.${currentOrgId}` },
        (payload) => {
          const newConv = mapConversationRow(payload.new)
          setConversations((prev) => (prev.some((c) => c.id === newConv.id) ? prev : [newConv, ...prev]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `org_id=eq.${currentOrgId}` },
        (payload) => {
          const updated = mapConversationRow(payload.new)
          setConversations((prev) => {
            const next = prev.map((c) =>
              c.id === updated.id
                ? { ...updated, channelAccountName: c.channelAccountName ?? updated.channelAccountName }
                : c,
            )
            // Pinned first, then by last_message_at desc
            return next.sort((a, b) => {
              const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
              if (pinDiff !== 0) return pinDiff
              return (
                new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
              )
            })
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentOrgId])

  // ───────────────────────── Realtime: messages ─────────────────────────

  useEffect(() => {
    if (!selectedId || !currentOrgId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-inbox-messages-${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const newMsg = mapMessageRow(payload.new)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            const newTime = new Date(newMsg.createdAt).getTime()
            const dupIdx = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.role === newMsg.role &&
                m.content === newMsg.content &&
                Math.abs(new Date(m.createdAt).getTime() - newTime) < 30000,
            )
            if (dupIdx >= 0) {
              const next = [...prev]
              next[dupIdx] = newMsg
              return next
            }
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId, currentOrgId])

  // ───────────────────────── Realtime: typing broadcast ─────────────────────────
  // Broadcast channel per-conversation. Both sides (operator + customer-side
  // adapter) publish a "typing" event on keystroke; we surface it as a dot
  // indicator and auto-clear after 3 seconds of silence.

  useEffect(() => {
    if (!selectedId) {
      setIsTyping(false)
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel(`typing:${selectedId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const fromUser = (payload.payload as { user_id?: string })?.user_id
        if (fromUser && fromUser === currentUserId) return // own echo
        setIsTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
      })
      .subscribe()
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [selectedId, currentUserId])

  // Outbound typing broadcast (debounced inside MessageComposer ~500ms)
  const broadcastTyping = useCallback(() => {
    if (!selectedId) return
    const supabase = createClient()
    const channel = supabase.channel(`typing:${selectedId}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: currentUserId, conversation_id: selectedId, ts: Date.now() },
        })
        // Best-effort cleanup — the receiver auto-times out after 3s.
        setTimeout(() => {
          supabase.removeChannel(channel)
        }, 500)
      }
    })
  }, [selectedId, currentUserId])

  // ───────────────────────── Mutations ─────────────────────────

  async function handleSendMessage(content: string) {
    if (!selectedId) return
    const tempId = `temp-${crypto.randomUUID()}`
    const tempMsg: ConversationMessage = {
      id: tempId,
      conversationId: selectedId,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])
    try {
      const res = await fetch(`/api/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, role: 'assistant' }),
      })
      if (!res.ok) throw new Error('Failed to send')
      await fetchMessages(selectedId)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      toast.error('Failed to send message')
    }
  }

  async function handleStatusChange(status: 'open' | 'closed') {
    if (!selectedId) return
    try {
      await fetch(`/api/chat/conversations/${selectedId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await fetchConversations()
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' })
      setSelectedId(null)
      setMessages([])
      setMobileView('list')
      await fetchConversations()
    } catch {
      // ignore
    }
  }

  async function handleBotToggle(conversationId: string, currentStatus: string) {
    if (botTogglingId) return
    setBotTogglingId(conversationId)
    const optimistic = currentStatus === 'active' ? 'paused' : 'active'
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, botStatus: optimistic } : c)),
    )
    const result = await toggleBotStatus(conversationId, currentStatus)
    if ('error' in result) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, botStatus: currentStatus } : c)),
      )
      toast.error('Failed to update bot status')
    }
    setBotTogglingId(null)
  }

  async function handlePinToggle(id: string, pinned: boolean) {
    // Optimistic
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)))
    const res = await pinConversation(id, pinned)
    if ('error' in res) {
      toast.error('Could not pin conversation')
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !pinned } : c)))
    }
  }

  async function handlePriorityCycle(id: string, next: ConversationPriority) {
    const current = conversations.find((c) => c.id === id)?.priority ?? 'normal'
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, priority: next } : c)))
    const res = await setConversationPriority(id, next)
    if ('error' in res) {
      toast.error('Could not update priority')
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, priority: current } : c)))
    }
  }

  async function handleAssign(id: string, userId: string | null) {
    const previous = conversations.find((c) => c.id === id)?.assignedUserId ?? null
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, assignedUserId: userId } : c)),
    )
    const res = await assignConversation(id, userId)
    if ('error' in res) {
      toast.error('Could not assign conversation')
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, assignedUserId: previous } : c)),
      )
    } else {
      toast.success(userId ? 'Conversation assigned' : 'Conversation unassigned')
    }
  }

  // ───────────────────────── Derived ─────────────────────────

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  // ───────────────────────── Render ─────────────────────────

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      {/* Desktop — 3-column grid */}
      <div
        className={cn(
          'hidden md:grid h-full w-full',
          infoOpen
            ? 'grid-cols-[320px_minmax(0,1fr)_360px]'
            : 'grid-cols-[320px_minmax(0,1fr)]',
        )}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          currentUserId={currentUserId}
          isLoading={isConvLoading}
          onSelect={(id) => setSelectedId(id)}
          onConversationUpdated={fetchConversations}
          onConversationDeleted={(id) => {
            if (selectedId === id) {
              setSelectedId(null)
              setMessages([])
            }
            fetchConversations()
          }}
          onPin={handlePinToggle}
        />
        <ChatArea
          conversation={selected}
          messages={messages}
          isLoading={isMessagesLoading}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          onTyping={broadcastTyping}
          onStatusChange={handleStatusChange}
          onDelete={() => selectedId && handleDelete(selectedId)}
          onBack={() => {}}
          onBotStatusToggle={handleBotToggle}
          isBotToggling={botTogglingId === selectedId}
          onPinToggle={handlePinToggle}
          onPriorityCycle={handlePriorityCycle}
          onAssign={handleAssign}
          members={members}
          infoPanelOpen={infoOpen}
          onToggleInfoPanel={() => setInfoOpen((v) => !v)}
          agentMap={agentMap}
        />
        {infoOpen && (
          <ContactInfoPanel
            contactId={selected?.contactId ?? null}
            fallbackName={selected?.visitorName ?? null}
            fallbackPhone={selected?.visitorPhone ?? null}
            fallbackEmail={selected?.visitorEmail ?? null}
          />
        )}
      </div>

      {/* Mobile — single-column with drawer-style navigation */}
      <div className="md:hidden flex h-full w-full">
        {mobileView === 'list' && (
          <div className="w-full">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              currentUserId={currentUserId}
              isLoading={isConvLoading}
              onSelect={(id) => {
                setSelectedId(id)
                setMobileView('chat')
              }}
              onConversationUpdated={fetchConversations}
              onConversationDeleted={(id) => {
                if (selectedId === id) {
                  setSelectedId(null)
                  setMessages([])
                }
                fetchConversations()
              }}
              onPin={handlePinToggle}
            />
          </div>
        )}
        {mobileView === 'chat' && (
          <div className="w-full">
            <ChatArea
              conversation={selected}
              messages={messages}
              isLoading={isMessagesLoading}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
              onTyping={broadcastTyping}
              onStatusChange={handleStatusChange}
              onDelete={() => selectedId && handleDelete(selectedId)}
              onBack={() => setMobileView('list')}
              onBotStatusToggle={handleBotToggle}
              isBotToggling={botTogglingId === selectedId}
              onPinToggle={handlePinToggle}
              onPriorityCycle={handlePriorityCycle}
              onAssign={handleAssign}
              members={members}
              infoPanelOpen={false}
              onToggleInfoPanel={() => setMobileView('info')}
              agentMap={agentMap}
            />
          </div>
        )}
        {mobileView === 'info' && (
          <div className="w-full">
            <ContactInfoPanel
              contactId={selected?.contactId ?? null}
              fallbackName={selected?.visitorName ?? null}
              fallbackPhone={selected?.visitorPhone ?? null}
              fallbackEmail={selected?.visitorEmail ?? null}
              onClose={() => setMobileView('chat')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
