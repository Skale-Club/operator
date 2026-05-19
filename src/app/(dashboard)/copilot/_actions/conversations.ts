'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getUser } from '@/lib/supabase/server'
import type { MessagePart } from '@/lib/copilot/run-turn'

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

export interface ConversationSummary {
  id: string
  title: string
  started_at: string
  updated_at: string
  message_count: number
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  parts: MessagePart[]
  created_at: string
}

export interface ConversationDetail {
  id: string
  title: string
  started_at: string
  updated_at: string
  messages: ConversationMessage[]
}

export async function createConversation(input: { title?: string } = {}): Promise<ActionResult<{ id: string }>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return { ok: false, error: 'no_active_org' }

  const { data, error } = await supabase
    .from('copilot_conversations')
    .insert({
      org_id: orgId as string,
      title: input.title?.trim() || 'New conversation',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'insert_failed' }
  revalidatePath('/copilot/conversations')
  return { ok: true, data: { id: data.id } }
}

export async function listConversations(): Promise<ActionResult<ConversationSummary[]>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('copilot_conversations')
    .select('id, title, started_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) return { ok: false, error: error.message }

  const ids = (data ?? []).map((c) => c.id)
  let counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from('copilot_messages')
      .select('conversation_id')
      .in('conversation_id', ids)
    for (const r of rows ?? []) {
      counts.set(r.conversation_id, (counts.get(r.conversation_id) ?? 0) + 1)
    }
  }

  return {
    ok: true,
    data: (data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      started_at: c.started_at,
      updated_at: c.updated_at,
      message_count: counts.get(c.id) ?? 0,
    })),
  }
}

export async function getConversation(id: string): Promise<ActionResult<ConversationDetail>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()

  const { data: conv, error: convErr } = await supabase
    .from('copilot_conversations')
    .select('id, title, started_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (convErr) return { ok: false, error: convErr.message }
  if (!conv) return { ok: false, error: 'not_found' }

  const { data: msgs, error: msgErr } = await supabase
    .from('copilot_messages')
    .select('id, role, parts, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
  if (msgErr) return { ok: false, error: msgErr.message }

  return {
    ok: true,
    data: {
      id: conv.id,
      title: conv.title,
      started_at: conv.started_at,
      updated_at: conv.updated_at,
      messages: (msgs ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: (m.parts as unknown as MessagePart[]) ?? [],
        created_at: m.created_at,
      })),
    },
  }
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  const { error } = await supabase.from('copilot_conversations').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/copilot/conversations')
  return { ok: true, data: undefined }
}

export async function renameConversation(id: string, title: string): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  if (!title.trim()) return { ok: false, error: 'title required' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('copilot_conversations')
    .update({ title: title.trim() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/copilot/conversations')
  return { ok: true, data: undefined }
}
