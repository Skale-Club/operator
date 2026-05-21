'use client'

/**
 * DeletableEdge — custom React Flow edge with a hover-revealed trash button.
 *
 * The button sits at the geometric midpoint of the edge (via getBezierPath's
 * labelX/labelY). It's hidden until the user hovers anywhere over the edge
 * (or over the button itself). Clicking deletes the edge from the flow store.
 *
 * Visual baseline matches the default edge styling configured in
 * flow-canvas.tsx (slate stroke, 1.5px, ArrowClosed marker).
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

import { useFlowStore } from '@/stores/flow-store'
import { cn } from '@/lib/utils'

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const removeEdge = useFlowStore((s) => s.removeEdge)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      {/* Visible edge — slightly thicker / brighter on hover */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? 'rgba(99, 102, 241, 0.9)' : (style?.stroke ?? 'rgba(148, 163, 184, 0.5)'),
          strokeWidth: hovered ? 2 : (style?.strokeWidth ?? 1.5),
          transition: 'stroke 120ms, stroke-width 120ms',
        }}
      />

      {/* Wide invisible interaction layer so the hover area is comfortable */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Trash button at the edge midpoint */}
      <EdgeLabelRenderer>
        <div
          className={cn(
            'absolute pointer-events-auto',
            'transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            onClick={() => removeEdge(id)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-rose-400 shadow-lg hover:bg-bg-tertiary hover:text-rose-300 transition-colors"
            aria-label="Delete connection"
            title="Delete connection"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
