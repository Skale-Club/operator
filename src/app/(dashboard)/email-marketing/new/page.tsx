import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUser } from '@/lib/supabase/server'
import { AiGenerateForm } from '@/components/email-marketing/ai-generate-form'

export default async function NewEmailTemplatePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/email-marketing">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
        </Link>
      </Button>

      <div>
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1">
          <Sparkles className="h-3.5 w-3.5" /> Email Marketing
        </div>
        <h1 className="text-2xl font-semibold">Novo template com IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Descreva o email e a IA vai gerar subject line, preview text e todas as seções HTML prontas para editar.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <AiGenerateForm />
      </div>
    </div>
  )
}
