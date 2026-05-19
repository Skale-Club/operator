'use client'

import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useFlowStore } from '@/stores/flow-store'

const TRIGGER_EVENTS = [
  'manual',
  'cron',
  'webhook.custom',
  'vapi.call.ended',
  'manychat.inbound',
  'meta.message.received',
  'chat.message.received',
  'booking.created',
  'contact.created',
]

const ACTION_TYPES = [
  'http_request',
  'send_whatsapp',
  'send_email',
  'create_contact',
  'create_task',
  'create_note',
  'update_pipeline_stage',
  'query_knowledge',
  'execute_flow',
]

export function NodeConfigPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const node = useFlowStore((s) =>
    selectedNodeId ? s.nodes.find((n) => n.id === selectedNodeId) ?? null : null,
  )
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const removeNode = useFlowStore((s) => s.removeNode)
  const setSelected = useFlowStore((s) => s.setSelected)

  if (!node) {
    return (
      <div className="w-72 border-l border-border bg-card shrink-0 flex flex-col">
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Select a node to configure it.
        </div>
      </div>
    )
  }

  const flow = node.data.flowData

  return (
    <div className="w-72 border-l border-border bg-card shrink-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {node.type} node
          </p>
          <p className="text-xs font-medium truncate">{flow.label}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => removeNode(node.id)}
            title="Delete node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setSelected(null)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Common: label */}
        <div className="space-y-1">
          <Label className="text-[11px]">Label</Label>
          <Input
            value={flow.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value } as Partial<typeof flow>)}
            className="h-8 text-xs"
          />
        </div>

        {/* Type-specific */}
        {flow.kind === 'trigger' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Event type</Label>
              <Select
                value={flow.event_type}
                onValueChange={(v) => updateNodeData(node.id, { event_type: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((ev) => (
                    <SelectItem key={ev} value={ev} className="text-xs">{ev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {flow.event_type === 'cron' && (
              <div className="space-y-1">
                <Label className="text-[11px]">Cron schedule</Label>
                <Input
                  value={flow.schedule_cron ?? ''}
                  onChange={(e) => updateNodeData(node.id, { schedule_cron: e.target.value })}
                  placeholder="0 9 * * 1"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </>
        )}

        {flow.kind === 'action' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Action type</Label>
              <Select
                value={flow.action_type}
                onValueChange={(v) => updateNodeData(node.id, { action_type: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((at) => (
                    <SelectItem key={at} value={at} className="text-xs">{at}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Config (JSON)</Label>
              <Textarea
                value={JSON.stringify(flow.config ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    updateNodeData(node.id, { config: JSON.parse(e.target.value) })
                  } catch {
                    // ignore parse errors while typing
                  }
                }}
                rows={6}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Credential ref</Label>
              <Input
                value={flow.credential_ref ?? ''}
                onChange={(e) => updateNodeData(node.id, { credential_ref: e.target.value })}
                placeholder="ghl_main"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {flow.kind === 'condition' && (
          <div className="space-y-1">
            <Label className="text-[11px]">Expression (JSONata)</Label>
            <Textarea
              value={flow.expression}
              onChange={(e) => updateNodeData(node.id, { expression: e.target.value })}
              rows={4}
              className="text-xs font-mono resize-none"
              placeholder="trigger.payload.amount > 100"
            />
            <p className="text-[10px] text-muted-foreground">
              Evaluates to true/false. true → green output, false → red.
            </p>
          </div>
        )}

        {flow.kind === 'wait' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Mode</Label>
              <Select
                value={flow.mode}
                onValueChange={(v) => updateNodeData(node.id, { mode: v as 'sleep' | 'wait_for_event' })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sleep" className="text-xs">Sleep (duration)</SelectItem>
                  <SelectItem value="wait_for_event" className="text-xs">Wait for event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {flow.mode === 'sleep' ? (
              <div className="space-y-1">
                <Label className="text-[11px]">Duration</Label>
                <Input
                  value={flow.duration ?? ''}
                  onChange={(e) => updateNodeData(node.id, { duration: e.target.value })}
                  placeholder="1h, 30m, 24h, 7d"
                  className="h-8 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[11px]">Timeout</Label>
                <Input
                  value={flow.timeout ?? ''}
                  onChange={(e) => updateNodeData(node.id, { timeout: e.target.value })}
                  placeholder="7d"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </>
        )}

        {flow.kind === 'agent' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Agent ID (optional)</Label>
              <Input
                value={flow.agent_id ?? ''}
                onChange={(e) => updateNodeData(node.id, { agent_id: e.target.value })}
                placeholder="agent_xxx"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">System prompt</Label>
              <Textarea
                value={flow.system_prompt}
                onChange={(e) => updateNodeData(node.id, { system_prompt: e.target.value })}
                rows={4}
                className="text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Max steps</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={flow.max_steps}
                onChange={(e) => updateNodeData(node.id, { max_steps: Number(e.target.value) || 10 })}
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {flow.kind === 'end' && (
          <p className="text-xs text-muted-foreground">
            Terminates this branch of the flow. No configuration needed.
          </p>
        )}

        {/* Node id (read-only) */}
        <div className="space-y-1 pt-2 border-t border-border">
          <Label className="text-[10px] text-muted-foreground">Node ID</Label>
          <code className="block text-[10px] font-mono text-muted-foreground break-all">
            {node.id}
          </code>
        </div>
      </div>
    </div>
  )
}
