import { describe, it } from 'vitest'

describe('METAEV-01: GET hub challenge verification', () => {
  it.todo('returns the hub.challenge value when hub.mode is subscribe and verify token matches')
  it.todo('returns 403 when verify token does not match META_VERIFY_TOKEN')
  it.todo('returns 403 when hub.mode is not subscribe')
})

describe('METAEV-01: POST HMAC-SHA256 signature verification', () => {
  it.todo('returns 200 when x-hub-signature-256 header matches HMAC of raw body')
  it.todo('returns 403 when x-hub-signature-256 header is missing')
  it.todo('returns 403 when x-hub-signature-256 header does not match expected HMAC')
  it.todo('returns 200 even when signature is valid but payload is malformed JSON')
})
