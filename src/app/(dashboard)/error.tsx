'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Dashboard segment error boundary.
 * Catches any Server Component render error that escapes the page-level
 * guards and offers a soft recovery instead of the bare Next.js error page.
 *
 * Next.js routes any uncaught error in (dashboard)/** here (client component).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the digest in the browser console for production debugging.
    // The original error message is stripped on prod builds, but the digest
    // can be cross-referenced with server logs.
    // eslint-disable-next-line no-console
    console.error('[dashboard error boundary]', { digest: error.digest, message: error.message })
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-muted)] text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-[20px] font-semibold tracking-tight text-text-primary">
        Something went off the rails
      </h1>
      <p className="max-w-md text-[13.5px] text-text-secondary">
        We hit an unexpected error rendering this page. The team has been notified —
        try refreshing in a moment.
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-text-tertiary">digest: {error.digest}</p>
      )}
      <Button onClick={reset} size="sm" variant="secondary">
        <RotateCcw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  )
}
