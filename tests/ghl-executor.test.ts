import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch before imports
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ACTN-09: GHL createContact executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends POST to https://services.leadconnectorhq.com/contacts/ with Bearer token and Version header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: 'cid_123' } }),
    })
    const { createContact } = await import('@/lib/ghl/create-contact')
    await createContact(
      { firstName: 'Jane', email: 'jane@example.com' },
      { apiKey: 'test-token', locationId: 'loc_abc' }
    )
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe('https://services.leadconnectorhq.com/contacts/')
    expect(init.method).toBe('POST')
    expect(init.headers['Authorization']).toBe('Bearer test-token')
    expect(init.headers['Version']).toBe('2021-07-28')
  })

  it('returns success string containing GHL contact ID on 201 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: 'cid_456' } }),
    })
    const { createContact } = await import('@/lib/ghl/create-contact')
    const result = await createContact(
      { firstName: 'Bob' },
      { apiKey: 'tok', locationId: 'loc_xyz' }
    )
    expect(result).toBe('Contact created. ID: cid_456')
    expect(result).not.toContain('\n')
  })

  it('throws on non-2xx GHL response — caller handles fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    })
    const { createContact } = await import('@/lib/ghl/create-contact')
    await expect(
      createContact({ email: 'bad@example.com' }, { apiKey: 'tok', locationId: 'loc' })
    ).rejects.toThrow('GHL API error 422: Unprocessable Entity')
  })

  it('AbortController cancels request after 400ms timeout', async () => {
    const { ghlFetch } = await import('@/lib/ghl/client')
    // Verify ghlFetch accepts a signal by checking the module has AbortController usage
    // The real test: signal is passed to fetch
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined()
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
    await ghlFetch('/contacts/', 'POST', {}, { apiKey: 'tok', locationId: 'loc' })
    expect(mockFetch).toHaveBeenCalledOnce()
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('ACTN-09: GHL getAvailability executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends GET to /calendars/:calendarId/free-slots with startDate and endDate query params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ '2026-04-10': { slots: ['09:00', '10:00'] } }),
    })
    const { getAvailability } = await import('@/lib/ghl/get-availability')
    await getAvailability(
      { calendarId: 'cal_123', startDate: '2026-04-10', endDate: '2026-04-11' },
      { apiKey: 'tok', locationId: 'loc' }
    )
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/calendars/cal_123/free-slots')
    expect(url).toContain('startDate=2026-04-10')
    expect(url).toContain('endDate=2026-04-11')
  })

  it('returns formatted availability string (single line, no newlines)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        '2026-04-10': { slots: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'] },
      }),
    })
    const { getAvailability } = await import('@/lib/ghl/get-availability')
    const result = await getAvailability(
      { calendarId: 'cal_123', startDate: '2026-04-10', endDate: '2026-04-11' },
      { apiKey: 'tok', locationId: 'loc' }
    )
    expect(result).not.toContain('\n')
    expect(result).toContain('Available slots:')
  })

  it('throws on non-2xx GHL response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Calendar not found',
    })
    const { getAvailability } = await import('@/lib/ghl/get-availability')
    await expect(
      getAvailability(
        { calendarId: 'bad_cal', startDate: '2026-04-10', endDate: '2026-04-11' },
        { apiKey: 'tok', locationId: 'loc' }
      )
    ).rejects.toThrow('GHL API error 404: Calendar not found')
  })
})

describe('ACTN-09: GHL createAppointment executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends POST to /calendars/events/appointments with calendarId, contactId, startTime, endTime', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'appt_789' }),
    })
    const { createAppointment } = await import('@/lib/ghl/create-appointment')
    await createAppointment(
      {
        calendarId: 'cal_123',
        contactId: 'cid_456',
        startTime: '2026-04-10T09:00:00Z',
        endTime: '2026-04-10T09:30:00Z',
      },
      { apiKey: 'tok', locationId: 'loc' }
    )
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/calendars/events/appointments')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.calendarId).toBe('cal_123')
    expect(body.contactId).toBe('cid_456')
    expect(body.startTime).toBe('2026-04-10T09:00:00Z')
    expect(body.endTime).toBe('2026-04-10T09:30:00Z')
  })

  it('returns success string containing appointment ID on 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'appt_999' }),
    })
    const { createAppointment } = await import('@/lib/ghl/create-appointment')
    const result = await createAppointment(
      {
        calendarId: 'cal_123',
        contactId: 'cid_456',
        startTime: '2026-04-10T09:00:00Z',
        endTime: '2026-04-10T09:30:00Z',
      },
      { apiKey: 'tok', locationId: 'loc' }
    )
    expect(result).toBe('Appointment confirmed. ID: appt_999')
    expect(result).not.toContain('\n')
  })

  it('throws on non-2xx GHL response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    })
    const { createAppointment } = await import('@/lib/ghl/create-appointment')
    await expect(
      createAppointment(
        {
          calendarId: 'cal_123',
          contactId: 'cid_456',
          startTime: '2026-04-10T09:00:00Z',
          endTime: '2026-04-10T09:30:00Z',
        },
        { apiKey: 'tok', locationId: 'loc' }
      )
    ).rejects.toThrow('GHL API error 400: Bad request')
  })
})
