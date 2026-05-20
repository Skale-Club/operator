'use client'

// SEED-038: Client controls for the workflows trash. Restore is one click;
// hard delete / empty trash use an AlertDialog confirmation.

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, ArchiveRestore } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  emptyTrash,
  hardDeleteWorkflow,
  restoreWorkflowFromTrash,
} from '../_actions/workflows'

interface TrashRowActionsProps {
  workflowId: string
  name: string
}

export function TrashRowActions({ workflowId, name }: TrashRowActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreWorkflowFromTrash(workflowId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Workflow restored')
      router.refresh()
    })
  }

  function handleHardDelete() {
    startTransition(async () => {
      const res = await hardDeleteWorkflow(workflowId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Workflow deleted permanently')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={handleRestore} disabled={pending}>
        <ArchiveRestore className="h-3.5 w-3.5" />
        Restore
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-500 hover:text-rose-500"
            disabled={pending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete forever
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{name}&rdquo; permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The workflow, its versions, and all run history will
              be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface EmptyTrashButtonProps {
  disabled?: boolean
}

export function EmptyTrashButton({ disabled }: EmptyTrashButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function handleEmpty() {
    startTransition(async () => {
      const res = await emptyTrash()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Deleted ${res.data.count} workflow${res.data.count !== 1 ? 's' : ''}`)
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || pending}>
          <Trash2 className="h-3.5 w-3.5" />
          Empty trash
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Empty the trash?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every workflow currently in the trash. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleEmpty}
            className="bg-rose-500 text-white hover:bg-rose-600"
          >
            Empty trash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
