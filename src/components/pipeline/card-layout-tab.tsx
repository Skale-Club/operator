'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GripVertical } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updatePipelineCardFields } from '@/app/(dashboard)/pipeline/actions'

interface FieldDef {
  key: string
  label: string
}

const BUILT_IN_FIELDS: FieldDef[] = [
  { key: 'contact_name', label: 'Contact' },
  { key: 'value', label: 'Value' },
  { key: 'days_in_stage', label: 'Time in stage' },
  { key: 'expected_close_date', label: 'Expected close date' },
  { key: 'tags', label: 'Tags' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status' },
  { key: 'assigned_to', label: 'Assigned to' },
]

interface CardLayoutTabProps {
  pipelineId: string
  initialFields: string[]
  customFields?: FieldDef[]
}

interface FieldRowProps {
  fieldKey: string
  label: string
  enabled: boolean
  onToggle: (key: string) => void
}

function FieldRow({ fieldKey, label, enabled, onToggle }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldKey,
    disabled: !enabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-[8px] border border-border-subtle bg-bg-secondary px-2.5 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'text-text-tertiary transition-colors',
          enabled ? 'cursor-grab active:cursor-grabbing hover:text-text-primary' : 'cursor-default opacity-30',
        )}
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <label className="flex flex-1 items-center gap-2 cursor-pointer text-[12.5px] text-text-primary">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onToggle(fieldKey)}
          className="accent-indigo-500 h-3.5 w-3.5"
        />
        {label}
      </label>
    </div>
  )
}

interface CardPreviewProps {
  fields: string[]
  allFields: FieldDef[]
}

function CardPreview({ fields, allFields }: CardPreviewProps) {
  const labelFor = (key: string) => allFields.find((f) => f.key === key)?.label ?? key

  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-secondary px-3 py-2.5 w-[200px] shadow-elevation-sm">
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-full bg-accent-muted flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-accent">JD</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[12px] font-medium text-text-primary leading-tight truncate">
              Deal Title
            </span>
            <div className="h-3.5 w-3.5" />
          </div>
          {fields.includes('contact_name') && (
            <div className="mt-0.5 text-[11px] text-text-tertiary truncate">John Doe</div>
          )}
        </div>
      </div>

      {(fields.includes('value') || fields.includes('days_in_stage')) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {fields.includes('value') && (
            <span className="text-[12px] font-semibold tabular-nums text-text-primary">R$ 5.000</span>
          )}
          {fields.includes('days_in_stage') && (
            <span className="ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-bg-tertiary text-text-tertiary ring-1 ring-border-subtle">
              3d
            </span>
          )}
        </div>
      )}

      {fields.includes('expected_close_date') && (
        <div className="mt-1.5 text-[10.5px] text-text-tertiary">📅 in 5 days</div>
      )}

      {fields.includes('company') && (
        <div className="mt-1.5 text-[10.5px] text-text-tertiary truncate">Acme Corp</div>
      )}

      {fields.includes('status') && (
        <div className="mt-1.5">
          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            Active
          </span>
        </div>
      )}

      {fields.includes('assigned_to') && (
        <div className="mt-1.5 flex items-center gap-1">
          <div className="h-4 w-4 rounded-full bg-accent-muted flex items-center justify-center">
            <span className="text-[8px] font-semibold text-accent">MS</span>
          </div>
          <span className="text-[10.5px] text-text-tertiary">Maria S.</span>
        </div>
      )}

      {fields.includes('tags') && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
            Hot
          </span>
          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
            Q2
          </span>
        </div>
      )}

      {fields.filter((k) => k.startsWith('custom::')).map((k) => {
        const label = labelFor(k)
        return (
          <div key={k} className="mt-1.5 text-[10.5px] text-text-tertiary truncate">
            {label}: Sample value
          </div>
        )
      })}
    </div>
  )
}

export function CardLayoutTab({ pipelineId, initialFields, customFields = [] }: CardLayoutTabProps) {
  const router = useRouter()
  const allFields: FieldDef[] = [...BUILT_IN_FIELDS, ...customFields]

  const [enabledKeys, setEnabledKeys] = React.useState<string[]>(initialFields)
  const [isPending, startTransition] = React.useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleToggle(key: string) {
    setEnabledKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      return [...prev, key]
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setEnabledKeys((prev) => {
      const oldIdx = prev.indexOf(String(active.id))
      const newIdx = prev.indexOf(String(over.id))
      if (oldIdx < 0 || newIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(oldIdx, 1)
      next.splice(newIdx, 0, moved)
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updatePipelineCardFields(pipelineId, enabledKeys)
      if (res && 'error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success('Card layout saved')
        router.refresh()
      }
    })
  }

  const orderedEnabledKeys = enabledKeys
  const disabledFields = allFields.filter((f) => !enabledKeys.includes(f.key))
  const builtInDisabled = disabledFields.filter((f) => !f.key.startsWith('custom::'))
  const customDisabled = disabledFields.filter((f) => f.key.startsWith('custom::'))

  const orderedRows: FieldDef[] = [
    ...enabledKeys.map((k) => allFields.find((f) => f.key === k)).filter(Boolean) as FieldDef[],
    ...builtInDisabled,
    ...customDisabled,
  ]

  const builtInRows = orderedRows.filter((f) => !f.key.startsWith('custom::'))
  const customRows = orderedRows.filter((f) => f.key.startsWith('custom::'))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-text-secondary">
          Configure which fields appear on kanban cards.
        </p>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        {/* Field list */}
        <div className="space-y-1.5">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedEnabledKeys} strategy={verticalListSortingStrategy}>
              {builtInRows.map((f) => (
                <FieldRow
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  enabled={enabledKeys.includes(f.key)}
                  onToggle={handleToggle}
                />
              ))}
            </SortableContext>
          </DndContext>

          {customRows.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <span className="text-[11px] uppercase tracking-wide text-text-tertiary">
                  Custom fields
                </span>
              </div>
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedEnabledKeys} strategy={verticalListSortingStrategy}>
                  {customRows.map((f) => (
                    <FieldRow
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      enabled={enabledKeys.includes(f.key)}
                      onToggle={handleToggle}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>

        {/* Live preview */}
        <div className="flex flex-col items-start gap-2">
          <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Preview</span>
          <CardPreview fields={enabledKeys} allFields={allFields} />
        </div>
      </div>
    </div>
  )
}
