import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { SeoSnapshot } from '@/app/(admin)/admin/_actions/get-platform-dashboard'

function Check({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs font-medium ${ok ? 'text-emerald-500' : 'text-amber-500'}`}>
      {ok ? '✓' : '!'}
    </span>
  )
}

export function LpStatusWidget({ snapshot }: { snapshot: SeoSnapshot | null }) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <p className="text-sm font-semibold text-text-primary">LP &amp; SEO Status</p>
        </CardHeader>
        <Separator className="bg-border-subtle" />
        <CardContent className="p-4">
          <p className="text-sm text-text-secondary">SEO config not found.</p>
          <Link href="/admin/seo" className="text-xs text-accent hover:underline mt-1 inline-block">Configure →</Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">LP &amp; SEO Status</p>
        <Link href="/admin/seo" className="text-xs text-accent hover:underline flex items-center gap-1">
          Edit <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="p-4 space-y-3">
        <div className="rounded-md border border-border bg-bg-primary p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            {snapshot.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snapshot.favicon_url} alt="" className="h-3.5 w-3.5 rounded-sm object-cover" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-sm bg-bg-tertiary" />
            )}
            <span>xphere.app</span>
          </div>
          <p className="text-sm font-medium text-blue-400 truncate">{snapshot.site_title || 'Untitled'}</p>
          <p className="text-xs text-text-secondary line-clamp-2">{snapshot.description || 'No description.'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Check ok={snapshot.site_title.length <= 60 && snapshot.site_title.length > 0} />
            Title ({snapshot.site_title.length}/60)
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Check ok={snapshot.description.length >= 10 && snapshot.description.length <= 160} />
            Desc ({snapshot.description.length}/160)
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Check ok={!!snapshot.og_image_url} />
            OG image
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Check ok={!!snapshot.favicon_url} />
            Favicon
          </div>
        </div>

        <p className="text-xs text-text-tertiary">
          Updated {new Date(snapshot.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </CardContent>
    </Card>
  )
}
