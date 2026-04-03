import { describe, it } from 'vitest'

describe('AUTH routing', () => {
  it.todo('unauthenticated request to /calls redirects to /login via dashboard layout')
  it.todo('authenticated request to /login redirects to /organizations via auth layout')
  it.todo('request to /api/vapi/tools does not depend on auth middleware to return 200')
})
