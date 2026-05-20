// src/lib/meta/send-message.ts
// Sole caller of Meta Graph API Send endpoint.
// Import META_GRAPH_VERSION — never hardcode 'v21.0'.
// SEED-032: extended with optional `media` param. Meta does not accept a single
// request with both `attachment` and `text`, so when both are provided we send
// the attachment first and the text second.
import { META_GRAPH_VERSION } from '@/lib/meta/oauth'
import type { MetaOutboundMedia } from './types'

type SendSuccess = { messageId: string }
type SendError   = { error: string; code?: number }
export type SendResult = SendSuccess | SendError

async function postToMeta(
  pageToken: string,
  body: Record<string, unknown>,
): Promise<SendResult> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json()) as {
      message_id?: string
      error?: { message?: string; code?: number }
    }

    if (!res.ok) {
      return {
        error: json.error?.message ?? 'Meta API error',
        code: json.error?.code,
      }
    }

    return { messageId: json.message_id ?? '' }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { error: 'Meta API timeout', code: undefined }
    }
    return { error: String(err) }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendMetaMessage(
  pageToken: string,
  recipientId: string,
  text: string,
  media?: MetaOutboundMedia,
): Promise<SendResult> {
  // 1. If media is provided, send the attachment first.
  let lastResult: SendResult | null = null
  if (media?.url) {
    lastResult = await postToMeta(pageToken, {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: media.type,
          payload: { url: media.url, is_reusable: true },
        },
      },
      messaging_type: 'RESPONSE',
    })

    if ('error' in lastResult) {
      // Surface the attachment error rather than silently sending only text.
      return lastResult
    }
  }

  // 2. Send the text body if non-empty. (Meta rejects empty-text messages.)
  if (text && text.trim().length > 0) {
    lastResult = await postToMeta(pageToken, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    })
  }

  // 3. Backward-compat: if neither attachment nor text was provided treat as
  //    a no-op error so callers don't silently succeed with nothing sent.
  if (!lastResult) {
    return { error: 'sendMetaMessage called with empty text and no media' }
  }

  return lastResult
}
