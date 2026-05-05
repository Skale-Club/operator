import { describe, it } from 'vitest'

describe('METAEV-02: Instagram DM conversation creation', () => {
  it.todo('creates a new conversation with channel="instagram" and channel_metadata={igsid, page_id}')
  it.todo('appends message to existing conversation when igsid+page_id already exists')
  it.todo('inserts a conversation_messages row with role="user" and the message text')
  it.todo('updates last_inbound_at on the conversation for every inbound message')
})

describe('METAEV-02: Messenger conversation creation', () => {
  it.todo('creates a new conversation with channel="messenger" and channel_metadata={sender_id, page_id}')
  it.todo('appends message to existing conversation when sender_id+page_id already exists')
  it.todo('sets widget_token to empty string for Meta conversations')
})

describe('METAEV-02: echo filtering', () => {
  it.todo('skips events where message.is_echo is true')
  it.todo('skips events where message.text is absent')
})
