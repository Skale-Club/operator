// SEED-035: assign a label to a conversation.
//
// POST /api/chat/conversations/[id]/labels  body: { label_id: string }

import { createClient, getUser } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Schema = z.object({ label_id: z.string().uuid() })

export async function POST(
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
    return Response.json({ error: 'label_id must be a valid uuid' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversation_label_assignments')
    .upsert(
      { conversation_id: id, label_id: parsed.data.label_id },
      { onConflict: 'conversation_id,label_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[POST conversation label]', error)
    return Response.json({ error: 'Failed to assign label' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
