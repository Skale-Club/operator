// SEED-035: org-scoped conversation labels CRUD.
//
// GET  /api/chat/labels       → list labels for the active org
// POST /api/chat/labels       → create a label { name, color?, position? }

import { createClient, getUser } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

const CreateSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(COLOR_RE).optional(),
  position: z.number().int().optional(),
})

export async function GET(): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversation_labels')
    .select('id, name, color, position, created_at')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET labels]', error)
    return Response.json({ error: 'Failed to load labels' }, { status: 500 })
  }

  return Response.json({ labels: data ?? [] })
}

export async function POST(request: Request): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'name (1–64 chars) is required; color must be #RRGGBB' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  // get_current_org_id() resolves the active org for the request.
  const { data: orgIdResult, error: orgErr } = await supabase.rpc('get_current_org_id')
  if (orgErr || !orgIdResult) {
    return Response.json({ error: 'No active org' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('conversation_labels')
    .insert({
      org_id: orgIdResult as string,
      name: parsed.data.name,
      color: parsed.data.color ?? '#6366F1',
      position: parsed.data.position ?? 0,
    })
    .select('id, name, color, position, created_at')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return Response.json({ error: 'A label with that name already exists' }, { status: 409 })
    }
    console.error('[POST label]', error)
    return Response.json({ error: 'Failed to create label' }, { status: 500 })
  }

  return Response.json({ label: data })
}
