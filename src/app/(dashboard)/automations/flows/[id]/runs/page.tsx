import { redirect } from 'next/navigation'
export default async function FlowRunsLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/workflows/flows/${id}/runs`)
}
