'use client'

// SEED-042 — IntegrationSheet
// Routes between api_key / custom / oauth panel types based on the
// IntegrationDefinition.

import { Sheet, SheetContent } from '@/components/ui/sheet'

import { ApiKeyPanel } from './api-key-panel'
import { OAuthPanel } from './oauth-panel'
import type { IntegrationDefinition, SavedIntegration } from '@/lib/integrations/registry'

interface IntegrationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: IntegrationDefinition | null
  existing?: SavedIntegration
}

export function IntegrationSheet({
  open,
  onOpenChange,
  definition,
  existing,
}: IntegrationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 sm:max-w-[480px]">
        {definition && (
          <PanelRouter
            definition={definition}
            existing={existing}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PanelRouter({
  definition,
  existing,
  onClose,
}: {
  definition: IntegrationDefinition
  existing?: SavedIntegration
  onClose: () => void
}) {
  if (definition.panelType === 'custom' && definition.CustomPanel) {
    const Custom = definition.CustomPanel
    return <Custom definition={definition} existing={existing} onClose={onClose} />
  }
  if (definition.panelType === 'oauth') {
    return <OAuthPanel definition={definition} existing={existing} onClose={onClose} />
  }
  return <ApiKeyPanel definition={definition} existing={existing} onClose={onClose} />
}
