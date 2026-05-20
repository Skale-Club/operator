import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUser } from '@/lib/supabase/server'
import { NewFlowForm } from '@/components/flows/new-flow-form'

export default async function NewFlowPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-xl px-4 sm:px-6 py-8 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/workflows/flows">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Flows
        </Link>
      </Button>

      <div>
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1">
          <Workflow className="h-3.5 w-3.5" /> Workflows
        </div>
        <h1 className="text-2xl font-semibold">New flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an empty canvas. You'll add nodes after.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <NewFlowForm />
      </div>
    </div>
  )
}
