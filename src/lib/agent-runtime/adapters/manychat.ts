// src/lib/agent-runtime/adapters/manychat.ts
// ManyChat channel adapter.
// ManyChat Dynamic Block v2 format. Each text chunk becomes one block message.
// Hard limit: 640 characters per text message in ManyChat Dynamic Block v2.
// Markdown: stripped (ManyChat renders plain text in message blocks).
// Returns ChannelMessage[] with type 'manychat_block' per chunk.

import type { ChannelMessage, ManychatDynamicBlock, FormatOptions } from './index'
import { stripMarkdown, splitAtSentenceBoundary } from './index'

// ManyChat Dynamic Block v2 text message limit
const MANYCHAT_MAX_CHARS = 640

export function formatOutbound(text: string, opts?: FormatOptions): ChannelMessage[] {
  const maxLen = opts?.maxChunkLength ?? MANYCHAT_MAX_CHARS
  const stripped = stripMarkdown(text)
  const chunks = splitAtSentenceBoundary(stripped, maxLen)

  return chunks.map((chunk): ChannelMessage => {
    const block: ManychatDynamicBlock = {
      version: 'v2',
      content: { messages: [{ type: 'text', text: chunk }] },
    }
    return { type: 'manychat_block', data: block }
  })
}
