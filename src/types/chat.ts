// src/types/chat.ts
// Admin chat inbox TypeScript types.
// These interfaces represent the shape returned by /api/chat/conversations/* endpoints.

export type ConversationPriority = 'normal' | 'high' | 'urgent'

export interface ConversationSummary {
  id: string
  status: string               // 'open' | 'closed'
  createdAt: string
  updatedAt: string
  lastMessageAt?: string | null
  visitorName?: string | null
  visitorEmail?: string | null
  visitorPhone?: string | null
  lastMessage?: string | null
  channel: string                             // 'widget' | 'messenger' | 'instagram' | 'whatsapp' | 'sms'
  channelMetadata: Record<string, string>     // JSON from channel_metadata column
  botStatus: string                           // 'active' | 'paused'
  channelAccountName?: string | null          // page_name from meta_channels (null for widget)
  /** v2.2 — pin to the top of the inbox list. */
  pinned?: boolean
  /** v2.2 — 'normal' | 'high' | 'urgent'. Drives the colored left-border. */
  priority?: ConversationPriority
  /** v2.2 — Optional contact link. Used by the right-side ContactInfoPanel. */
  contactId?: string | null
  /** v2.2 — User the conversation is assigned to (assigned_user_id). */
  assignedUserId?: string | null
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: string                 // 'assistant' | 'visitor' | 'system'
  content: string
  createdAt: string
  metadata?: Record<string, unknown> | null
}
