import { redirect } from 'next/navigation'
export default async function ToolLegacyRedirect({
  params,
}: {
  params: Promise<{ toolConfigId: string }>
}) {
  const { toolConfigId } = await params
  redirect(`/workflows/${toolConfigId}`)
}
