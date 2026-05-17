import Link from 'next/link'
import { MessageSquarePlus, UserPlus, TrendingUp, Sparkles, Wallet } from 'lucide-react'

import { createClient, getUser } from '@/lib/supabase/server'
import { StatusPill } from '@/components/design-system/status-pill'

/**
 * Hero / overview row for the home dashboard.
 *
 * Shows a greeting, today's agent spend, a workspace health pill, and
 * three quick-action chips. Server component — fetches its data inline.
 * Any failure is caught by the wrapping WidgetErrorBoundary; the catch
 * here only logs and degrades gracefully (no throw).
 */
export async function HeroSection() {
  let userName = 'there'
  let costToday: number | null = null
  let dailyCap: number | null = null
  let healthLabel = 'All systems operational'
  let healthTone: 'live' | 'warning' | 'danger' | 'idle' = 'live'

  try {
    const user = await getUser()
    if (user?.user_metadata?.full_name && typeof user.user_metadata.full_name === 'string') {
      userName = user.user_metadata.full_name.trim().split(/\s+/)[0]
    } else if (user?.email) {
      userName = user.email.split('@')[0]
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard:hero] getUser failed', err)
  }

  // Cost today — sum agent_invocations.cost_usd for today
  try {
    const supabase = await createClient()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: rows } = await supabase
      .from('agent_invocations')
      .select('cost_usd')
      .not('cost_usd', 'is', null)
      .gte('created_at', startOfDay.toISOString())

    costToday = (rows ?? []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)

    // Daily cap from org row
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (orgId) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('daily_cost_cap_usd_override')
        .eq('id', orgId as string)
        .maybeSingle()
      const envCap = parseFloat(process.env.AGENT_DAILY_COST_CAP_USD ?? '50.00')
      dailyCap =
        orgRow?.daily_cost_cap_usd_override !== null && orgRow?.daily_cost_cap_usd_override !== undefined
          ? Number(orgRow.daily_cost_cap_usd_override)
          : envCap
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard:hero] cost lookup failed', err)
  }

  // Workspace health — count disconnected integrations
  try {
    const supabase = await createClient()
    const [{ data: evos }, { data: ints }] = [
      await supabase.from('evolution_instances').select('status').eq('is_active', true),
      await supabase.from('integrations').select('id, is_active'),
    ]

    const evoDisconnected = (evos ?? []).filter((e) => e.status === 'disconnected').length
    const totalConnected = (ints ?? []).filter((i) => i.is_active).length + (evos ?? []).filter((e) => e.status === 'connected').length

    if (evoDisconnected > 0) {
      healthLabel = `${evoDisconnected} integration${evoDisconnected === 1 ? '' : 's'} disconnected`
      healthTone = 'warning'
    } else if (totalConnected === 0) {
      healthLabel = 'No channels connected yet'
      healthTone = 'idle'
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard:hero] health lookup failed', err)
  }

  const greeting = greetingFor(new Date())
  const pct = costToday !== null && dailyCap && dailyCap > 0 ? Math.min(100, Math.round((costToday / dailyCap) * 100)) : 0

  return (
    <div className="animate-fade-in rounded-[12px] border border-border bg-bg-secondary p-6 shadow-elevation-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Overview</span>
          </div>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            {greeting}, {userName}.
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={healthTone}>{healthLabel}</StatusPill>
            {costToday !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-border-subtle bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-secondary tabular">
                <Wallet className="h-3 w-3 text-text-tertiary" />
                {`$${costToday.toFixed(2)} spent today`}
                {dailyCap && dailyCap > 0 && (
                  <span className="text-text-tertiary">{` · ${pct}% of $${dailyCap.toFixed(0)} cap`}</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickChip href="/chat" icon={MessageSquarePlus} label="New conversation" />
          <QuickChip href="/contacts/new" icon={UserPlus} label="New contact" />
          <QuickChip href="/pipeline" icon={TrendingUp} label="New deal" />
        </div>
      </div>

      {costToday !== null && dailyCap && dailyCap > 0 && (
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function greetingFor(date: Date): string {
  const h = date.getHours()
  if (h < 6) return 'Good early morning'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function QuickChip({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-[6px] border border-border-subtle bg-bg-tertiary px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-tertiary/70 hover:text-text-primary hover:shadow-elevation-sm"
    >
      <Icon className="h-3.5 w-3.5 text-text-tertiary group-hover:text-accent" />
      <span>{label}</span>
    </Link>
  )
}
