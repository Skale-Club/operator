// POST /api/chat/conversations/[id]/status — SEED-035 expanded status.
// Body: { status: 'open'|'pending'|'waiting'|'resolved'|'closed', wait_until?: string|null }
// `wait_until` is only meaningful for status='waiting'. Sent as ISO 8601 string.

import { createClient, getUser } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const StatusSchema = z.object({
  status: z.enum(['open', 'pending', 'waiting', 'resolved', 'closed']),
  wait_until: z.string().datetime().nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'status must be one of open|pending|waiting|resolved|closed; wait_until must be ISO 8601' },
      { status: 400 },
    )
  }

  const { status, wait_until } = parsed.data
  // Clear wait_until unless we're transitioning to 'waiting'.
  const waitUntilValue = status === 'waiting' ? (wait_until ?? null) : null

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({
      status,
      wait_until: waitUntilValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[POST status]', error)
    return Response.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return Response.json({ ok: true, status, wait_until: waitUntilValue })
}
