// Admin chat inbox — lists all widget conversations for the active org.
// Auth: handled by (dashboard)/layout.tsx — no guard needed here.
import { AdminChatLayout } from '@/components/chat/admin-chat-layout'

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <AdminChatLayout />
    </div>
  )
}
