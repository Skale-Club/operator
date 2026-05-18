// tests/accounts-list-ui.test.ts
// Phase 66 Plan 05 — pure-function unit tests for accounts-list UI logic.
//
// No DB, no Supabase, no Next.js runtime. Tests pure helper functions
// that are inlined into client components (accounts-table.tsx,
// accounts-filters.tsx) and action result extraction patterns.

import { describe, it, expect } from 'vitest'

// ─── relativeTime (replicated from accounts-table.tsx) ─────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── sourceLabel (replicated from accounts-filters.tsx) ────────────────────

function sourceLabel(s: string): string {
  switch (s) {
    case 'manual': return 'Manual'
    case 'auto_from_contact_company': return 'Auto-imported'
    case 'csv_import': return 'CSV import'
    case 'ghl_sync': return 'GHL sync'
    default: return s
  }
}

// ─── combobox search fallback ───────────────────────────────────────────────

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function extractAccountRows<T extends { rows: unknown[] }>(result: ActionResult<T>): unknown[] {
  if (!result.ok) return []
  return result.data.rows
}

// ─── bulk-delete guard ──────────────────────────────────────────────────────

function shouldBlockDelete(ids: string[]): boolean {
  return ids.length === 0
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('accounts-list-ui logic', () => {
  describe('relativeTime', () => {
    it('returns "just now" for recent timestamps', () => {
      const iso = new Date(Date.now() - 20_000).toISOString() // 20 seconds ago (rounds to 0m)
      expect(relativeTime(iso)).toBe('just now')
    })

    it('returns Nm ago for minutes-old timestamps', () => {
      const iso = new Date(Date.now() - 5 * 60_000).toISOString() // 5 minutes ago
      expect(relativeTime(iso)).toMatch(/m ago$/)
    })
  })

  describe('sourceLabel', () => {
    it('maps auto_from_contact_company to Auto-imported', () => {
      expect(sourceLabel('auto_from_contact_company')).toBe('Auto-imported')
    })

    it('passes through unknown sources unchanged', () => {
      expect(sourceLabel('unknown_source')).toBe('unknown_source')
    })
  })

  describe('extractAccountRows (combobox search fallback)', () => {
    it('returns empty array when result is not ok', () => {
      const result: ActionResult<{ rows: string[] }> = { ok: false, error: 'Not authenticated' }
      expect(extractAccountRows(result)).toEqual([])
    })

    it('returns rows when result is ok', () => {
      const result: ActionResult<{ rows: string[] }> = { ok: true, data: { rows: ['a', 'b'] } }
      expect(extractAccountRows(result)).toEqual(['a', 'b'])
    })
  })

  describe('shouldBlockDelete (bulk-delete guard)', () => {
    it('blocks when ids array is empty', () => {
      expect(shouldBlockDelete([])).toBe(true)
    })

    it('does not block when ids are provided', () => {
      expect(shouldBlockDelete(['uuid-1'])).toBe(false)
    })
  })
})
