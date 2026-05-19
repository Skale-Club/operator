// Note tools.

import type { CopilotToolRegistry, ToolContext, ToolResult } from './types'

const MAX_ROWS = 50

async function queryNotes(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const search = input.search as string | undefined
  const entityType = input.entity_type as 'contact' | 'account' | 'opportunity' | undefined
  const entityId = input.entity_id as string | undefined
  const limit = Math.min(Number(input.limit ?? 25), MAX_ROWS)

  let query = ctx.supabase
    .from('notes')
    .select('id, title, content, pinned, entity_type, entity_id, created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`title.ilike.${term},content.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: { notes: data, count: data?.length ?? 0 } }
}

async function createNote(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const content = input.content as string | undefined
  if (!content) return { success: false, error: 'content required' }
  const { data, error } = await ctx.supabase
    .from('notes')
    .insert({
      org_id: ctx.orgId,
      title: (input.title as string | undefined) ?? null,
      content,
      pinned: Boolean(input.pinned ?? false),
      entity_type: (input.entity_type as 'contact' | 'account' | 'opportunity' | undefined) ?? null,
      entity_id: (input.entity_id as string | undefined) ?? null,
      created_by: ctx.userId,
    })
    .select('id, title, pinned')
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

async function pinNote(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const id = input.id as string
  const pinned = Boolean(input.pinned ?? true)
  if (!id) return { success: false, error: 'id required' }
  const { data, error } = await ctx.supabase
    .from('notes').update({ pinned }).eq('id', id)
    .select('id, pinned').maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: `note ${id} not found` }
  return { success: true, data }
}

export const noteTools: CopilotToolRegistry = {
  query_notes: {
    mode: 'read',
    definition: {
      name: 'query_notes',
      description: 'Search notes by substring across title/content; optionally filter to a specific CRM entity.',
      input_schema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          entity_type: { type: 'string', enum: ['contact', 'account', 'opportunity'] },
          entity_id: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
    handler: queryNotes,
  },
  create_note: {
    mode: 'write',
    definition: {
      name: 'create_note',
      description: 'Create a note. Optionally link it to a CRM entity.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          pinned: { type: 'boolean' },
          entity_type: { type: 'string', enum: ['contact', 'account', 'opportunity'] },
          entity_id: { type: 'string' },
        },
        required: ['content'],
      },
    },
    handler: createNote,
  },
  pin_note: {
    mode: 'write',
    definition: {
      name: 'pin_note',
      description: 'Pin (or unpin) a note.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          pinned: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
    handler: pinNote,
  },
}
