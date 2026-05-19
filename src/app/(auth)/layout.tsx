import { getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="dark min-h-screen bg-[#08090A] flex">
      {children}
    </div>
  )
}
