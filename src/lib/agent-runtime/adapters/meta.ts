// src/lib/agent-runtime/adapters/meta.ts
// Meta channel adapter (Messenger + Instagram DM).
// Hard limit: 2000 characters per message (Meta Graph API text message limit).
// Markdown: stripped (Meta does not render markdown in messages).
// Returns multiple ChannelMessage chunks when text exceeds 2000 chars.

import type { ChannelMessage, FormatOptions } from './index'
import { stripMarkdown, splitAtSentenceBoundary } from './index'

const META_MAX_CHARS = 2000

export function formatOutbound(text: string, opts?: FormatOptions): ChannelMessage[] {
  const maxLen = opts?.maxChunkLength ?? META_MAX_CHARS
  const stripped = stripMarkdown(text)
  const chunks = splitAtSentenceBoundary(stripped, maxLen)
  return chunks.map((chunk) => ({ type: 'text' as const, text: chunk }))
}
