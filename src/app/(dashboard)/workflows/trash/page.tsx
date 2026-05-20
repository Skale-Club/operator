// SEED-038: Workflows trash. Lists soft-deleted workflows with restore +
// permanent-delete + empty-trash controls.

import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { TrashRowActions, EmptyTrashButton } from './trash-actions'

interface TrashedWorkflow {
  id: string
  name: string
  kind: 'tool' | 'flow'
  trigger_type: string
  deleted_at: string
}

export default async function WorkflowsTrashPage() {
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const { data: rows } = orgId
    ? await supabase
        .from('workflows')
        .select('id, name, kind, trigger_type, deleted_at')
        .eq('org_id', orgId as string)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
    : { data: [] as TrashedWorkflow[] | null }

  const trashed = (rows ?? []) as TrashedWorkflow[]

  return (
    <PageContainer>
      <div className="mb-3">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to workflows
        </Link>
      </div>
      <PageHeader
        eyebrow="Workflows"
        eyebrowIcon={Trash2}
        title="Trash"
        description="Workflows here are hidden from triggers and agents. They can be restored, or deleted forever."
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {trashed.length === 0
            ? 'Trash is empty.'
            : `${trashed.length} workflow${trashed.length !== 1 ? 's' : ''}`}
        </p>
        <EmptyTrashButton disabled={trashed.length === 0} />
      </div>

      {trashed.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-12 text-center">
          <Trash2 className="mx-auto h-8 w-8 text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">No workflows in the trash.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary/60">
              <tr className="text-xs text-text-tertiary uppercase tracking-wide">
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-left font-medium px-4 py-2.5">Deleted</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {trashed.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary truncate">{w.name}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {w.kind} · {w.trigger_type}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text-secondary">
                    {formatDistanceToNow(parseISO(w.deleted_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <TrashRowActions workflowId={w.id} name={w.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  )
}
