'use client'

// SEED-038: Minimal folder creation dialog.
// Name + optional preset color. A full color/icon picker is intentionally
// out of scope for the initial ship; color presets give the user something
// useful without spinning up a full picker UI.

import * as React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createFolder } from '@/app/(dashboard)/workflows/_actions/folders'

const COLOR_PRESETS: { value: string | null; label: string; swatch: string }[] = [
  { value: null, label: 'Default', swatch: 'bg-text-tertiary' },
  { value: '#6366F1', label: 'Indigo', swatch: 'bg-indigo-500' },
  { value: '#10B981', label: 'Emerald', swatch: 'bg-emerald-500' },
  { value: '#F59E0B', label: 'Amber', swatch: 'bg-amber-500' },
  { value: '#EF4444', label: 'Rose', swatch: 'bg-rose-500' },
  { value: '#8B5CF6', label: 'Violet', swatch: 'bg-violet-500' },
  { value: '#0EA5E9', label: 'Sky', swatch: 'bg-sky-500' },
  { value: '#EC4899', label: 'Pink', swatch: 'bg-pink-500' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId?: string | null
}

export function FolderCreateDialog({ open, onOpenChange, parentId = null }: Props) {
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!open) {
      setName('')
      setColor(null)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const res = await createFolder({ name: name.trim(), color, parent_id: parentId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Folder created')
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Group related workflows. You can drag workflows in and out later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales"
                maxLength={80}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => setColor(p.value)}
                    className={cn(
                      'h-6 w-6 rounded-full ring-2 transition',
                      p.swatch,
                      color === p.value
                        ? 'ring-text-primary'
                        : 'ring-transparent hover:ring-border-subtle',
                    )}
                    aria-label={p.label}
                    title={p.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
