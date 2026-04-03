import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export function VapiSetupBanner() {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
          Vapi API key not configured
        </p>
        <p className="text-sm text-muted-foreground">
          A Vapi integration is required for calls and campaigns to work.{' '}
          <Link href="/integrations" className="text-primary font-medium hover:underline">
            Add your Vapi API key
          </Link>
        </p>
      </div>
    </div>
  )
}
