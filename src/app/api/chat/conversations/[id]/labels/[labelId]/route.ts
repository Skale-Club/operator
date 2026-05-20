// SEED-035: remove a label assignment from a conversation.
//
// DELETE /api/chat/conversations/[id]/labels/[labelId]

import { createClient, getUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; labelId: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, labelId } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('conversation_label_assignments')
    .delete()
    .eq('conversation_id', id)
    .eq('label_id', labelId)

  if (error) {
    console.error('[DELETE conversation label]', error)
    return Response.json({ error: 'Failed to remove label' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
