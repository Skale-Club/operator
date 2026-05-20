'use client'

import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AdminSaveBarProps {
  isDirty: boolean
  isPending: boolean
  onSave?: () => void   // omit when used inside a <form> (type="submit")
  asSubmit?: boolean    // true → renders a submit button instead of onClick
  label?: string
}

export function AdminSaveBar({
  isDirty,
  isPending,
  onSave,
  asSubmit = false,
  label = 'Save changes',
}: AdminSaveBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 transition-all duration-200 ease-out',
        isDirty
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none',
      )}
    >
      <Button
        type={asSubmit ? 'submit' : 'button'}
        onClick={!asSubmit ? onSave : undefined}
        disabled={isPending}
        size="default"
        className="shadow-lg shadow-primary/20 h-10 px-5 gap-2"
      >
        <Save className="h-4 w-4" />
        {isPending ? 'Saving…' : label}
      </Button>
    </div>
  )
}
