'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useCopilotStore } from '@/stores/copilot-store'
import { CopilotSheet } from './copilot-sheet'

export function CopilotShell() {
  const open = useCopilotStore((s) => s.open)
  const setOpen = useCopilotStore((s) => s.setOpen)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl + I → toggle copilot. Picked because Cmd+K already opens the
      // command palette.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105"
        title="Open Copilot (⌘I)"
        aria-label="Open Copilot"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      <CopilotSheet />
    </>
  )
}
