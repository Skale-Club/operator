'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { insertDocument, addUrlDocument } from '@/actions/knowledge'

type UploadStatus = 'idle' | 'uploading' | 'error' | 'success'

function getSourceType(mimeType: string, fileName: string): 'pdf' | 'text' | 'csv' {
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf'
  if (mimeType === 'text/csv' || fileName.endsWith('.csv')) return 'csv'
  return 'text'
}

export function UploadForm() {
  const [fileStatus, setFileStatus] = useState<UploadStatus>('idle')
  const [urlStatus, setUrlStatus] = useState<UploadStatus>('idle')
  const [fileError, setFileError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isPendingFile, startFileTransition] = useTransition()
  const [isPendingUrl, startUrlTransition] = useTransition()

  async function handleFileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement
    const file = fileInput.files?.[0]
    if (!file) return

    setFileStatus('uploading')
    setFileError(null)

    try {
      // Step 1: Upload file via Route Handler
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Upload failed')
      }
      const { path, name } = await res.json()

      // Step 2: Register document row
      startFileTransition(async () => {
        await insertDocument(path, name, getSourceType(file.type, file.name))
        setFileStatus('success')
        form.reset()
        // Refresh page to show new document in list
        window.location.reload()
      })
    } catch (err) {
      setFileStatus('error')
      setFileError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function handleUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const urlInput = form.elements.namedItem('url') as HTMLInputElement
    const url = urlInput.value.trim()
    if (!url) return

    setUrlStatus('uploading')
    setUrlError(null)

    startUrlTransition(async () => {
      try {
        await addUrlDocument(url)
        setUrlStatus('success')
        form.reset()
        window.location.reload()
      } catch (err) {
        setUrlStatus('error')
        setUrlError(err instanceof Error ? err.message : 'Failed to add URL')
      }
    })
  }

  return (
    <div className="rounded-lg border p-5 space-y-6">
      <h2 className="text-sm font-semibold">Add Document</h2>

      {/* File Upload */}
      <form onSubmit={handleFileUpload} className="space-y-3">
        <div>
          <Label htmlFor="file" className="text-xs font-medium">Upload File</Label>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, TXT, or CSV — max 10MB</p>
        </div>
        <div className="flex gap-2">
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.txt,.csv,text/plain,text/csv,application/pdf"
            className="text-xs"
            required
          />
          <Button
            type="submit"
            size="sm"
            disabled={fileStatus === 'uploading' || isPendingFile}
          >
            {fileStatus === 'uploading' || isPendingFile ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
        {fileStatus === 'error' && (
          <p className="text-xs text-destructive">{fileError}</p>
        )}
        {fileStatus === 'success' && (
          <p className="text-xs text-green-600">File uploaded — processing started.</p>
        )}
      </form>

      <div className="border-t" />

      {/* URL Addition */}
      <form onSubmit={handleUrlSubmit} className="space-y-3">
        <div>
          <Label htmlFor="url" className="text-xs font-medium">Add Website URL</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Content will be extracted and vectorized</p>
        </div>
        <div className="flex gap-2">
          <Input
            id="url"
            name="url"
            type="url"
            placeholder="https://example.com/faq"
            className="text-xs"
            required
          />
          <Button
            type="submit"
            size="sm"
            disabled={urlStatus === 'uploading' || isPendingUrl}
          >
            {urlStatus === 'uploading' || isPendingUrl ? 'Adding...' : 'Add URL'}
          </Button>
        </div>
        {urlStatus === 'error' && (
          <p className="text-xs text-destructive">{urlError}</p>
        )}
        {urlStatus === 'success' && (
          <p className="text-xs text-green-600">URL added — processing started.</p>
        )}
      </form>
    </div>
  )
}
