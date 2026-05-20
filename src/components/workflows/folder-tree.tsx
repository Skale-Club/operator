'use client'

// SEED-038: Folder-grouped workflow list with drag & drop.
//
// Layout:
//   - One section per folder (org-scoped, sorted by position).
//   - A trailing "Unfiled" section for workflows with `folder_id === null`.
//   - Each workflow row is draggable; dropping on a folder header moves the
//     workflow into that folder. Dropping over another workflow reorders.
//   - Folder headers expose a "···" menu (rename, recolor, archive, delete)
//     and the New folder button creates a sibling at the root.

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  GripVertical,
  Calendar,
  Clock,
  MousePointerClick,
  Webhook,
  Archive,
  Trash2,
  ArchiveRestore,
  FolderInput,
  type LucideIcon,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkflowToggle } from './workflow-toggle'
import { FolderCreateDialog } from './folder-create-dialog'
import {
  archiveFolder,
  deleteFolder,
  renameFolder,
  updateFolderMeta,
  type WorkflowFolderRow,
} from '@/app/(dashboard)/workflows/_actions/folders'
import {
  archiveWorkflow,
  moveWorkflowToFolder,
  softDeleteWorkflow,
  unarchiveWorkflow,
} from '@/app/(dashboard)/workflows/_actions/workflows'
import type { UnifiedWorkflow } from '@/lib/workflows/list'

interface Props {
  workflows: UnifiedWorkflow[]
  folders: WorkflowFolderRow[]
}

const TRIGGER_META: Record<
  UnifiedWorkflow['trigger_type'],
  { label: string; Icon: LucideIcon }
> = {
  tool_call: { label: 'Tool call', Icon: MousePointerClick },
  event: { label: 'Event', Icon: Calendar },
  schedule: { label: 'Schedule', Icon: Clock },
  manual: { label: 'Manual', Icon: MousePointerClick },
  webhook_url: { label: 'Webhook', Icon: Webhook },
}

function triggerLabel(w: UnifiedWorkflow): string {
  const meta = TRIGGER_META[w.trigger_type]
  if (w.trigger_type === 'event') {
    const eventName = w.trigger_config?.event as string | undefined
    return eventName ? eventName.replace('meeting.', 'Meeting · ') : meta.label
  }
  if (w.trigger_type === 'tool_call') {
    const toolName = w.trigger_config?.tool_name as string | undefined
    return toolName ? `Tool · ${toolName}` : meta.label
  }
  if (w.trigger_type === 'schedule') {
    const cron = w.trigger_config?.cron as string | undefined
    return cron ? `Cron · ${cron}` : meta.label
  }
  return meta.label
}

function workflowHref(w: UnifiedWorkflow): string {
  return w.kind === 'flow' ? `/workflows/flows/${w.id}` : `/workflows/${w.id}`
}

const COLOR_PRESETS: { value: string | null; label: string; swatch: string }[] = [
  { value: null, label: 'Default', swatch: 'bg-text-tertiary' },
  { value: '#6366F1', label: 'Indigo', swatch: 'bg-indigo-500' },
  { value: '#10B981', label: 'Emerald', swatch: 'bg-emerald-500' },
  { value: '#F59E0B', label: 'Amber', swatch: 'bg-amber-500' },
  { value: '#EF4444', label: 'Rose', swatch: 'bg-rose-500' },
  { value: '#8B5CF6', label: 'Violet', swatch: 'bg-violet-500' },
  { value: '#0EA5E9', label: 'Sky', swatch: 'bg-sky-500' },
  { value: '#EC4899', label: 'Pink', swatch: 'bg-pink-500' },
]

// ─── Workflow row ─────────────────────────────────────────────────────────────

interface WorkflowRowProps {
  workflow: UnifiedWorkflow
  folders: WorkflowFolderRow[]
  isDragging?: boolean
  overlay?: boolean
}

function WorkflowRow({ workflow, folders, isDragging, overlay }: WorkflowRowProps) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `workflow:${workflow.id}`,
    data: { type: 'workflow', workflowId: workflow.id, folderId: workflow.folder_id },
  })
  const Icon = TRIGGER_META[workflow.trigger_type].Icon

  function withRefresh(action: () => Promise<{ ok: boolean; error?: string }>) {
    action().then((res) => {
      if (!res.ok) toast.error(res.error ?? 'Action failed')
      else router.refresh()
    })
  }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 transition-colors',
        !overlay && 'hover:bg-bg-secondary/40 border-b border-border-subtle last:border-b-0',
        isDragging && 'opacity-40',
        overlay && 'rounded-lg border border-border-subtle bg-bg-secondary shadow-elevation-md w-[420px]',
      )}
    >
      <button
        {...(overlay ? {} : attributes)}
        {...(overlay ? {} : listeners)}
        className="text-text-tertiary/60 hover:text-text-primary cursor-grab active:cursor-grabbing"
        aria-label="Drag workflow"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Link
        href={workflowHref(workflow)}
        className="flex-1 min-w-0 group/link"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        <p className="text-sm font-medium text-text-primary group-hover/link:underline truncate">
          {workflow.name}
          {workflow.archived_at && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-text-tertiary">
              Archived
            </span>
          )}
        </p>
        {workflow.description && (
          <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1">
            {workflow.description}
          </p>
        )}
      </Link>

      <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
        <Icon className="h-3 w-3 text-text-tertiary" />
        {triggerLabel(workflow)}
      </span>

      <div className="ml-2">
        <WorkflowToggle
          workflowId={workflow.id}
          initialActive={workflow.is_active}
          blocked={workflow.health_blocked}
          blockedReason={workflow.health_blocked_reason}
        />
      </div>

      <span className="hidden lg:inline text-[11px] text-text-tertiary tabular-nums w-20 text-right">
        {formatDistanceToNow(parseISO(workflow.updated_at), { addSuffix: true })}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Workflow actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={workflowHref(workflow)}>Open</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="h-3.5 w-3.5 mr-2" />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => withRefresh(() => moveWorkflowToFolder(workflow.id, null))}
                disabled={workflow.folder_id === null}
              >
                <FolderIcon className="h-3.5 w-3.5 mr-2 text-text-tertiary" />
                Unfiled
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() => withRefresh(() => moveWorkflowToFolder(workflow.id, f.id))}
                  disabled={workflow.folder_id === f.id}
                >
                  <FolderIcon
                    className="h-3.5 w-3.5 mr-2"
                    style={f.color ? { color: f.color } : undefined}
                  />
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {workflow.archived_at ? (
            <DropdownMenuItem onClick={() => withRefresh(() => unarchiveWorkflow(workflow.id))}>
              <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => withRefresh(() => archiveWorkflow(workflow.id))}>
              <Archive className="h-3.5 w-3.5 mr-2" />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-rose-500 focus:text-rose-500"
            onClick={() => withRefresh(() => softDeleteWorkflow(workflow.id))}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Folder section ───────────────────────────────────────────────────────────

interface FolderSectionProps {
  folder: WorkflowFolderRow | null // null = Unfiled
  workflows: UnifiedWorkflow[]
  allFolders: WorkflowFolderRow[]
  activeDragId: string | null
}

function FolderSection({ folder, workflows, allFolders, activeDragId }: FolderSectionProps) {
  const router = useRouter()
  const [expanded, setExpanded] = React.useState(true)
  const [renaming, setRenaming] = React.useState(false)
  const [pendingName, setPendingName] = React.useState(folder?.name ?? '')
  const targetId = folder ? `folder:${folder.id}` : 'folder:__unfiled__'

  const { setNodeRef, isOver } = useDroppable({
    id: targetId,
    data: { type: 'folder', folderId: folder?.id ?? null },
  })

  function withRefresh(action: () => Promise<{ ok: boolean; error?: string }>) {
    action().then((res) => {
      if (!res.ok) toast.error(res.error ?? 'Action failed')
      else router.refresh()
    })
  }

  function handleRenameSubmit() {
    if (!folder) return
    const name = pendingName.trim()
    if (!name || name === folder.name) {
      setRenaming(false)
      return
    }
    withRefresh(() => renameFolder(folder.id, { name }))
    setRenaming(false)
  }

  const folderColor = folder?.color ?? undefined
  const isDraggingWorkflow = activeDragId?.startsWith('workflow:') ?? false

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border bg-bg-secondary/30 overflow-hidden transition-colors',
        isOver && isDraggingWorkflow
          ? 'border-accent/40 bg-accent/5'
          : 'border-border-subtle',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary/60 border-b border-border-subtle">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-text-tertiary hover:text-text-primary"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </button>
        <FolderIcon
          className="h-4 w-4"
          style={folderColor ? { color: folderColor } : { color: 'var(--text-tertiary)' }}
        />
        {renaming && folder ? (
          <input
            autoFocus
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') {
                setPendingName(folder.name)
                setRenaming(false)
              }
            }}
            className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none border-b border-accent"
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-text-primary truncate"
            onDoubleClick={() => folder && setRenaming(true)}
          >
            {folder?.name ?? 'Unfiled'}
          </span>
        )}
        <span className="text-[11px] text-text-tertiary tabular-nums">
          {workflows.length}
        </span>
        {folder && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Folder actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  setPendingName(folder.name)
                  setRenaming(true)
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change color</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="grid grid-cols-4 gap-1.5 p-2 w-auto">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        withRefresh(() => updateFolderMeta(folder.id, { color: p.value }))
                      }
                      className={cn(
                        'h-5 w-5 rounded-full ring-2 transition',
                        p.swatch,
                        folder.color === p.value
                          ? 'ring-text-primary'
                          : 'ring-transparent hover:ring-border-subtle',
                      )}
                      aria-label={p.label}
                      title={p.label}
                    />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => withRefresh(() => archiveFolder(folder.id))}>
                <Archive className="h-3.5 w-3.5 mr-2" />
                Archive folder
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-rose-500 focus:text-rose-500"
                onClick={() =>
                  withRefresh(() => deleteFolder(folder.id, { cascadeChildren: true }))
                }
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded && (
        <div>
          {workflows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-tertiary">
              {folder ? 'Drop a workflow here, or move one via its menu.' : 'No unfiled workflows.'}
            </div>
          ) : (
            workflows.map((w) => (
              <WorkflowRow
                key={w.id}
                workflow={w}
                folders={allFolders}
                isDragging={activeDragId === `workflow:${w.id}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Top-level tree ───────────────────────────────────────────────────────────

export function FolderTree({ workflows, folders }: Props) {
  const router = useRouter()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  // Group workflows by folder.
  const byFolder = React.useMemo(() => {
    const map = new Map<string | null, UnifiedWorkflow[]>()
    map.set(null, [])
    for (const f of folders) map.set(f.id, [])
    for (const w of workflows) {
      const key = w.folder_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(w)
    }
    return map
  }, [workflows, folders])

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = e
    if (!over) return
    const activeData = active.data.current as { type?: string; workflowId?: string; folderId?: string | null } | undefined
    const overData = over.data.current as { type?: string; folderId?: string | null } | undefined
    if (activeData?.type !== 'workflow' || overData?.type !== 'folder') return
    if (!activeData.workflowId) return
    const sourceFolder = activeData.folderId ?? null
    const destFolder = overData.folderId ?? null
    if (sourceFolder === destFolder) return
    moveWorkflowToFolder(activeData.workflowId, destFolder).then((res) => {
      if (!res.ok) toast.error(res.error ?? 'Failed to move workflow')
      else router.refresh()
    })
  }

  const activeWorkflow = activeDragId?.startsWith('workflow:')
    ? workflows.find((w) => `workflow:${w.id}` === activeDragId)
    : null

  const rootFolders = folders.filter((f) => f.parent_id === null)
  const childFoldersByParent = new Map<string, WorkflowFolderRow[]>()
  for (const f of folders) {
    if (f.parent_id) {
      if (!childFoldersByParent.has(f.parent_id)) {
        childFoldersByParent.set(f.parent_id, [])
      }
      childFoldersByParent.get(f.parent_id)!.push(f)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end mb-3">
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {rootFolders.map((folder) => {
            const own = byFolder.get(folder.id) ?? []
            const children = childFoldersByParent.get(folder.id) ?? []
            // Nested folders render as their own collapsed sections under the parent.
            return (
              <div key={folder.id} className="space-y-3">
                <FolderSection
                  folder={folder}
                  workflows={own}
                  allFolders={folders}
                  activeDragId={activeDragId}
                />
                {children.length > 0 && (
                  <div className="pl-6 space-y-3">
                    {children.map((child) => (
                      <FolderSection
                        key={child.id}
                        folder={child}
                        workflows={byFolder.get(child.id) ?? []}
                        allFolders={folders}
                        activeDragId={activeDragId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <FolderSection
            folder={null}
            workflows={byFolder.get(null) ?? []}
            allFolders={folders}
            activeDragId={activeDragId}
          />
        </div>

        <DragOverlay>
          {activeWorkflow ? (
            <WorkflowRow workflow={activeWorkflow} folders={folders} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <FolderCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
