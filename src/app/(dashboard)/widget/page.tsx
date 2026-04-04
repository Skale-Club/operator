import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient, getUser } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function WidgetPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: activeOrgId } = await supabase.rpc('get_current_org_id')

  if (!activeOrgId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>No active organization selected</CardTitle>
            <CardDescription>
              Choose an organization before configuring its widget settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/organizations" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Go to organizations
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .select(
      'id, name, widget_display_name, widget_primary_color, widget_welcome_message, widget_token'
    )
    .eq('id', activeOrgId)
    .single()

  if (error || !organization) {
    throw new Error(error?.message ?? 'Failed to load widget settings.')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Widget</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure the public chat widget for {organization.name}.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Form controls, preview, and embed installation live here in the next task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Display name</p>
              <p className="text-muted-foreground">
                {organization.widget_display_name?.trim() || 'AI Assistant'}
              </p>
            </div>
            <div>
              <p className="font-medium">Primary color</p>
              <p className="text-muted-foreground">
                {organization.widget_primary_color?.trim() || '#18181B'}
              </p>
            </div>
            <div>
              <p className="font-medium">Welcome message</p>
              <p className="text-muted-foreground">
                {organization.widget_welcome_message?.trim() || 'Hi! How can I help?'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current token</CardTitle>
            <CardDescription>
              This is the public token currently tied to the active organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              {organization.widget_token}
            </code>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
