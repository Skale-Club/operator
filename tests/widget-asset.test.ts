import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const WIDGET_PATH = resolve(process.cwd(), 'public', 'widget.js')

describe('Widget placeholder asset — public/widget.js', () => {
  it('exists at public/widget.js', () => {
    expect(existsSync(WIDGET_PATH)).toBe(true)
  })

  it('contains the Leaidear widget stub comment', () => {
    expect(existsSync(WIDGET_PATH)).toBe(true)
    const content = readFileSync(WIDGET_PATH, 'utf-8')
    expect(content).toContain('// Leaidear widget')
  })
})
