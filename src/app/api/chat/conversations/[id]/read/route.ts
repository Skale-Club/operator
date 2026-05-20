// SEED-035: mark/unmark a conversation as read for the current user.
//
// POST   /api/chat/conversations/[id]/read  → upsert conversation_reads
// DELETE /api/chat/conversations/[id]/read  → drop the row (mark unread)

import { createClient, getUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('conversation_reads')
    .upsert(
      {
        conversation_id: id,
        user_id: user.id,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    )

  if (error) {
    console.error('[POST conversation read]', error)
    return Response.json({ error: 'Failed to mark as read' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('conversation_reads')
    .delete()
    .eq('conversation_id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE conversation read]', error)
    return Response.json({ error: 'Failed to mark as unread' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
