'use client'

import { useState, useTransition } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { Plug2, MoreHorizontal, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import type { IntegrationForDisplay } from '@/app/(dashboard)/integrations/actions'
import { testConnection, deleteIntegration } from '@/app/(dashboard)/integrations/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import { IntegrationForm } from './integration-form'

const PROVIDER_LABELS: Record<string, string> = {
  gohighlevel: 'GoHighLevel',
  twilio: 'Twilio',
  calcom: 'Cal.com',
  custom_webhook: 'Custom Webhook',
}

interface IntegrationsTableProps {
  integrations: IntegrationForDisplay[]
}

export function IntegrationsTable({ integrations: initialIntegrations }: IntegrationsTableProps) {
  const [integrations, setIntegrations] = useState<IntegrationForDisplay[]>(initialIntegrations)
  const [sorting, setSorting] = useState<SortingState>([])
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<IntegrationForDisplay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IntegrationForDisplay | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreateSheet() {
    setEditingIntegration(null)
    setIsSheetOpen(true)
  }

  function openEditSheet(integration: IntegrationForDisplay) {
    setEditingIntegration(integration)
    setIsSheetOpen(true)
  }

  function handleSheetSuccess() {
    setIsSheetOpen(false)
    setEditingIntegration(null)
    window.location.reload()
  }

  function handleTestConnection(integration: IntegrationForDisplay) {
    startTransition(async () => {
      const result = await testConnection(integration.id)
      if (result.success) {
        toast.success('Connection successful.')
      } else {
        toast.error(`Connection failed: ${result.error}`)
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    startTransition(async () => {
      const result = await deleteIntegration(id)
      if (result && 'error' in result && result.error) {
        toast.error('Failed to delete integration. Try again.')
      } else {
        setIntegrations((prev) => prev.filter((i) => i.id !== id))
        toast.success('Integration deleted.')
      }
    })
  }

  const columns: ColumnDef<IntegrationForDisplay>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 text-xs font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.getValue('name')}</span>
      ),
    },
    {
      accessorKey: 'provider',
      header: () => <span className="text-xs font-medium">Provider</span>,
      cell: ({ row }) => {
        const provider = row.getValue<string>('provider')
        const isActive = row.original.is_active
        return (
          <Badge
            variant="outline"
            className={isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'}
          >
            {PROVIDER_LABELS[provider] ?? provider}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'masked_api_key',
      header: () => <span className="text-xs font-medium">API Key</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.getValue('masked_api_key')}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: () => <span className="text-xs font-medium">Status</span>,
      cell: ({ row }) => {
        const isActive = row.getValue<boolean>('is_active')
        return (
          <Badge
            variant="outline"
            className={isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: () => <span className="text-xs font-medium">Created</span>,
      cell: ({ row }) => {
        const dateStr = row.getValue<string>('created_at')
        return <span className="text-sm">{format(new Date(dateStr), 'MMM d, yyyy')}</span>
      },
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const integration = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditSheet(integration)}>
                Edit Integration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTestConnection(integration)}>
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTarget(integration)}
              >
                Delete Integration
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: integrations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isPending && integrations.length === 0) {
    return <IntegrationsTableSkeleton />
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="sr-only">Loading integrations...</span>
        <div />
        <Button onClick={openCreateSheet}>Add Integration</Button>
      </div>

      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <Plug2 className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">No integrations yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first integration to connect GoHighLevel.
            </p>
          </div>
          <Button onClick={openCreateSheet}>Add Integration</Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="p-0 sm:max-w-lg">
          <IntegrationForm
            mode={editingIntegration ? 'edit' : 'create'}
            integration={editingIntegration ?? undefined}
            onSuccess={handleSheetSuccess}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Integration</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteTarget?.name}&quot; integration and all stored
              credentials. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function IntegrationsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 h-12">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[32px] ml-auto" />
        </div>
      ))}
    </div>
  )
}
