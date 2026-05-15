// tests/ghl-render-template.test.ts
// Phase 32 — REENG-08 coverage.
// GREEN as of Plan 02 (src/lib/automations/ghl-reengagement/render-template.ts shipped).

import { describe, it, expect } from 'vitest'
import { renderMessage } from '@/lib/automations/ghl-reengagement/render-template'

describe('renderMessage (REENG-08)', () => {
  it('replaces {{first_name}} with the provided firstName', () => {
    expect(renderMessage('Olá {{first_name}}, sentimos sua falta!', 'Maria'))
      .toBe('Olá Maria, sentimos sua falta!')
  })

  it('replaces multiple occurrences of {{first_name}}', () => {
    expect(renderMessage('{{first_name}}, {{first_name}} aqui é da Skleanings.', 'João'))
      .toBe('João, João aqui é da Skleanings.')
  })

  it('tolerates whitespace inside the placeholder: {{ first_name }}', () => {
    expect(renderMessage('Oi {{ first_name }}', 'Ana')).toBe('Oi Ana')
  })

  it('substitutes "amigo(a)" when firstName is null', () => {
    expect(renderMessage('Oi {{first_name}}', null)).toBe('Oi amigo(a)')
  })

  it('substitutes "amigo(a)" when firstName is undefined', () => {
    expect(renderMessage('Oi {{first_name}}', undefined)).toBe('Oi amigo(a)')
  })

  it('substitutes "amigo(a)" when firstName is empty string', () => {
    expect(renderMessage('Oi {{first_name}}', '')).toBe('Oi amigo(a)')
  })

  it('substitutes "amigo(a)" when firstName is whitespace-only', () => {
    expect(renderMessage('Oi {{first_name}}', '   ')).toBe('Oi amigo(a)')
  })

  it('leaves text without placeholder unchanged', () => {
    expect(renderMessage('Mensagem fixa.', 'Maria')).toBe('Mensagem fixa.')
  })
})
