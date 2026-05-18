// tests/customfields-validator.test.ts
// Phase 69 Plan 03 — CUSTOMFIELDS-CORE-LIB unit tests
//
// Covers CF-07 (type/required/unique_per_org validation) and CF-15 (currency
// round-trip) at the unit level. All Supabase calls are mocked — no live DB.
//
// Test axes (six behavioral groups from the locked design §6):
//   1. Unknown key rejection
//   2. Required field enforcement
//   3. Type validation (number, boolean, date, text)
//   4. unique_per_org (mocked DB returns existing row)
//   5. Currency round-trip (CF-15)
//   6. Serializer pure-function behaviour

// ---------------------------------------------------------------------------
// vi.mock calls MUST appear before any import of the modules under test.
// Vitest hoists these to the top of the module graph.
// ---------------------------------------------------------------------------
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------
import { createClient } from '@/lib/supabase/server'
import { validateCustomFields } from '@/lib/custom-fields/validate'
import {
  parseCurrencyValue,
  normalizeCustomFieldValues,
} from '@/lib/custom-fields/serialize'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DefinitionRow {
  id: string
  org_id: string
  entity: 'contact' | 'opportunity' | 'account'
  key: string
  label: string
  type: string
  required: boolean
  unique_per_org: boolean
  archived: boolean
  options: unknown[] | null
  validation: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Default definition — minimal required fields; override as needed. */
function makeDefinition(overrides: Partial<DefinitionRow> = {}): DefinitionRow {
  return {
    id: 'def-1',
    org_id: 'org-1',
    entity: 'contact',
    key: 'score',
    label: 'Score',
    type: 'number',
    required: false,
    unique_per_org: false,
    archived: false,
    options: null,
    validation: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildMockSupabase — creates a chainable Supabase mock
//
// validate.ts does:
//   const supabase = await createClient()          ← awaits the client
//   const { data } = await supabase.from(...) ...  ← awaits the query chain
//
// So createClient must resolve to a plain object with a `.from()` method.
// The query chain itself must be awaitable (Promise or thenable).
//
// Chain used by validate.ts:
//   definitions:  .from('custom_field_definitions').select().eq().eq().eq()
//   unique check: .from(entityTable).select('id').filter().limit()
// ---------------------------------------------------------------------------

function buildMockSupabase(
  definitions: DefinitionRow[],
  uniqueCheckResult: { id: string }[] = [],
) {
  /**
   * Build a fluent query chain that resolves to `result` when awaited.
   * Every builder method returns the same chain object.
   */
  function makeChain(result: { data: unknown; error: null }) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      filter: () => chain,
      limit: () => chain,
      // Make the chain thenable so `await chain` works
      then: (
        resolve: (v: { data: unknown; error: null }) => void,
        _reject?: (e: unknown) => void,
      ) => Promise.resolve(result).then(resolve, _reject),
    }
    return chain
  }

  // The supabase client object returned by `await createClient()`
  const client = {
    from: (table: string) => {
      if (table === 'custom_field_definitions') {
        return makeChain({ data: definitions, error: null })
      }
      // entity tables (contacts / opportunities / accounts)
      return makeChain({ data: uniqueCheckResult, error: null })
    },
  }

  return client
}

// ---------------------------------------------------------------------------
// beforeEach — wire the mock before every test
// ---------------------------------------------------------------------------

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function setupMock(
  definitions: DefinitionRow[],
  uniqueCheckResult: { id: string }[] = [],
) {
  const mock = buildMockSupabase(definitions, uniqueCheckResult)
  mockCreateClient.mockResolvedValue(mock)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// Group 1 — Unknown key rejection
// ===========================================================================

describe('validateCustomFields — unknown key rejection', () => {
  it('rejects a single unknown key when definitions list is empty', async () => {
    setupMock([])

    const result = await validateCustomFields('org-1', 'contact', {
      unknown_key: 'x',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({
        field: 'unknown_key',
        message: 'unknown_custom_field',
      })
    }
  })

  it('errors only on the unknown key when mix of known+unknown provided', async () => {
    setupMock([makeDefinition({ key: 'known', type: 'text' })])

    const result = await validateCustomFields('org-1', 'contact', {
      known: 'hi',
      unknown_key: 'x',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const unknownErrors = result.errors.filter(
        (e) => e.message === 'unknown_custom_field',
      )
      expect(unknownErrors).toHaveLength(1)
      expect(unknownErrors[0].field).toBe('unknown_key')
      // The 'known' field must NOT appear in errors
      expect(result.errors.find((e) => e.field === 'known')).toBeUndefined()
    }
  })

  it('returns ok:true when payload is empty and definitions are empty', async () => {
    setupMock([])

    const result = await validateCustomFields('org-1', 'contact', {})
    expect(result.ok).toBe(true)
  })
})

// ===========================================================================
// Group 2 — Required field enforcement
// ===========================================================================

describe('validateCustomFields — required enforcement', () => {
  it('fails when a required field is absent from the payload', async () => {
    setupMock([makeDefinition({ key: 'score', type: 'number', required: true })])

    const result = await validateCustomFields('org-1', 'contact', {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.find((e) => e.field === 'score' && e.message === 'required')).toBeTruthy()
    }
  })

  it('passes when a required field is present', async () => {
    setupMock([makeDefinition({ key: 'score', type: 'number', required: true })])

    const result = await validateCustomFields('org-1', 'contact', { score: 42 })
    expect(result.ok).toBe(true)
  })

  it('passes when an optional field is absent', async () => {
    setupMock([makeDefinition({ key: 'score', type: 'number', required: false })])

    const result = await validateCustomFields('org-1', 'contact', {})
    expect(result.ok).toBe(true)
  })

  it('collects multiple errors in one pass (not fail-fast)', async () => {
    setupMock([
      makeDefinition({ id: 'd1', key: 'score', type: 'number', required: true }),
      makeDefinition({ id: 'd2', key: 'label', type: 'text', required: true }),
    ])

    const result = await validateCustomFields('org-1', 'contact', {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.find((e) => e.field === 'score' && e.message === 'required')).toBeTruthy()
      expect(result.errors.find((e) => e.field === 'label' && e.message === 'required')).toBeTruthy()
    }
  })
})

// ===========================================================================
// Group 3 — Type validation
// ===========================================================================

describe('validateCustomFields — type validation', () => {
  it('rejects a string that is not a number for type=number', async () => {
    setupMock([makeDefinition({ key: 'score', type: 'number' })])

    const result = await validateCustomFields('org-1', 'contact', {
      score: 'not-a-number',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.find((e) => e.field === 'score' && e.message === 'invalid_type')).toBeTruthy()
    }
  })

  it('accepts a proper number value for type=number', async () => {
    setupMock([makeDefinition({ key: 'score', type: 'number' })])

    const result = await validateCustomFields('org-1', 'contact', { score: 99 })
    expect(result.ok).toBe(true)
  })

  it('accepts boolean true for type=boolean', async () => {
    setupMock([makeDefinition({ key: 'active', type: 'boolean' })])

    const result = await validateCustomFields('org-1', 'contact', { active: true })
    expect(result.ok).toBe(true)
  })

  it('rejects a non-boolean string for type=boolean', async () => {
    setupMock([makeDefinition({ key: 'active', type: 'boolean' })])

    const result = await validateCustomFields('org-1', 'contact', {
      active: 'yes-please',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.find((e) => e.field === 'active' && e.message === 'invalid_type')).toBeTruthy()
    }
  })

  it('accepts a valid ISO date string for type=date', async () => {
    setupMock([makeDefinition({ key: 'dob', type: 'date' })])

    const result = await validateCustomFields('org-1', 'contact', {
      dob: '2024-01-15',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects an invalid date string for type=date', async () => {
    setupMock([makeDefinition({ key: 'dob', type: 'date' })])

    const result = await validateCustomFields('org-1', 'contact', {
      dob: 'not-a-date',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.find((e) => e.field === 'dob' && e.message === 'invalid_type')).toBeTruthy()
    }
  })

  it('accepts a plain string for type=text', async () => {
    setupMock([makeDefinition({ key: 'label', type: 'text' })])

    const result = await validateCustomFields('org-1', 'contact', {
      label: 'hello world',
    })
    expect(result.ok).toBe(true)
  })
})

// ===========================================================================
// Group 4 — unique_per_org
// ===========================================================================

describe('validateCustomFields — unique_per_org', () => {
  it('fails when DB returns an existing row for the same value', async () => {
    setupMock(
      [makeDefinition({ key: 'email_alt', type: 'text', unique_per_org: true })],
      [{ id: 'existing-contact-id' }], // simulate duplicate found
    )

    const result = await validateCustomFields('org-1', 'contact', {
      email_alt: 'test@example.com',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.errors.find(
          (e) => e.field === 'email_alt' && e.message === 'unique_per_org',
        ),
      ).toBeTruthy()
    }
  })

  it('passes when DB returns no existing rows for the same value', async () => {
    setupMock(
      [makeDefinition({ key: 'email_alt', type: 'text', unique_per_org: true })],
      [], // no duplicate
    )

    const result = await validateCustomFields('org-1', 'contact', {
      email_alt: 'unique@example.com',
    })
    expect(result.ok).toBe(true)
  })
})

// ===========================================================================
// Group 5 — Currency (CF-15)
// ===========================================================================

describe('validateCustomFields — currency', () => {
  it('passes when a currency field receives { amount, currency } object', async () => {
    setupMock([makeDefinition({ key: 'deal_value', type: 'currency' })])

    const result = await validateCustomFields('org-1', 'contact', {
      deal_value: { amount: 100, currency: 'USD' },
    })
    expect(result.ok).toBe(true)
  })

  it('fails with invalid_currency_value when currency field receives an unparseable string', async () => {
    setupMock([makeDefinition({ key: 'deal_value', type: 'currency' })])

    const result = await validateCustomFields('org-1', 'contact', {
      deal_value: 'invalid-currency',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.errors.find(
          (e) => e.field === 'deal_value' && e.message === 'invalid_currency_value',
        ),
      ).toBeTruthy()
    }
  })
})

// ===========================================================================
// Group 5b — parseCurrencyValue (pure function — no mock needed)
// ===========================================================================

describe('parseCurrencyValue', () => {
  it('parses "1500 BRL" → { amount: 1500, currency: "BRL" }', () => {
    expect(parseCurrencyValue('1500 BRL')).toEqual({ amount: 1500, currency: 'BRL' })
  })

  it('passes through a valid { amount, currency } object unchanged', () => {
    expect(parseCurrencyValue({ amount: 1500, currency: 'BRL' })).toEqual({
      amount: 1500,
      currency: 'BRL',
    })
  })

  it('parses decimal amounts — "99.99 EUR" → { amount: 99.99, currency: "EUR" }', () => {
    expect(parseCurrencyValue('99.99 EUR')).toEqual({ amount: 99.99, currency: 'EUR' })
  })

  it('throws on a plain invalid string', () => {
    expect(() => parseCurrencyValue('invalid')).toThrow('invalid_currency_value')
  })

  it('throws on a numeric input', () => {
    expect(() => parseCurrencyValue(12345)).toThrow('invalid_currency_value')
  })

  it('throws on null', () => {
    expect(() => parseCurrencyValue(null)).toThrow('invalid_currency_value')
  })

  it('throws on an object missing the currency field', () => {
    expect(() => parseCurrencyValue({ amount: 100 })).toThrow('invalid_currency_value')
  })
})

// ===========================================================================
// Group 6 — normalizeCustomFieldValues (pure function — no mock needed)
// ===========================================================================

describe('normalizeCustomFieldValues', () => {
  it('coerces a numeric string to number for type=number', () => {
    const result = normalizeCustomFieldValues(
      { score: '42' },
      [{ key: 'score', type: 'number' }],
    )
    expect(result.score).toBe(42)
    expect(typeof result.score).toBe('number')
  })

  it('produces a new object and does not mutate the input', () => {
    const input = { score: '7' }
    const result = normalizeCustomFieldValues(input, [
      { key: 'score', type: 'number' },
    ])
    expect(result).not.toBe(input) // different reference
    expect(input.score).toBe('7') // original unchanged
  })

  it('passes through unknown keys unchanged', () => {
    const result = normalizeCustomFieldValues(
      { known: 'hi', extra: 'preserve-me' },
      [{ key: 'known', type: 'text' }],
    )
    expect(result.extra).toBe('preserve-me')
  })

  it('splits comma-separated string into array for type=multi_select', () => {
    const result = normalizeCustomFieldValues(
      { tags: 'a,b,c' },
      [{ key: 'tags', type: 'multi_select' }],
    )
    expect(result.tags).toEqual(['a', 'b', 'c'])
  })

  it('normalizes currency string "2000 USD" to { amount:2000, currency:"USD" }', () => {
    const result = normalizeCustomFieldValues(
      { price: '2000 USD' },
      [{ key: 'price', type: 'currency' }],
    )
    expect(result.price).toEqual({ amount: 2000, currency: 'USD' })
  })

  it('coerces boolean string "true" to boolean true', () => {
    const result = normalizeCustomFieldValues(
      { active: 'true' },
      [{ key: 'active', type: 'boolean' }],
    )
    expect(result.active).toBe(true)
  })

  it('coerces boolean string "false" to boolean false', () => {
    const result = normalizeCustomFieldValues(
      { active: 'false' },
      [{ key: 'active', type: 'boolean' }],
    )
    expect(result.active).toBe(false)
  })
})
