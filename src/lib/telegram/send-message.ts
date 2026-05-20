// src/lib/telegram/send-message.ts
// Outbound reply path for the Telegram automation bot. Looks up the active
// bot row for the org, decrypts the token, chunks the text with
// formatTelegram() (4096-char limit), sends each chunk, and optionally
// persists each as a conversation_messages row (role='assistant').
// SEED-034.

import { createServiceRoleClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'
import { formatTelegram } from '@/lib/agent-runtime/adapters'
import { sendTelegramMessage } from './client'

export interface SendTelegramReplyParams {
  orgId: string
  chatId: string
  text: string
  conversationId?: string
}

export interface SendTelegramReplyResult {
  ok: boolean
  messageIds: number[]
  error?: string
}

export async function sendTelegramReply(
  params: SendTelegramReplyParams,
): Promise<SendTelegramReplyResult> {
  const { orgId, chatId, text, conversationId } = params

  if (!text.trim()) {
    return { ok: false, messageIds: [], error: 'empty text' }
  }

  const supabase = createServiceRoleClient()

  const { data: bot, error: botErr } = await supabase
    .from('telegram_bots')
    .select('bot_token_encrypted')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (botErr || !bot) {
    return { ok: false, messageIds: [], error: 'no active telegram bot' }
  }

  let botToken: string
  try {
    botToken = await decrypt(bot.bot_token_encrypted)
  } catch {
    return { ok: false, messageIds: [], error: 'failed to decrypt bot token' }
  }

  const chunks = formatTelegram(text).map((c) => c.text).filter((t) => t.trim().length > 0)
  if (chunks.length === 0) {
    return { ok: false, messageIds: [], error: 'no chunks to send' }
  }

  const messageIds: number[] = []
  for (const chunk of chunks) {
    const res = await sendTelegramMessage({ botToken, chatId, text: chunk })
    if (!res.ok || res.messageId === undefined) {
      return {
        ok: false,
        messageIds,
        error: res.error ?? 'sendMessage failed',
      }
    }
    messageIds.push(res.messageId)

    if (conversationId) {
      const insertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        org_id: orgId,
        role: 'assistant',
        content: chunk,
        message_type: 'text',
        metadata: {
          channel: 'telegram',
          telegram_message_id: res.messageId,
          telegram_chat_id: chatId,
        },
      }
      await supabase
        .from('conversation_messages')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(insertPayload as any)
    }
  }

  if (conversationId) {
    const lastChunk = chunks[chunks.length - 1] ?? ''
    const now = new Date().toISOString()
    await supabase
      .from('conversations')
      .update({
        last_message: lastChunk,
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', conversationId)
  }

  return { ok: true, messageIds }
}
