import { vi } from 'vitest'

// Next.js font functions do not run in vitest's node environment
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter' }),
}))

// Import after mocking
const { metadata } = await import('@/app/layout')

describe('Brand rename — layout metadata', () => {
  it('sets title to Opps', () => {
    expect(metadata.title).toBe('Opps')
  })

  it('sets description to AI Operations Platform', () => {
    expect(metadata.description).toBe('AI Operations Platform')
  })
})
