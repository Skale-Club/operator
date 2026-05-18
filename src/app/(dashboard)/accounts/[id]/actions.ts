'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import {
  okResult,
  errResult,
  type ActionResult,
  type AccountRow,
} from '@/lib/accounts'
import type { Database } from '@/types/database'

export type ContactRow = Database['public']['Tables']['contacts']['Row']

export async function getAccountDetail(id: string): Promise<
  ActionResult<{
    account: AccountRow
    contacts: ContactRow[]
  }>
> {
  const user = await getUser()
  if (!user) return errResult('not_authenticated')

  const supabase = await createClient()

  const [accountResult, contactsResult] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('contacts')
      .select('id, name, phone, email, company, created_at, org_id, notes, tags, custom_fields, source, external_id, account_id, created_by, updated_at')
      .eq('account_id', id)
      .order('name', { ascending: true }),
  ])

  if (accountResult.error) return errResult(accountResult.error.message, accountResult.error)
  if (!accountResult.data) return errResult('not_found')
  if (contactsResult.error) return errResult(contactsResult.error.message, contactsResult.error)

  return okResult({
    account: accountResult.data as AccountRow,
    contacts: (contactsResult.data ?? []) as ContactRow[],
  })
}
