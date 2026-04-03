'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deleteDocument } from '@/actions/knowledge'
import type { Database } from '@/types/database'

type Document = Database['public']['Tables']['documents']['Row']

const STATUS_BADGE: Record<Document['status'], { label: string; className: string }> = {
  processing: { label: 'Processing', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ready:      { label: 'Ready',      className: 'bg-green-100 text-green-800 border-green-200'  },
  error:      { label: 'Error',      className: 'bg-red-100 text-red-800 border-red-200'        },
}

function StatusBadge({ status }: { status: Document['status'] }) {
  const { label, className } = STATUS_BADGE[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface DocumentRowProps {
  document: Document
}

function DocumentRow({ document }: DocumentRowProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Delete "${document.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteDocument(document.id)
      window.location.reload()
    })
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4 pl-4">
        <div className="text-sm font-medium truncate max-w-[240px]" title={document.name}>
          {document.name}
        </div>
        <div className="text-xs text-muted-foreground capitalize">{document.source_type}</div>
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={document.status} />
        {document.status === 'error' && document.error_detail && (
          <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={document.error_detail}>
            {document.error_detail}
          </p>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">
        {document.status === 'ready' ? document.chunk_count : '—'}
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">
        {formatDate(document.created_at)}
      </td>
      <td className="py-3 text-right pr-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
        >
          {isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </td>
    </tr>
  )
}

interface DocumentListProps {
  documents: Document[]
}

export function DocumentList({ documents }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents yet. Upload a file or add a URL to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="py-2.5 pr-4 pl-4 text-left text-xs font-medium text-muted-foreground">Name</th>
            <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">Chunks</th>
            <th className="py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground">Added</th>
            <th className="py-2.5 pr-4 text-right text-xs font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} document={doc} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
