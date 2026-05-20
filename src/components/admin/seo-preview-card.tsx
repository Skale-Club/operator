import type { SeoConfig } from '@/app/(admin)/admin/_actions/seo-config'

function HealthBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
      ok
        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    }`}>
      {ok ? '✓' : '!'} {label}
    </span>
  )
}

export function SeoPreviewCard({ config }: { config: SeoConfig }) {
  const titleOk = config.site_title.length > 0 && config.site_title.length <= 60
  const descOk = config.description.length >= 10 && config.description.length <= 160
  const ogOk = !!config.og_image_url
  const faviconOk = !!config.favicon_url

  return (
    <div className="mb-6 rounded-lg border border-border-subtle bg-bg-secondary p-4 space-y-3">
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Search preview</p>

      <div className="rounded-md border border-border bg-bg-primary p-3 space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          {config.favicon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.favicon_url} alt="" className="h-4 w-4 rounded-sm object-cover" />
          ) : (
            <div className="h-4 w-4 rounded-sm bg-bg-tertiary" />
          )}
          <span>xphere.app</span>
        </div>
        <p className="text-sm font-medium text-blue-400 hover:underline truncate">
          {config.site_title || 'Untitled'}
        </p>
        <p className="text-xs text-text-secondary line-clamp-2">
          {config.description || 'No description set.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <HealthBadge ok={titleOk} label={`Title ${config.site_title.length}/60`} />
        <HealthBadge ok={descOk} label={`Desc ${config.description.length}/160`} />
        <HealthBadge ok={ogOk} label="OG image" />
        <HealthBadge ok={faviconOk} label="Favicon" />
      </div>

      {config.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {config.keywords.map(k => (
            <span key={k} className="rounded-full border border-border bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
