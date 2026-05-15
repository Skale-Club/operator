// src/lib/automations/ghl-reengagement/render-template.ts
// Phase 32 (v1.9): substitutes {{first_name}} in the SMS template.
// Only one placeholder is supported (locked: "no advanced template substitution").

const FALLBACK_NAME = 'amigo(a)'
const FIRST_NAME_PATTERN = /\{\{\s*first_name\s*\}\}/g

export function renderMessage(
  template: string,
  firstName: string | null | undefined,
): string {
  const trimmed = (firstName ?? '').trim()
  const name = trimmed.length > 0 ? trimmed : FALLBACK_NAME
  return template.replace(FIRST_NAME_PATTERN, name)
}
