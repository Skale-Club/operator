import { describe, it, expect } from 'vitest'

// Helper extracted from account-combobox domain auto-suggest logic
function extractEmailDomain(input: string): string {
  if (!input.includes('@')) return ''
  const domain = input.split('@')[1]?.trim().toLowerCase() ?? ''
  return domain
}

// Helper that mirrors the OR filter construction in getAccountOpportunities
function buildOppOrFilter(
  accountId: string,
  contactIds: string[],
): { useOr: true; filter: string } | { useOr: false } {
  if (contactIds.length === 0) return { useOr: false }
  return {
    useOr: true,
    filter: `account_id.eq.${accountId},contact_id.in.(${contactIds.join(',')})`,
  }
}

describe('accounts-detail: domain extraction', () => {
  it('extracts domain from a standard email', () => {
    expect(extractEmailDomain('alice@acme.com')).toBe('acme.com')
  })
  it('extracts domain from a subdomain email', () => {
    expect(extractEmailDomain('bob@sub.example.co.uk')).toBe('sub.example.co.uk')
  })
  it('returns empty string when no @ present', () => {
    expect(extractEmailDomain('noatsign')).toBe('')
  })
  it('returns empty string for empty input', () => {
    expect(extractEmailDomain('')).toBe('')
  })
  it('returns empty string for bare @ with no domain', () => {
    expect(extractEmailDomain('user@')).toBe('')
  })
  it('returns empty string for just @', () => {
    expect(extractEmailDomain('@')).toBe('')
  })
})

describe('accounts-detail: opportunity OR filter', () => {
  it('builds OR filter with contacts present', () => {
    const result = buildOppOrFilter('acc1', ['c1', 'c2'])
    expect(result).toEqual({ useOr: true, filter: 'account_id.eq.acc1,contact_id.in.(c1,c2)' })
  })
  it('returns direct-eq flag when no contacts', () => {
    const result = buildOppOrFilter('acc1', [])
    expect(result).toEqual({ useOr: false })
  })
})
