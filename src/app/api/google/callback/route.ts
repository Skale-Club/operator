import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { encrypt } from '@/lib/crypto'
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from '@/lib/google-contacts/oauth'
import { createClient, getUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const STATE_COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 0,
}

function buildRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

async function clearStateCookie() {
  const jar = await cookies()
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, '', STATE_COOKIE_CLEAR_OPTIONS)
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getUser()

  if (!user) {
    return buildRedirect(request, '/login')
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const jar = await cookies()
  const storedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value

  await clearStateCookie()

  // User denied consent on Google's side
  if (errorParam) {
    return buildRedirect(request, `/integrations?error=${encodeURIComponent(errorParam)}`)
  }

  if (!code) {
    return buildRedirect(request, '/integrations?error=missing_code')
  }

  if (!state || !storedState || state !== storedState) {
    return buildRedirect(request, '/integrations?error=csrf')
  }

  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  if (!orgId) {
    return buildRedirect(request, '/integrations?error=no_org')
  }

  try {
    const { access_token, refresh_token, expires_in } = await exchangeCodeForTokens(code)
    const googleEmail = await fetchGoogleUserEmail(access_token)

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString()

    const tokenBundle = JSON.stringify({
      access_token,
      refresh_token,
      token_expiry: tokenExpiry,
      google_email: googleEmail,
    })

    const encryptedBundle = await encrypt(tokenBundle)

    const { error } = await supabase.from('integrations').upsert(
      {
        organization_id: orgId,
        provider: 'google_contacts',
        name: `Google Contacts (${googleEmail})`,
        encrypted_api_key: encryptedBundle,
        key_hint: googleEmail,
        location_id: null,
        config: {},
        is_active: true,
      },
      { onConflict: 'organization_id,provider' }
    )

    if (error) {
      throw new Error(error.message)
    }

    return buildRedirect(request, '/integrations?google_connected=true')
  } catch {
    return buildRedirect(request, '/integrations?error=oauth_exchange')
  }
}
