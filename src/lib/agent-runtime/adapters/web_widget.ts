// src/lib/agent-runtime/adapters/web_widget.ts
// Web widget channel adapter.
// No length limit (browser renders arbitrary text). No markdown stripping
// (widget UI renders markdown via the existing chat-area component).
// Returns a single ChannelMessage of type 'text'.

import type { ChannelMessage, FormatOptions } from './index'

export function formatOutbound(text: string, _opts?: FormatOptions): ChannelMessage[] {
  // Web widget has no hard character limit and renders markdown natively.
  return [{ type: 'text', text }]
}
