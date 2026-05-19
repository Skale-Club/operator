// Account / company tools.

import type { CopilotToolRegistry, ToolContext, ToolResult } from './types'

const MAX_ROWS = 50

async function queryAccounts(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const search = input.search as string | undefined
  const limit = Math.min(Number(input.limit ?? 25), MAX_ROWS)

  let query = ctx.supabase
    .from('accounts')
    .select('id, name, domain, industry, size, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`name.ilike.${term},domain.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: { accounts: data, count: data?.length ?? 0 } }
}

async function getAccount(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const id = input.id as string
  if (!id) return { success: false, error: 'id required' }
  const { data, error } = await ctx.supabase
    .from('accounts').select('*').eq('id', id).maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: `account ${id} not found` }
  return { success: true, data }
}

async function createAccount(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const name = input.name as string | undefined
  if (!name) return { success: false, error: 'name required' }
  const { data, error } = await ctx.supabase
    .from('accounts')
    .insert({
      org_id: ctx.orgId,
      name,
      domain: (input.domain as string | undefined) ?? null,
      industry: (input.industry as string | undefined) ?? null,
      size: (input.size as string | undefined) ?? null,
      source: 'manual',
      created_by: ctx.userId,
    })
    .select('id, name, domain')
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

async function updateAccount(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const id = input.id as string
  if (!id) return { success: false, error: 'id required' }
  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'domain', 'industry', 'size', 'phone', 'address']) {
    if (input[k] !== undefined) patch[k] = input[k]
  }
  if (Object.keys(patch).length === 0) return { success: false, error: 'no fields to update' }

  const { data, error } = await ctx.supabase
    .from('accounts').update(patch).eq('id', id)
    .select('id, name, domain').maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: `account ${id} not found` }
  return { success: true, data }
}

async function listAccountContacts(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const id = input.account_id as string
  if (!id) return { success: false, error: 'account_id required' }
  const { data, error } = await ctx.supabase
    .from('contacts')
    .select('id, name, email, phone')
    .eq('account_id', id)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)
  if (error) return { success: false, error: error.message }
  return { success: true, data: { contacts: data, count: data?.length ?? 0 } }
}

export const accountTools: CopilotToolRegistry = {
  query_accounts: {
    mode: 'read',
    definition: {
      name: 'query_accounts',
      description: 'Search accounts (companies) by name or domain. Returns up to 50.',
      input_schema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
    handler: queryAccounts,
  },
  get_account: {
    mode: 'read',
    definition: {
      name: 'get_account',
      description: 'Fetch a single account by id.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    handler: getAccount,
  },
  create_account: {
    mode: 'write',
    definition: {
      name: 'create_account',
      description: 'Create a new account (company).',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          industry: { type: 'string' },
          size: { type: 'string' },
        },
        required: ['name'],
      },
    },
    handler: createAccount,
  },
  update_account: {
    mode: 'write',
    definition: {
      name: 'update_account',
      description: 'Patch an account.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          domain: { type: 'string' },
          industry: { type: 'string' },
          size: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: updateAccount,
  },
  list_account_contacts: {
    mode: 'read',
    definition: {
      name: 'list_account_contacts',
      description: 'List contacts linked to an account.',
      input_schema: {
        type: 'object',
        properties: { account_id: { type: 'string' } },
        required: ['account_id'],
      },
    },
    handler: listAccountContacts,
  },
}
