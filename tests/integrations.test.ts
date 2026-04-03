import { describe, it } from 'vitest'

describe('ACTN-03: Integration credential storage', () => {
  it.todo('createIntegration server action stores encrypted_api_key as iv:ciphertext — not plaintext')
  it.todo('getIntegrations server action returns integrations without encrypted_api_key field')
  it.todo('getIntegrations server action returns masked_api_key (last 4 chars) for display')
})

describe('ACTN-05: Test connection', () => {
  it.todo('testConnection server action calls GHL GET /contacts/ with decrypted credentials')
  it.todo('testConnection returns { success: true } on 200 response from GHL')
  it.todo('testConnection returns { success: false, error: string } on GHL error')
})

describe('ACTN-06 + ACTN-07: Tool configuration', () => {
  it.todo('createToolConfig server action writes tool_name, action_type, integration_id, fallback_message')
  it.todo('createToolConfig enforces unique (organization_id, tool_name) constraint — duplicate returns error')
  it.todo('updateToolConfig can change action_type and integration_id')
})

describe('ACTN-08: Fallback message per tool', () => {
  it.todo('tool_configs.fallback_message is required — createToolConfig rejects empty fallback_message')
  it.todo('fallback_message is returned verbatim to Vapi when the tool execution fails')
})
