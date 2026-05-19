'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, AlertCircle } from 'lucide-react'
import type { MessagePart } from '@/lib/copilot/run-turn'

export function ToolCallBlock({ part }: { part: MessagePart }) {
  const [open, setOpen] = useState(false)
  const success = part.success !== false
  const summary = summarizeOutput(part.output)

  return (
    <div className="my-1 rounded-md border border-border bg-bg-secondary text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-bg-tertiary"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {success ? (
          <Wrench className="h-3 w-3 text-text-secondary" />
        ) : (
          <AlertCircle className="h-3 w-3 text-red-500" />
        )}
        <span className="font-mono text-[11px] text-text-secondary">{part.tool_name}</span>
        <span className="ml-auto truncate text-text-tertiary">{summary}</span>
      </button>
      {open && (
        <div className="border-t border-border px-2 py-2 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Input</div>
            <pre className="overflow-x-auto rounded bg-bg-tertiary p-2 font-mono text-[11px]">
              {JSON.stringify(part.input ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
              {success ? 'Output' : 'Error'}
            </div>
            <pre className="overflow-x-auto rounded bg-bg-tertiary p-2 font-mono text-[11px]">
              {success
                ? JSON.stringify(part.output ?? null, null, 2)
                : part.error ?? 'unknown error'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

function summarizeOutput(output: unknown): string {
  if (output === null || output === undefined) return ''
  if (typeof output !== 'object') return String(output).slice(0, 50)
  const obj = output as Record<string, unknown>
  if (typeof obj.count === 'number') return `${obj.count} result${obj.count === 1 ? '' : 's'}`
  if (Array.isArray(obj.contacts)) return `${obj.contacts.length} contact(s)`
  if (Array.isArray(obj.opportunities)) return `${obj.opportunities.length} opp(s)`
  if (Array.isArray(obj.tasks)) return `${obj.tasks.length} task(s)`
  if (Array.isArray(obj.notes)) return `${obj.notes.length} note(s)`
  if (Array.isArray(obj.accounts)) return `${obj.accounts.length} account(s)`
  if (typeof obj.id === 'string') return `→ ${obj.id.slice(0, 8)}`
  return ''
}
