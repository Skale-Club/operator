import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getLogs, getToolOptions } from './actions'
import { LogsTable } from '@/components/tools/logs-table'
import { LogsFilters } from '@/components/tools/logs-filters'
import type { LogStatus } from './actions'

const BASE_PATH = '/tools/logs'

function buildPageUrl(
  page: number,
  params: { status?: string; tool?: string; from?: string; to?: string; q?: string }
): string {
  const p = new URLSearchParams()
  if (params.status && params.status !== 'all') p.set('status', params.status)
  if (params.tool) p.set('tool', params.tool)
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  if (params.q) p.set('q', params.q)
  p.set('page', String(page))
  return `${BASE_PATH}?${p.toString()}`
}

export default async function ToolLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const status = params.status as string | undefined
  const toolId = params.tool as string | undefined
  const from = params.from as string | undefined
  const to = params.to as string | undefined
  const q = params.q as string | undefined

  const [{ logs, total, pageCount }, toolOptions] = await Promise.all([
    getLogs({
      status: status as LogStatus | 'all' | undefined,
      toolConfigId: toolId,
      from,
      to,
      q,
      page,
    }),
    getToolOptions(),
  ])

  const filterParams = { status, tool: toolId, from, to, q }
  const prevHref = page > 1 ? buildPageUrl(page - 1, filterParams) : null
  const nextHref = page < pageCount ? buildPageUrl(page + 1, filterParams) : null

  return (
    <div className="p-6 space-y-5">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tools
      </Link>

      <div>
        <h1 className="text-lg font-semibold">Execution Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All tool executions across your assistants.{total > 0 ? ` ${total} total.` : ''}
        </p>
      </div>

      <LogsFilters
        toolOptions={toolOptions}
        showToolFilter
        basePath={BASE_PATH}
        status={status}
        tool={toolId}
        from={from}
        to={to}
        q={q}
      />

      <LogsTable
        logs={logs}
        total={total}
        page={page}
        pageCount={pageCount}
        showToolColumn
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </div>
  )
}
