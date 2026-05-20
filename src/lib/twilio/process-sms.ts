// src/lib/twilio/process-sms.ts
// Processes a validated inbound Twilio SMS/MMS webhook (SEED-005, extended in SEED-030).
// Called from /api/twilio/sms via after() — runs after 200 TwiML is returned.
//
// Pipeline:
//   1. Upsert conversation by (org_id, channel='sms', visitor_phone=From).
//   2. Download any attached media (Twilio MMS) and store in Supabase Storage.
//   3. Insert conversation_message with message_type + media metadata.
//   4. If bot_status='active' and an agent is configured for channel='sms' via
//      agent_channel_defaults, invoke runAgent({channel:'sms', stream:false}).
//   5. Persist the assistant reply as a conversation_message.
//   6. Send the reply via the existing send_sms executor (Twilio Messages REST API).
//
// All errors are caught locally — this function never throws (after() context).

import { createServiceRoleClient } from '@/lib/supabase/admin'
import { runAgent } from '@/lib/agent-runtime/run-agent'
import { sendSms } from './send-sms'
import { formatOutbound as formatSms } from '@/lib/agent-runtime/adapters/sms'
import { insertNotification } from '@/lib/notifications/insert'
import { downloadAndStoreTwilioMedia } from './media'
import type { MediaAttachment } from '@/types/chat'

export type TwilioSmsPayload = {
  From: string         // sender phone (+E.164)
  To: string           // org's Twilio number (+E.164)
  Body: string
  MessageSid: string
  AccountSid?: string
  NumMedia?: string
  // MMS media fields (up to 10 attachments)
  MediaUrl0?: string
  MediaUrl1?: string
  MediaUrl2?: string
  MediaUrl3?: string
  MediaUrl4?: string
  MediaUrl5?: string
  MediaUrl6?: string
  MediaUrl7?: string
  MediaUrl8?: string
  MediaUrl9?: string
  MediaContentType0?: string
  MediaContentType1?: string
  MediaContentType2?: string
  MediaContentType3?: string
  MediaContentType4?: string
  MediaContentType5?: string
  MediaContentType6?: string
  MediaContentType7?: string
  MediaContentType8?: string
  MediaContentType9?: string
  // Auth fields passed from route handler
  _accountSid?: string
  _authToken?: string
}

/** Format the last_message preview for a media-only or mixed message. */
function formatLastMessage(content: string, media?: MediaAttachment[]): string {
  if (content) return content
  if (!media?.length) return ''
  const first = media[0]
  if (first.mime_type.startsWith('image/')) return '📷 Foto'
  if (first.mime_type.startsWith('audio/')) return '🎵 Áudio'
  if (first.mime_type.startsWith('video/')) return '🎬 Vídeo'
  return `📎 ${first.filename ?? 'Arquivo'}`
}

/** Determine message_type from text and media attachments. */
function determineMessageType(content: string, media: MediaAttachment[]): string {
  if (media.length === 0) return 'text'
  if (content) return 'mixed'
  const first = media[0]
  if (first.mime_type.startsWith('image/')) return 'image'
  if (first.mime_type.startsWith('audio/')) return 'audio'
  if (first.mime_type.startsWith('video/')) return 'video'
  return 'document'
}

export async function processTwilioSms(
  payload: TwilioSmsPayload,
  orgId: string
): Promise<void> {
  const supabase = createServiceRoleClient()

  const messageText = (payload.Body ?? '').trim()
  const numMedia = parseInt(payload.NumMedia ?? '0', 10)

  // Reject messages with neither text nor media
  if (!messageText && numMedia === 0) return

  const fromNumber = payload.From
  const toNumber = payload.To
  const messageSid = payload.MessageSid

  // --- 1. Upsert conversation (de-duplicate by org + channel + From) -----
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, bot_status')
    .eq('org_id', orgId)
    .eq('channel', 'sms')
    .eq('visitor_phone', fromNumber)
    .limit(1)
    .maybeSingle()

  const now = new Date().toISOString()
  let conversationId: string

  // Placeholder last_message — will be updated once we know about media
  const placeholderLastMessage = messageText || '...'

  if (existing) {
    conversationId = existing.id
    await supabase
      .from('conversations')
      .update({
        last_message: placeholderLastMessage,
        last_message_at: now,
        last_inbound_at: now,
        updated_at: now,
      })
      .eq('id', conversationId)
  } else {
    const { data: created, error: insertError } = await supabase
      .from('conversations')
      .insert({
        org_id: orgId,
        widget_token: '',
        channel: 'sms',
        channel_metadata: {
          from_number: fromNumber,
          to_number: toNumber,
          last_message_sid: messageSid,
        },
        visitor_phone: fromNumber,
        last_message: placeholderLastMessage,
        last_message_at: now,
        last_inbound_at: now,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      console.error('[twilio/sms] Failed to create conversation:', insertError?.message)
      return
    }
    conversationId = created.id
    void insertNotification(orgId, 'new_conversation', { conversation_id: conversationId, channel: 'sms' })
  }

  // --- 2. Idempotency check (by message_sid) ---
  const { data: dupCheck } = await supabase
    .from('conversation_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .contains('metadata', { message_sid: messageSid })
    .limit(1)
    .maybeSingle()

  if (dupCheck) {
    console.log('[twilio/sms] Duplicate MessageSid — skipping message insert:', messageSid)
    return
  }

  // --- 3. Generate a message ID now so we can use it in Storage paths ---
  const { data: msgIdRow } = await supabase.rpc('gen_random_uuid' as never)
  const newMsgId: string = (msgIdRow as string | null) ?? crypto.randomUUID()

  // --- 4. Download and store any MMS media attachments ---
  const accountSid = payload._accountSid ?? payload.AccountSid ?? ''
  const authToken = payload._authToken ?? ''

  const mediaItems: MediaAttachment[] = []

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = payload[`MediaUrl${i}` as keyof TwilioSmsPayload] as string | undefined
    const mimeType = payload[`MediaContentType${i}` as keyof TwilioSmsPayload] as string | undefined
    if (!mediaUrl || !mimeType) continue

    if (accountSid && authToken) {
      const stored = await downloadAndStoreTwilioMedia({
        mediaUrl,
        mimeType,
        accountSid,
        authToken,
        orgId,
        conversationId,
        messageId: newMsgId,
        idx: i,
      })
      if (stored) {
        mediaItems.push({
          url: stored.url,
          mime_type: mimeType,
          size: stored.size,
          filename: stored.filename,
        })
      }
    } else {
      // No credentials available — store URL reference without downloading
      console.warn('[twilio/sms] No Twilio credentials for media download — skipping storage')
    }
  }

  // --- 5. Calculate message_type and last_message ---
  const messageType = determineMessageType(messageText, mediaItems)
  const lastMessageDisplay = formatLastMessage(messageText, mediaItems)

  // Update last_message with proper media label if text was empty
  if (!messageText && mediaItems.length > 0) {
    await supabase
      .from('conversations')
      .update({ last_message: lastMessageDisplay })
      .eq('id', conversationId)
  }

  // --- 6. Insert inbound user message ---
  await supabase.from('conversation_messages').insert({
    id: newMsgId,
    conversation_id: conversationId,
    org_id: orgId,
    role: 'user',
    content: messageText,
    message_type: messageType,
    metadata: {
      message_sid: messageSid,
      from_number: fromNumber,
      ...(mediaItems.length > 0 ? { media: mediaItems } : {}),
    },
  })

  // --- 7. Bot status gate — skip AI if a human has taken over -----------
  const botStatus = existing?.bot_status ?? 'active'
  if (botStatus !== 'active') {
    console.log('[twilio/sms] Bot paused for conversation:', conversationId)
    return
  }

  // Cannot auto-reply to media-only messages without text
  if (!messageText) {
    console.log('[twilio/sms] Media-only message — no auto-reply without text content')
    return
  }

  // --- 8. Resolve an agent for channel='sms' via agent_channel_defaults --
  const { data: defaultRow } = await supabase
    .from('agent_channel_defaults')
    .select('agent_id')
    .eq('organization_id', orgId)
    .eq('channel', 'sms')
    .maybeSingle()

  if (!defaultRow?.agent_id) {
    // No agent configured for SMS on this org — inbound logged, no auto-reply.
    return
  }

  // --- 9. Invoke the agent runtime (blocking path) ----------------------
  let replyText = ''
  try {
    const result = await runAgent({
      orgId,
      agentId: defaultRow.agent_id,
      channel: 'sms',
      userMessage: messageText,
      conversationId,
      stream: false,
    })
    replyText = result.text
  } catch (err) {
    console.error('[twilio/sms] runAgent error:', err)
    return
  }

  if (!replyText) return

  // --- 10. Split the reply into SMS-sized chunks ------------------------
  const chunks = formatSms(replyText)

  // --- 11. Send each chunk via the send_sms executor + persist as assistant
  for (const chunk of chunks) {
    if (chunk.type !== 'text') continue

    try {
      await sendSms(
        { to: fromNumber, body: chunk.text },
        { organizationId: orgId, supabase }
      )
    } catch (err) {
      console.error('[twilio/sms] sendSms error:', err)
      // Continue trying remaining chunks — don't bail on a partial failure.
      continue
    }

    await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      org_id: orgId,
      role: 'assistant',
      content: chunk.text,
      message_type: 'text',
      metadata: { channel: 'sms', from_number: toNumber },
    })
  }
}
