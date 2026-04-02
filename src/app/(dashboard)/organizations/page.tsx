import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationsTable } from '@/components/organizations/organizations-table'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">Manage tenants and their Vapi assistant mappings.</p>
      </div>
      <OrganizationsTable organizations={organizations ?? []} />
    </div>
  )
}
