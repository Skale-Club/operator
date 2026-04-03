import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentList } from '@/components/knowledge/document-list'
import { UploadForm } from '@/components/knowledge/upload-form'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">
          Upload documents or add URLs to answer knowledge queries during live calls.
        </p>
      </div>
      <div className="grid gap-6">
        <UploadForm />
        <DocumentList documents={documents ?? []} />
      </div>
    </div>
  )
}
