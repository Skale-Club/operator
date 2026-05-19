import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail, Plus, Sparkles, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUser } from '@/lib/supabase/server'
import { getEmailTemplates } from './_actions/templates'
import { TemplateCard } from '@/components/email-marketing/template-card'

export default async function EmailMarketingPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const result = await getEmailTemplates()
  const templates = result.ok ? result.data : []

  const counts = {
    total: templates.length,
    draft: templates.filter((t) => t.status === 'draft').length,
    ready: templates.filter((t) => t.status === 'ready').length,
  }

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1">
            <Mail className="h-3.5 w-3.5" /> Email Marketing
          </div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e gerencie templates de email com IA.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href="/email-marketing/sections">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Seções globais
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/email-marketing/new">
              <Sparkles className="h-3.5 w-3.5" /> Novo com IA
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {counts.total > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{counts.total} template{counts.total !== 1 ? 's' : ''}</span>
          <span className="text-yellow-400">{counts.draft} rascunho{counts.draft !== 1 ? 's' : ''}</span>
          <span className="text-emerald-400">{counts.ready} pronto{counts.ready !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Grid */}
      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Nenhum template ainda</p>
          <p className="text-sm text-muted-foreground mb-4">
            Crie seu primeiro email de marketing com a ajuda da IA.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/email-marketing/new">
              <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  )
}
