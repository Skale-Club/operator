import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getAccountDetail } from './actions'
import { AccountDetailHeader } from '@/components/accounts/account-detail-header'
import { AccountContactsTab } from '@/components/accounts/account-contacts-tab'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params
  const result = await getAccountDetail(id)
  if (!result.ok) notFound()
  const { account, contacts } = result.data

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/accounts">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Companies
        </Link>
      </Button>

      <AccountDetailHeader account={account} />

      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts">
          <AccountContactsTab contacts={contacts} accountId={id} />
        </TabsContent>
        <TabsContent value="opportunities">
          {/* Plan 67-02 */}
          <p className="text-text-tertiary text-[13px] py-8 text-center">Coming in next plan</p>
        </TabsContent>
        <TabsContent value="activities">
          {/* Plan 67-02 */}
          <p className="text-text-tertiary text-[13px] py-8 text-center">Coming in next plan</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
