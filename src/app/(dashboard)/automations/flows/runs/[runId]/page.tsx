import { redirect } from 'next/navigation'
export default async function RunDetailLegacyRedirect({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  redirect(`/workflows/flows/runs/${runId}`)
}
