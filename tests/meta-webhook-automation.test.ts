import { describe, it } from 'vitest'

describe('METAEV-03: automation dispatch', () => {
  it.todo('calls executeAction when meta_channels.automation_id is set and no keyword filter')
  it.todo('persists automation response as assistant message in conversation_messages')
  it.todo('does not call executeAction when meta_channels.automation_id is null')
  it.todo('skips processing and logs warning when no active meta_channel row matches page_id+channel_type')
})
