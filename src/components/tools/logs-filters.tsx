'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LogsFiltersProps {
  toolOptions: Array<{ id: string; tool_name: string }>
  showToolFilter?: boolean
  basePath: string
  // Current values from server searchParams
  status?: string
  tool?: string
  from?: string
  to?: string
  q?: string
}

export function LogsFilters({
  toolOptions,
  showToolFilter = false,
  basePath,
  status = 'all',
  tool = '',
  from = '',
  to = '',
  q = '',
}: LogsFiltersProps) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function buildUrl(overrides: Partial<{ status: string; tool: string; from: string; to: string; q: string }>) {
    const merged = { status, tool, from, to, q, ...overrides }
    const params = new URLSearchParams()
    if (merged.status && merged.status !== 'all') params.set('status', merged.status)
    if (merged.tool) params.set('tool', merged.tool)
    if (merged.from) params.set('from', merged.from)
    if (merged.to) params.set('to', merged.to)
    if (merged.q) params.set('q', merged.q)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function push(overrides: Partial<{ status: string; tool: string; from: string; to: string; q: string }>) {
    router.push(buildUrl(overrides))
  }

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        push({ q: value })
      }, 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, tool, from, to]
  )

  const hasFilters = (status && status !== 'all') || tool || from || to || q

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status */}
      <Select value={status || 'all'} onValueChange={(v) => push({ status: v })}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="timeout">Timeout</SelectItem>
        </SelectContent>
      </Select>

      {/* Tool filter */}
      {showToolFilter && (
        <Select value={tool || 'all'} onValueChange={(v) => push({ tool: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All tools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tools</SelectItem>
            {toolOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.tool_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date from — key forces remount when value cleared */}
      <Input
        key={`from-${from}`}
        type="date"
        defaultValue={from}
        className="h-8 w-36 text-xs"
        onChange={(e) => push({ from: e.target.value })}
      />

      {/* Date to */}
      <Input
        key={`to-${to}`}
        type="date"
        defaultValue={to}
        className="h-8 w-36 text-xs"
        onChange={(e) => push({ to: e.target.value })}
      />

      {/* Search */}
      <Input
        key={`q-${q}`}
        type="search"
        placeholder="Search call ID..."
        defaultValue={q}
        className="h-8 w-44 text-xs"
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => router.push(basePath)}
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}
