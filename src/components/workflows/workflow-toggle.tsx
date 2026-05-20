'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { toggleWorkflowActive } from '@/app/(dashboard)/workflows/flows/_actions/workflows'

interface Props {
  workflowId: string
  initialActive: boolean
  blocked?: boolean
  blockedReason?: string | null
  showLabel?: boolean
}

export function WorkflowToggle({
  workflowId,
  initialActive,
  blocked,
  blockedReason,
  showLabel,
}: Props) {
  const [active, setActive] = useState(initialActive)
  const [isPending, startTransition] = useTransition()

  if (blocked) {
    return (
      <Badge
        variant="secondary"
        className="bg-red-500/15 text-red-500 text-[10px]"
        title={blockedReason ?? undefined}
      >
        Blocked
      </Badge>
    )
  }

  function handleToggle(checked: boolean) {
    setActive(checked)
    startTransition(async () => {
      const result = await toggleWorkflowActive(workflowId, checked)
      if (!result.ok) {
        setActive(!checked)
        toast.error(`Could not update workflow: ${result.error}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={active}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={active ? 'Deactivate workflow' : 'Activate workflow'}
      />
      {showLabel && (
        <span className="text-xs text-text-secondary">{active ? 'Active' : 'Inactive'}</span>
      )}
    </div>
  )
}
