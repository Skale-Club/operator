// src/lib/knowledge/query-knowledge.ts
// Hot path: embed query → tenant-scoped similarity search → synthesize answer
// Keys fetched from DB integrations table (not env vars) — supports OpenRouter + Anthropic.
// Budget: ~50ms embed + ~50ms RPC + ~200ms synthesis = ~300ms (within 500ms Vapi limit)

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { embed } from '@/lib/knowledge/embed'
import { getProviderKey } from '@/lib/integrations/get-provider-key'

const FALLBACK_RESPONSE = "I don't have information about that in my knowledge base."

export async function queryKnowledge(
  query: string,
  organizationId: string,
  supabase: SupabaseClient<Database>
): Promise<string> {
  try {
    if (!query.trim()) return FALLBACK_RESPONSE

    // Step 1: Fetch OpenAI key for embedding (~0ms — DB read)
    const openaiKey = await getProviderKey('openai', organizationId, supabase)
    if (!openaiKey) return FALLBACK_RESPONSE

    // Step 2: Embed the query (~50ms)
    const queryEmbedding = await embed(query.trim(), openaiKey)

    // Step 3: Tenant-scoped similarity search via RPC (~50ms)
    const { data: chunks, error: rpcError } = await supabase.rpc('match_document_chunks', {
      p_organization_id: organizationId,
      query_embedding: queryEmbedding,
      match_count: 5,
      match_threshold: 0.7,
    })

    if (rpcError) {
      console.error('[queryKnowledge] RPC error:', rpcError.message)
      return FALLBACK_RESPONSE
    }

    if (!chunks || chunks.length === 0) {
      return FALLBACK_RESPONSE
    }

    // Step 4: Synthesize answer — prefer OpenRouter, fall back to Anthropic (~200ms)
    const context = chunks
      .map((c: { content: string }) => c.content)
      .join('\n\n---\n\n')

    const synthesisPrompt = `Answer the following question using ONLY the provided context. Be concise — 2-3 sentences maximum. If the context does not contain the answer, say you don't have that information.\n\nContext:\n${context}\n\nQuestion: ${query}`

    // Try OpenRouter first
    const openrouterKey = await getProviderKey('openrouter', organizationId, supabase)
    if (openrouterKey) {
      const openrouterClient = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      const completion = await openrouterClient.chat.completions.create({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 256,
        messages: [{ role: 'user', content: synthesisPrompt }],
      })
      return completion.choices[0]?.message?.content ?? FALLBACK_RESPONSE
    }

    // Fall back to Anthropic direct
    const anthropicKey = await getProviderKey('anthropic', organizationId, supabase)
    if (!anthropicKey) return FALLBACK_RESPONSE

    const anthropicClient = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropicClient.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: synthesisPrompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    return textBlock?.text ?? FALLBACK_RESPONSE

  } catch (err) {
    // Never let knowledge query crash the Vapi webhook response
    console.error('[queryKnowledge] Error:', err)
    return FALLBACK_RESPONSE
  }
}
