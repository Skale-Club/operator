'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  name: string
  color: string
  onRemove?: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function TagBadge({ name, color, onRemove, size = 'sm', className }: TagBadgeProps) {
  const bg = `${color}22`
  const border = `${color}44`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        className,
      )}
      style={{ backgroundColor: bg, borderColor: border, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity"
          style={{ color }}
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}
