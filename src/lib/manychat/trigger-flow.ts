// src/lib/manychat/trigger-flow.ts
// Endpoint: POST https://api.manychat.com/fb/sending/sendFlow
//   NOTE: lives under /fb/sending/, NOT /fb/subscriber/
// Body:     { subscriber_id, flow_ns }
//   flow_ns is the NAMESPACE STRING (e.g. "content20250616151905_320176"),
//   NOT the numeric flow id. Operators copy it from the ManyChat dashboard.
//   See RESEARCH.md Pitfall 4.

import { manychatFetchJson, type ManychatCredentials } from './client'
import { resolveSubscriberId } from './subscriber-id'

interface TriggerFlowParams {
  subscriber_id?: string | number
  flow_ns?: string
  [key: string]: unknown
}

export async function triggerManychatFlow(
  params: Record<string, unknown>,
  credentials: ManychatCredentials,
): Promise<string> {
  const subscriberId = resolveSubscriberId(params)
  const { flow_ns: flowNs } = params as TriggerFlowParams
  if (!flowNs) throw new Error('flow_ns is required for manychat_trigger_flow')

  await manychatFetchJson(
    '/fb/sending/sendFlow',
    'POST',
    { subscriber_id: subscriberId, flow_ns: flowNs },
    credentials,
  )

  return `Flow ${flowNs} triggered for subscriber ${subscriberId}.`
}
