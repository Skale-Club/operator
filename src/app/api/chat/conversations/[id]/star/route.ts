// SEED-035: toggle starred (favorite) on a conversation.
//
// PATCH /api/chat/conversations/[id]/star  body: { starred: boolean }

import { createClient, getUser } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Schema = z.object({ starred: z.boolean() })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'starred must be a boolean' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ starred: parsed.data.starred, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[PATCH star]', error)
    return Response.json({ error: 'Failed to update starred' }, { status: 500 })
  }

  return Response.json({ ok: true, starred: parsed.data.starred })
}
