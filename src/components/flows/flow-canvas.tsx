'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFlowStore } from '@/stores/flow-store'
import { nodeTypes } from './nodes'
import { FlowPalette } from './flow-palette'
import { NodeConfigPanel } from './node-config-panel'
import { FlowToolbar } from './flow-toolbar'
import { AiBuilderChat } from './ai-builder-chat'
import type { FlowDefinition, FlowNodeType } from '@/lib/flows/schema'
import { saveWorkflowDefinition } from '@/app/(dashboard)/automations/flows/_actions/workflows'
import { toast } from 'sonner'

interface FlowCanvasProps {
  workflowId: string
  workflowName: string
  initialDefinition: FlowDefinition
}

function CanvasInner({ workflowId, workflowName, initialDefinition }: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const { screenToFlowPosition } = useReactFlow()

  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const onConnect = useFlowStore((s) => s.onConnect)
  const addNode = useFlowStore((s) => s.addNode)
  const setSelected = useFlowStore((s) => s.setSelected)
  const hydrate = useFlowStore((s) => s.hydrate)
  const dirty = useFlowStore((s) => s.dirty)
  const toDefinition = useFlowStore((s) => s.toDefinition)
  const markSaved = useFlowStore((s) => s.markSaved)

  // ── Hydrate on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    hydrate(workflowId, initialDefinition)
  }, [workflowId, initialDefinition, hydrate])

  // ── Autosave on debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(async () => {
      const def = toDefinition()
      const result = await saveWorkflowDefinition(workflowId, def)
      if (!result.ok) {
        toast.error(`Save failed: ${result.error}`)
        return
      }
      markSaved()
    }, 1500)

    return () => clearTimeout(timer)
  }, [dirty, workflowId, toDefinition, markSaved])

  // ── Drag-from-palette → drop onto canvas ────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
    },
    [screenToFlowPosition, addNode],
  )

  return (
    <div className="flex h-full w-full">
      <FlowPalette />

      <div className="flex-1 flex flex-col min-w-0">
        <FlowToolbar
          workflowId={workflowId}
          workflowName={workflowName}
          onToggleAi={() => setAiOpen((v) => !v)}
          aiOpen={aiOpen}
        />
        <div ref={wrapperRef} className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelected(node.id)}
            onPaneClick={() => setSelected(null)}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              pannable
              zoomable
              className="!bg-card !border !border-border"
            />
          </ReactFlow>
        </div>
      </div>

      <NodeConfigPanel />
      <AiBuilderChat workflowId={workflowId} open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
