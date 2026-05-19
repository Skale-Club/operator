import { getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/landing/landing-page'

export default async function RootPage() {
  const user = await getUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
