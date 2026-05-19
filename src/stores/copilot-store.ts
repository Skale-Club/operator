// Copilot UI state. Source of truth for the chat panel.

import { create } from 'zustand'
import type { MessagePart } from '@/lib/copilot/run-turn'

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  parts: MessagePart[]
  pending?: boolean
  runId?: string
  costUsd?: number
}

interface CopilotState {
  open: boolean
  conversationId: string | null
  messages: CopilotMessage[]
  writeMode: boolean
  sending: boolean
  sessionCostUsd: number

  setOpen: (open: boolean) => void
  setConversationId: (id: string | null) => void
  setWriteMode: (v: boolean) => void
  setSending: (v: boolean) => void
  resetMessages: (messages: CopilotMessage[]) => void
  appendMessage: (msg: CopilotMessage) => void
  updateMessage: (id: string, patch: Partial<CopilotMessage>) => void
  addCost: (amount: number) => void
  newSession: () => void
}

export const useCopilotStore = create<CopilotState>((set) => ({
  open: false,
  conversationId: null,
  messages: [],
  writeMode: false,
  sending: false,
  sessionCostUsd: 0,

  setOpen: (open) => set({ open }),
  setConversationId: (conversationId) => set({ conversationId }),
  setWriteMode: (writeMode) => set({ writeMode }),
  setSending: (sending) => set({ sending }),
  resetMessages: (messages) => set({ messages }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  addCost: (amount) => set((s) => ({ sessionCostUsd: s.sessionCostUsd + amount })),
  newSession: () => set({ conversationId: null, messages: [], sessionCostUsd: 0 }),
}))
