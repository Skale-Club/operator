// SEED-035: rename/recolor or delete an org label.
//
// PATCH  /api/chat/labels/[id]  body: { name?, color?, position? }
// DELETE /api/chat/labels/[id]

import { createClient, getUser } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

const UpdateSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    color: z.string().regex(COLOR_RE).optional(),
    position: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })

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

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid update payload' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversation_labels')
    .update(parsed.data)
    .eq('id', id)
    .select('id, name, color, position, created_at')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return Response.json({ error: 'A label with that name already exists' }, { status: 409 })
    }
    console.error('[PATCH label]', error)
    return Response.json({ error: 'Failed to update label' }, { status: 500 })
  }

  return Response.json({ label: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('conversation_labels').delete().eq('id', id)
  if (error) {
    console.error('[DELETE label]', error)
    return Response.json({ error: 'Failed to delete label' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
