'use server'

import { z } from 'zod'
import { createClient, getUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

export type EmailSectionRow = Database['public']['Tables']['email_sections']['Row']

// ─── List shared sections ─────────────────────────────────────────────────────

export async function getEmailSections(
  globalOnly = false,
): Promise<ActionResult<EmailSectionRow[]>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const supabase = await createClient()
  let query = supabase.from('email_sections').select('*').order('type').order('name')
  if (globalOnly) query = query.eq('is_global', true)

  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

// ─── Create ───────────────────────────────────────────────────────────────────

const sectionSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['header', 'footer', 'hero', 'cta', 'text', 'image', 'divider', 'social', 'custom']),
  html_content: z.string().default(''),
  is_global: z.boolean().default(false),
})

export type EmailSectionInput = z.input<typeof sectionSchema>

export async function createEmailSection(
  input: EmailSectionInput,
): Promise<ActionResult<EmailSectionRow>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const parsed = sectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'validation_error' }

  const supabase = await createClient()
  const { data: orgData } = await supabase.rpc('get_current_org_id')
  if (!orgData) return { ok: false, error: 'no_active_org' }

  const { data, error } = await supabase
    .from('email_sections')
    .insert({ ...parsed.data, org_id: orgData as string })
    .select()
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'create_failed' }
  revalidatePath('/email-marketing/sections')
  return { ok: true, data }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateEmailSection(
  id: string,
  input: Partial<EmailSectionInput>,
): Promise<ActionResult<EmailSectionRow>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('email_sections')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'not_found' }
  revalidatePath('/email-marketing/sections')
  return { ok: true, data }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteEmailSection(id: string): Promise<ActionResult<void>> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const supabase = await createClient()
  const { error } = await supabase.from('email_sections').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/email-marketing/sections')
  return { ok: true, data: undefined }
}
