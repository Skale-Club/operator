'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'

interface BaseNodeProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  color: string
  selected?: boolean
  hasInput?: boolean
  hasOutput?: boolean
  hasBranchOutputs?: boolean
}

function BaseNodeImpl({
  icon,
  title,
  subtitle,
  color,
  selected,
  hasInput = true,
  hasOutput = true,
  hasBranchOutputs = false,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm min-w-[200px] transition-all',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div
          className="h-7 w-7 rounded flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{title}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: color, width: 8, height: 8 }}
        />
      )}

      {hasBranchOutputs ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ background: '#10b981', width: 8, height: 8, left: '30%' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ background: '#ef4444', width: 8, height: 8, left: '70%' }}
          />
          <div className="flex justify-between px-3 pb-1 text-[9px] font-medium text-muted-foreground">
            <span>true</span>
            <span>false</span>
          </div>
        </>
      ) : hasOutput ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: color, width: 8, height: 8 }}
        />
      ) : null}
    </div>
  )
}

export const BaseNode = memo(BaseNodeImpl)
