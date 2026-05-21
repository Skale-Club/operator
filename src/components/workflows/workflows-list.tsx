'use client'

// SEED-025 Phase E: unified workflows list.
// SEED-038: groups workflows by folder. Unfoldered workflows render in an
// untitled group at the top; each folder is a collapsible section with a
// rename/delete menu. Each workflow row has a [...] menu with
// "Move to folder", "Archive", and "Delete" actions. Drag-and-drop is
// intentionally deferred — the context-menu path is the primary UX.

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  MoreHorizontal,
  Archive,
  Trash2,
  FolderInput,
  Pencil,
} from 'lucide-react'
import {
  CalendarBlank,
  ClockCountdown,
  CursorClick,
  FlowArrow,
  Lightning,
  WebhooksLogo,
  type Icon,
} from '@phosphor-icons/react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { NewWorkflowButton } from '@/components/flows/new-workflow-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'

import { WorkflowToggle } from './workflow-toggle'
import {
  archiveWorkflow,
  moveWorkflowToFolder,
  softDeleteWorkflow,
} from '@/app/(dashboard)/workflows/_actions/workflows'
import {
  deleteFolder,
  renameFolder,
} from '@/app/(dashboard)/workflows/_actions/folders'

interface WorkflowSummary {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  kind: 'tool' | 'flow'
  trigger_type: 'tool_call' | 'event' | 'schedule' | 'manual' | 'webhook_url'
  trigger_config: Record<string, unknown>
  health_blocked: boolean
  health_blocked_reason: string | null
  updated_at: string
  folder_id?: string | null
}

interface WorkflowFolder {
  id: string
  org_id: string
  name: string
  color: string | null
  icon: string | null
  parent_id: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

interface Props {
  workflows: WorkflowSummary[]
  folders?: WorkflowFolder[]
}

const TRIGGER_META: Record<
  WorkflowSummary['trigger_type'],
  { label: string; Icon: Icon; color: string }
> = {
  tool_call:   { label: 'Tool call', Icon: CursorClick,    color: '#6366f1' },
  event:       { label: 'Event',     Icon: CalendarBlank,  color: '#f59e0b' },
  schedule:    { label: 'Schedule',  Icon: ClockCountdown, color: '#06b6d4' },
  manual:      { label: 'Manual',    Icon: Lightning,      color: '#64748b' },
  webhook_url: { label: 'Webhook',   Icon: WebhooksLogo,   color: '#f97316' },
}

function triggerLabel(workflow: WorkflowSummary): string {
  const meta = TRIGGER_META[workflow.trigger_type]
  if (workflow.trigger_type === 'event') {
    const eventName = workflow.trigger_config?.event as string | undefined
    return eventName ? eventName.replace('meeting.', 'Meeting · ') : meta.label
  }
  if (workflow.trigger_type === 'tool_call') {
    const toolName = workflow.trigger_config?.tool_name as string | undefined
    return toolName ? `Tool · ${toolName}` : meta.label
  }
  if (workflow.trigger_type === 'schedule') {
    const cron = workflow.trigger_config?.cron as string | undefined
    return cron ? `Cron · ${cron}` : meta.label
  }
  return meta.label
}

export function WorkflowsList({ workflows, folders = [] }: Props) {
  // Group workflows by folder_id. `null` => unfoldered bucket.
  const groups = useMemo(() => {
    const byFolder = new Map<string | null, WorkflowSummary[]>()
    byFolder.set(null, [])
    for (const f of folders) byFolder.set(f.id, [])
    for (const w of workflows) {
      const key = w.folder_id ?? null
      if (!byFolder.has(key)) byFolder.set(key, [])
      byFolder.get(key)!.push(w)
    }
    return byFolder
  }, [workflows, folders])

  if (workflows.length === 0 && folders.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FlowArrow className="mx-auto h-8 w-8 text-text-tertiary mb-3" weight="fill" />
          <p className="text-sm font-medium text-text-primary mb-1">No workflows yet</p>
          <p className="text-sm text-text-secondary mb-4">
            Build your first workflow visually, or ask Copilot to create one from a single sentence.
          </p>
          <div className="inline-block">
            <NewWorkflowButton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const unfoldered = groups.get(null) ?? []

  return (
    <div className="space-y-3">
      {/* Unfoldered bucket — only render when it has rows */}
      {unfoldered.length > 0 && (
        <WorkflowGroup
          title={null}
          workflows={unfoldered}
          folders={folders}
          defaultOpen
        />
      )}

      {folders.map((folder) => (
        <WorkflowGroup
          key={folder.id}
          folder={folder}
          title={folder.name}
          workflows={groups.get(folder.id) ?? []}
          folders={folders}
          defaultOpen
        />
      ))}
    </div>
  )
}

// ─── Group ──────────────────────────────────────────────────────────────────

interface GroupProps {
  title: string | null
  folder?: WorkflowFolder
  workflows: WorkflowSummary[]
  folders: WorkflowFolder[]
  defaultOpen?: boolean
}

function WorkflowGroup({ title, folder, workflows, folders, defaultOpen = true }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isFolder = !!folder

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary/60 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${
              open ? 'rotate-90' : ''
            }`}
          />
          {isFolder ? (
            open ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <FolderIcon className="h-4 w-4 text-amber-500" />
            )
          ) : null}
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary truncate">
            {title ?? 'Unfiled'}
          </span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-bg-tertiary text-[10px] font-semibold text-text-tertiary tabular-nums">
            {workflows.length}
          </span>
        </button>

        {isFolder && folder && (
          <FolderMenu
            folder={folder}
            onRename={() => setRenameOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        )}
      </div>

      {/* Body */}
      {open && (
        <>
          {workflows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-text-tertiary">
              {isFolder ? 'Empty folder. Move a workflow here from its row menu.' : 'No workflows.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary/40">
                <tr className="text-xs text-text-tertiary uppercase tracking-wide">
                  <th className="w-10 px-4 py-2" />
                  <th className="text-left font-medium px-4 py-2">Name</th>
                  <th className="text-left font-medium px-4 py-2">Trigger</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Updated</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {workflows.map((w) => (
                  <WorkflowRow key={w.id} workflow={w} folders={folders} />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Folder rename + delete dialogs */}
      {isFolder && folder && (
        <>
          <RenameFolderDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            folder={folder}
          />
          <DeleteFolderDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            folder={folder}
            workflowCount={workflows.length}
          />
        </>
      )}
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  workflow: WorkflowSummary
  folders: WorkflowFolder[]
}

function WorkflowRow({ workflow: w, folders }: RowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { Icon, color } = TRIGGER_META[w.trigger_type]

  function handleMove(folderId: string | null) {
    startTransition(async () => {
      const res = await moveWorkflowToFolder(w.id, folderId)
      if (!res.ok) {
        toast.error(`Could not move workflow: ${res.error}`)
        return
      }
      toast.success(
        folderId
          ? `Moved "${w.name}" to folder.`
          : `Moved "${w.name}" out of its folder.`,
      )
      router.refresh()
    })
  }

  function handleArchive() {
    if (w.is_active) {
      toast.error('Deactivate the workflow before archiving it.')
      return
    }
    startTransition(async () => {
      const res = await archiveWorkflow(w.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not archive workflow.')
        return
      }
      toast.success(`Archived "${w.name}".`)
      router.refresh()
    })
  }

  function handleSoftDelete() {
    if (w.is_active) {
      toast.error('Deactivate the workflow before moving it to trash.')
      setConfirmDelete(false)
      return
    }
    startTransition(async () => {
      const res = await softDeleteWorkflow(w.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not move workflow to trash.')
        return
      }
      toast.success(`Moved "${w.name}" to trash.`)
      setConfirmDelete(false)
      router.refresh()
    })
  }

  const currentFolderId = w.folder_id ?? null

  return (
    <tr className="hover:bg-bg-secondary/40 transition-colors">
      <td className="pl-4 pr-0 py-3 w-10">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[7px] shrink-0"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-4 w-4 text-white" weight="fill" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Link
          href={w.kind === 'flow' ? `/workflows/flows/${w.id}` : `/workflows/${w.id}`}
          className="block group"
        >
          <p className="text-sm font-medium text-text-primary group-hover:underline truncate">
            {w.name}
          </p>
          {w.description && (
            <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1">
              {w.description}
            </p>
          )}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <Icon className="h-3.5 w-3.5" weight="fill" style={{ color }} />
          {triggerLabel(w)}
        </span>
      </td>
      <td className="px-4 py-3">
        <WorkflowToggle
          workflowId={w.id}
          initialActive={w.is_active}
          blocked={w.health_blocked}
          blockedReason={w.health_blocked_reason}
        />
      </td>
      <td className="px-4 py-3 text-right text-[11px] text-text-tertiary tabular-nums">
        {formatDistanceToNow(parseISO(w.updated_at), { addSuffix: true })}
      </td>
      <td className="pr-2 pl-0 py-3 w-10 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="Workflow actions"
              disabled={isPending}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="h-3.5 w-3.5" />
                <span>Move to folder</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem
                    disabled={currentFolderId === null}
                    onSelect={() => handleMove(null)}
                  >
                    <FolderIcon className="h-3.5 w-3.5 opacity-50" />
                    <span>(no folder)</span>
                  </DropdownMenuItem>
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  {folders.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      disabled={currentFolderId === f.id}
                      onSelect={() => handleMove(f.id)}
                    >
                      <FolderIcon className="h-3.5 w-3.5 text-amber-500" />
                      <span className="truncate">{f.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {folders.length === 0 && (
                    <DropdownMenuItem disabled>
                      <span className="text-text-tertiary">No folders yet</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleArchive}>
              <Archive className="h-3.5 w-3.5" />
              <span>Archive</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setConfirmDelete(true)
              }}
              className="text-rose-500 focus:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move workflow to trash?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{w.name}&rdquo; will be moved to the Trash. You can restore it from there
                until it&rsquo;s permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault()
                  handleSoftDelete()
                }}
                className="bg-rose-500 text-white hover:bg-rose-600"
              >
                Move to trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  )
}

// ─── Folder menu (header) ───────────────────────────────────────────────────

interface FolderMenuProps {
  folder: WorkflowFolder
  onRename: () => void
  onDelete: () => void
}

function FolderMenu({ onRename, onDelete }: FolderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label="Folder actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="h-3.5 w-3.5" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onDelete()
          }}
          className="text-rose-500 focus:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Rename folder dialog ───────────────────────────────────────────────────

function RenameFolderDialog({
  open,
  onOpenChange,
  folder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: WorkflowFolder
}) {
  const router = useRouter()
  const [name, setName] = useState(folder.name)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Folder name is required.')
      return
    }
    if (trimmed === folder.name) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      const res = await renameFolder(folder.id, { name: trimmed })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Folder renamed.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setName(folder.name)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Choose a new name for this folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-rename">Name</Label>
            <Input
              id="folder-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isPending}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete folder dialog ───────────────────────────────────────────────────

function DeleteFolderDialog({
  open,
  onOpenChange,
  folder,
  workflowCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: WorkflowFolder
  workflowCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteFolder(folder.id, { cascadeChildren: true })
      if (!res.ok) {
        toast.error(`Could not delete folder: ${res.error}`)
        return
      }
      toast.success(
        workflowCount > 0
          ? `Deleted "${folder.name}". ${workflowCount} workflow${
              workflowCount !== 1 ? 's' : ''
            } moved to trash.`
          : `Deleted "${folder.name}".`,
      )
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder &ldquo;{folder.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {workflowCount > 0
              ? `This folder contains ${workflowCount} workflow${
                  workflowCount !== 1 ? 's' : ''
                }. They will be moved to the Trash. You can restore them from there.`
              : 'The folder will be removed. No workflows are inside, so nothing else is affected.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            className="bg-rose-500 text-white hover:bg-rose-600"
          >
            Delete folder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
