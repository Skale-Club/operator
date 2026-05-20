'use server'

import { createServiceRoleClient } from '@/lib/supabase/admin'

export type RecentOrg = {
  id: string
  name: string
  slug: string
  is_active: boolean
  members_count: number
  created_at: string
}

export type TopOrg = {
  id: string
  name: string
  activity_score: number
}

export type FlagAdoption = {
  key: string
  label: string
  count: number
  total: number
}

export type WorkflowStats = {
  total: number
  succeeded: number
  failed: number
}

export type SeoSnapshot = {
  site_title: string
  description: string
  favicon_url: string | null
  og_image_url: string | null
  updated_at: string
}

export type PlatformDashboard = {
  kpis: {
    total_orgs: number
    active_orgs: number
    new_orgs_30d: number
    total_members: number
    calls_30d: number
    calls_prev_30d: number
    conversations_30d: number
    conversations_prev_30d: number
    total_contacts: number
  }
  recent_orgs: RecentOrg[]
  top_orgs: TopOrg[]
  flag_adoption: FlagAdoption[]
  workflow_stats: WorkflowStats
  active_campaigns: number
  seo_snapshot: SeoSnapshot | null
}

export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  const admin = createServiceRoleClient()
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const d7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    orgsAll,
    membersCount,
    contactsCount,
    calls30,
    callsPrev30,
    convs30,
    convsPrev30,
    orgsRecent,
    orgsTop,
    workflowStats,
    campaignsActive,
    seoRow,
  ] = await Promise.all([
    admin.from('organizations').select('id, name, slug, is_active, created_at, settings'),
    admin.from('org_members').select('*', { count: 'exact', head: true }),
    admin.from('contacts').select('*', { count: 'exact', head: true }),
    admin.from('calls').select('*', { count: 'exact', head: true }).gte('created_at', d30),
    admin.from('calls').select('*', { count: 'exact', head: true }).gte('created_at', d60).lt('created_at', d30),
    admin.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', d30),
    admin.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', d60).lt('created_at', d30),
    admin.from('organizations').select('id, name, slug, is_active, created_at').order('created_at', { ascending: false }).limit(5),
    admin.from('organizations').select('id, name'),
    admin.from('workflow_runs').select('status').gte('started_at', d7),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'in_progress' as const),
    admin.from('seo_config').select('site_title, description, favicon_url, og_image_url, updated_at').limit(1).maybeSingle(),
  ])

  const allOrgs = orgsAll.data ?? []
  const totalOrgs = allOrgs.length
  const activeOrgs = allOrgs.filter(o => o.is_active).length
  const newOrgs30d = allOrgs.filter(o => o.created_at >= d30).length

  // Recent orgs with member count
  const recentWithCounts = await Promise.all(
    (orgsRecent.data ?? []).map(async (org) => {
      const { count } = await admin.from('org_members').select('*', { count: 'exact', head: true }).eq('organization_id', org.id)
      return { ...org, members_count: count ?? 0 }
    })
  )

  // Top orgs by activity: calls + conversations
  const topOrgsRaw = orgsTop.data ?? []
  const topWithActivity = await Promise.all(
    topOrgsRaw.map(async (org) => {
      const [c, cv] = await Promise.all([
        admin.from('calls').select('*', { count: 'exact', head: true }).eq('organization_id', org.id),
        admin.from('conversations').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      ])
      return { id: org.id, name: org.name, activity_score: (c.count ?? 0) + (cv.count ?? 0) }
    })
  )
  const topOrgs = topWithActivity.sort((a, b) => b.activity_score - a.activity_score).slice(0, 5)

  // Flag adoption
  const flagKeys = [
    { key: 'ai_calling_enabled', label: 'AI Calling' },
    { key: 'bulk_import_enabled', label: 'Bulk Import' },
    { key: 'advanced_pipeline_enabled', label: 'Advanced Pipeline' },
  ]
  const flagAdoption: FlagAdoption[] = flagKeys.map(({ key, label }) => ({
    key,
    label,
    count: allOrgs.filter(o => {
      const s = o.settings as Record<string, unknown>
      return Boolean(s?.[key])
    }).length,
    total: totalOrgs,
  }))

  // Workflow stats
  const runs = workflowStats.data ?? []
  const wfStats: WorkflowStats = {
    total: runs.length,
    succeeded: runs.filter(r => r.status === 'completed' || r.status === 'succeeded').length,
    failed: runs.filter(r => r.status === 'failed').length,
  }

  const seo = seoRow.data as unknown as Record<string, string | null> | null
  const seoSnapshot: SeoSnapshot | null = seo ? {
    site_title: seo.site_title ?? '',
    description: seo.description ?? '',
    favicon_url: seo.favicon_url ?? null,
    og_image_url: seo.og_image_url ?? null,
    updated_at: seo.updated_at ?? '',
  } : null

  return {
    kpis: {
      total_orgs: totalOrgs,
      active_orgs: activeOrgs,
      new_orgs_30d: newOrgs30d,
      total_members: membersCount.count ?? 0,
      calls_30d: calls30.count ?? 0,
      calls_prev_30d: callsPrev30.count ?? 0,
      conversations_30d: convs30.count ?? 0,
      conversations_prev_30d: convsPrev30.count ?? 0,
      total_contacts: contactsCount.count ?? 0,
    },
    recent_orgs: recentWithCounts,
    top_orgs: topOrgs,
    flag_adoption: flagAdoption,
    workflow_stats: wfStats,
    active_campaigns: campaignsActive.count ?? 0,
    seo_snapshot: seoSnapshot,
  }
}
