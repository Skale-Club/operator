// src/lib/twilio/media.ts
// Downloads Twilio media and stores it in Supabase Storage.
// SEED-030: Chat Rich Messages
//
// Twilio media URLs require Basic Auth with AccountSid:AuthToken.
// We download the file and re-host it in the `chat-media` bucket to avoid
// reliance on Twilio's temporary URLs (which expire after ~4 hours).

import { storeMediaFromUrl } from '@/lib/chat/store-media'

interface DownloadAndStoreTwilioMediaParams {
  mediaUrl: string
  mimeType: string
  accountSid: string
  authToken: string
  orgId: string
  conversationId: string
  messageId: string
  idx: number
}

interface StoredTwilioMedia {
  url: string
  size: number
  filename: string
}

/**
 * Downloads a Twilio media URL (using Basic Auth) and uploads the file to
 * Supabase Storage. Returns the public URL, size, and filename on success,
 * or null on failure (never throws).
 */
export async function downloadAndStoreTwilioMedia(
  params: DownloadAndStoreTwilioMediaParams
): Promise<StoredTwilioMedia | null> {
  const { mediaUrl, mimeType, accountSid, authToken, orgId, conversationId, messageId, idx } =
    params

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const authHeaders = { Authorization: `Basic ${credentials}` }

  const stored = await storeMediaFromUrl({
    url: mediaUrl,
    mimeType,
    authHeaders,
    orgId,
    conversationId,
    messageId,
    idx,
    timestamp: Date.now(),
  })

  if (!stored) return null

  return {
    url: stored.publicUrl,
    size: stored.size,
    filename: stored.filename,
  }
}
