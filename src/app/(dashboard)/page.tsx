import Link from 'next/link'
import { Bot, MessageSquare, Sparkles, TrendingUp, Users, Zap } from 'lucide-react'
import { getUser } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'

/**
 * MINIMAL HOME DASHBOARD — diagnostic mode.
 *
 * The original home page produced render error digest 1621801304 in
 * production with thousands of `i4 → us` recursive frames in the stack
 * trace. That pattern indicates a structural infinite render loop
 * (Suspense fallback re-throwing, error boundary re-triggering the
 * page, or a provider/effect re-render cascade) rather than a normal
 * async data error.
 *
 * We've replaced the rich dashboard with this minimal version to
 * stabilize production while we bisect the real culprit.
 *
 * Investigation notes live in `.planning/incidents/dashboard-1621801304.md`.
 *
 * To restore the full dashboard, revert this file from git history:
 *   git log -- src/app/(dashboard)/page.tsx
 */
export default async function DashboardPage() {
  let userName = 'there'
  try {
    const user = await getUser()
    if (user?.user_metadata?.full_name && typeof user.user_metadata.full_name === 'string') {
      userName = user.user_metadata.full_name.trim().split(/\s+/)[0]
    } else if (user?.email) {
      userName = user.email.split('@')[0]
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[dashboard:minimal] getUser failed', e)
  }

  const greeting = greetingFor(new Date())

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Overview"
        eyebrowIcon={Sparkles}
        title={`${greeting}, ${userName}.`}
        description="Your workspace is online. Pick a starting point below."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickLink
          icon={MessageSquare}
          title="Inbox"
          description="Conversations across WhatsApp, SMS, and chat."
          href="/chat"
        />
        <QuickLink
          icon={Users}
          title="Contacts"
          description="Your CRM list — search, segment, and import."
          href="/contacts"
        />
        <QuickLink
          icon={TrendingUp}
          title="Pipeline"
          description="Active deals across stages."
          href="/pipeline"
        />
        <QuickLink
          icon={Bot}
          title="Agents"
          description="AI workers handling your conversations."
          href="/agents"
        />
        <QuickLink
          icon={Zap}
          title="Integrations"
          description="WhatsApp, Twilio, Vapi, and more."
          href="/integrations"
        />
      </div>
    </PageContainer>
  )
}

function greetingFor(date: Date): string {
  const h = date.getHours()
  if (h < 6) return 'Good early morning'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function QuickLink({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-[12px] border border-border bg-bg-secondary p-4 shadow-elevation-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevation-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg-tertiary ring-1 ring-border-subtle text-text-secondary group-hover:text-accent group-hover:bg-accent-muted transition-colors duration-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-[12.5px] text-text-tertiary leading-relaxed">
          {description}
        </div>
      </div>
    </Link>
  )
}
