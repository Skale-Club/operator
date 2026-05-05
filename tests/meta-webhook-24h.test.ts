import { describe, it } from 'vitest'

describe('METAEV-05: 24h messaging window enforcement', () => {
  it.todo('fires automation when last_inbound_at is less than 24 hours ago')
  it.todo('blocks automation when last_inbound_at is more than 24 hours ago')
  it.todo('sets window_expired="true" in channel_metadata when 24h window has elapsed')
  it.todo('updates last_inbound_at on every inbound message even when window is expired')
  it.todo('fires automation on first message (no prior last_inbound_at)')
})
