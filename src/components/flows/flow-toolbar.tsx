'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFlowStore } from '@/stores/flow-store'
import { validateFlow } from '@/lib/flows/schema'
import { saveWorkflowDefinition } from '@/app/(dashboard)/automations/flows/_actions/workflows'

interface FlowToolbarProps {
  workflowId: string
  workflowName: string
}

export function FlowToolbar({ workflowId, workflowName }: FlowToolbarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const dirty = useFlowStore((s) => s.dirty)
  const lastSavedAt = useFlowStore((s) => s.lastSavedAt)
  const toDefinition = useFlowStore((s) => s.toDefinition)
  const markSaved = useFlowStore((s) => s.markSaved)
  const nodeCount = useFlowStore((s) => s.nodes.length)

  function handleSaveVersion() {
    startTransition(async () => {
      const def = toDefinition()
      const issues = validateFlow(def)
      const errors = issues.filter((i) => i.level === 'error')
      if (errors.length > 0) {
        toast.error(`${errors.length} validation error${errors.length > 1 ? 's' : ''}: ${errors[0].message}`)
        return
      }
      const result = await saveWorkflowDefinition(workflowId, def, { createNewVersion: true })
      if (!result.ok) {
        toast.error(`Save failed: ${result.error}`)
        return
      }
      markSaved()
      toast.success(`Saved version ${result.data.versionNumber}`)
      router.refresh()
    })
  }

  // ── Status indicator text ───────────────────────────────────────────────────
  let statusEl: React.ReactNode = null
  if (isPending) {
    statusEl = (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    )
  } else if (dirty) {
    statusEl = (
      <span className="flex items-center gap-1 text-xs text-yellow-500">
        <AlertCircle className="h-3 w-3" /> Unsaved
      </span>
    )
  } else if (lastSavedAt) {
    statusEl = (
      <span className="flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Button asChild variant="ghost" size="sm">
          <Link href="/automations/flows">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Flows
          </Link>
        </Button>
        <span className="text-sm font-medium truncate">{workflowName}</span>
        <Badge variant="outline" className="text-[10px]">
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {statusEl}
        <Button size="sm" onClick={handleSaveVersion} disabled={isPending} className="gap-1.5">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save version
        </Button>
      </div>
    </div>
  )
}
