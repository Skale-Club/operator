// src/lib/agent-runtime/adapters/whatsapp.ts
// WhatsApp channel adapter.
// Hard limit: 1600 characters per message (WhatsApp Business API).
// Markdown: standard markdown stripped; WhatsApp native bold (*bold*) and
// italic (_italic_) are preserved as WhatsApp renders them natively.
// Returns multiple ChannelMessage chunks when text exceeds 1600 chars.

import type { ChannelMessage, FormatOptions } from './index'
import { stripMarkdown, splitAtSentenceBoundary } from './index'

const WHATSAPP_MAX_CHARS = 1600

export function formatOutbound(text: string, opts?: FormatOptions): ChannelMessage[] {
  const maxLen = opts?.maxChunkLength ?? WHATSAPP_MAX_CHARS
  const stripped = stripMarkdown(text)
  const chunks = splitAtSentenceBoundary(stripped, maxLen)
  return chunks.map((chunk) => ({ type: 'text' as const, text: chunk }))
}
