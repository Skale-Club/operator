// SEED-025 Phase E: unified workflows list.
// SEED-038: replaced the flat table with a folder-grouped tree that supports
// drag & drop, archive, and trash.

import Link from 'next/link'
import { Workflow as WorkflowIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { FolderTree } from './folder-tree'
import type { UnifiedWorkflow } from '@/lib/workflows/list'
import type { Database } from '@/types/database'

type WorkflowFolderRow = Database['public']['Tables']['workflow_folders']['Row']

interface Props {
  workflows: UnifiedWorkflow[]
  folders: WorkflowFolderRow[]
}

export function WorkflowsList({ workflows, folders }: Props) {
  if (workflows.length === 0 && folders.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <WorkflowIcon className="mx-auto h-8 w-8 text-text-tertiary mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">No workflows yet</p>
          <p className="text-sm text-text-secondary mb-4">
            Build your first workflow visually, or ask Copilot to create one from a single sentence.
          </p>
          <Link
            href="/workflows/flows/new"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <WorkflowIcon className="h-3.5 w-3.5" />
            Create your first workflow
          </Link>
        </CardContent>
      </Card>
    )
  }

  return <FolderTree workflows={workflows} folders={folders} />
}
