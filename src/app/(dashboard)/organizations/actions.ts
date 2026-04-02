'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function createOrganization(data: { name: string }): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const slug = generateSlug(data.name)
  const { error } = await supabase
    .from('organizations')
    .insert({ name: data.name, slug })
  if (error) {
    if (error.code === '23505') return { error: 'An organization with this name already exists.' }
    return { error: error.message }
  }
  revalidatePath('/dashboard/organizations')
}

export async function updateOrganization(
  id: string,
  data: { name: string; is_active: boolean }
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const slug = generateSlug(data.name)
  const { error } = await supabase
    .from('organizations')
    .update({ name: data.name, slug, is_active: data.is_active })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/organizations')
}

export async function toggleOrganizationStatus(
  id: string,
  is_active: boolean
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ is_active })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/organizations')
}
