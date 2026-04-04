// src/lib/chat/stream.ts
// Shared ReadableStream builder and SSE encoder for the chat API.
// Returns a ReadableStream that emits newline-delimited JSON events per D-02.
//
// IMPORTANT: accumulatedReply is set via the onToken callback so the caller
// (route.ts) can close over it before registering after() — see Pitfall 3 in 03-RESEARCH.md.

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { queryKnowledge } from '@/lib/knowledge/query-knowledge'
import { executeAction } from '@/lib/action-engine/execute-action'
import { getProviderKey } from '@/lib/integrations/get-provider-key'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ChatSessionContext } from '@/lib/chat/session'

type ActionType = Database['public']['Enums']['action_type']

const FALLBACK_RESPONSE = "I don't have information about that in my knowledge base."

const DEGRADATION_MESSAGE =
  'This assistant is not yet configured. Please contact the site owner.'

export interface ToolConfigRow {
  id: string
  tool_name: string
  action_type: ActionType
  config: Record<string, unknown>
  fallback_message: string
  integration_id: string
}

export interface ToolWithCredentials extends ToolConfigRow {
  apiKey: string
  locationId: string
}

export interface CreateChatStreamParams {
  sessionId: string
  orgId: string
  orgName: string
  message: string
  ctx: ChatSessionContext
  supabase: SupabaseClient<Database>
  toolsWithCreds: ToolWithCredentials[]
  /** Accumulate reply text — caller declares `let accumulatedReply = ''` in route scope */
  onReplyChunk: (chunk: string) => void
}

// SSE encoder: produces a TextEncoder that encodes one JSON line + newline
function createEncoder() {
  const enc = new TextEncoder()
  return (obj: object) => enc.encode(JSON.stringify(obj) + '\n')
}

/**
 * Build the Anthropic-format tool definitions from the org's active tool_configs.
 * Per 03-RESEARCH.md open question resolution: hardcode parameter shapes per action_type.
 */
function buildAnthropicTools(tools: ToolWithCredentials[]): Anthropic.Tool[] {
  const TOOL_SCHEMAS: Record<string, { description: string; properties: object; required: string[] }> = {
    create_contact: {
      description: 'Create a new contact in the CRM',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['firstName', 'lastName'],
    },
    get_availability: {
      description: 'Check available appointment slots',
      properties: {
        calendarId: { type: 'string' },
        startDate: { type: 'string', description: 'ISO date string' },
        endDate: { type: 'string', description: 'ISO date string' },
      },
      required: ['calendarId', 'startDate', 'endDate'],
    },
    create_appointment: {
      description: 'Book an appointment',
      properties: {
        calendarId: { type: 'string' },
        contactId: { type: 'string' },
        startTime: { type: 'string', description: 'ISO datetime string' },
        endTime: { type: 'string', description: 'ISO datetime string' },
      },
      required: ['calendarId', 'contactId', 'startTime', 'endTime'],
    },
  }

  return tools
    .filter(t => t.action_type in TOOL_SCHEMAS)
    .map(t => {
      const schema = TOOL_SCHEMAS[t.action_type]!
      return {
        name: t.tool_name,
        description: (t.config.description as string | undefined) ?? schema.description,
        input_schema: {
          type: 'object' as const,
          properties: schema.properties,
          required: schema.required,
        },
      }
    })
}

/**
 * Build the OpenAI-format tool definitions from the org's active tool_configs.
 */
function buildOpenAiTools(tools: ToolWithCredentials[]): OpenAI.ChatCompletionTool[] {
  const TOOL_SCHEMAS: Record<string, { description: string; properties: object; required: string[] }> = {
    create_contact: {
      description: 'Create a new contact in the CRM',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['firstName', 'lastName'],
    },
    get_availability: {
      description: 'Check available appointment slots',
      properties: {
        calendarId: { type: 'string' },
        startDate: { type: 'string', description: 'ISO date string' },
        endDate: { type: 'string', description: 'ISO date string' },
      },
      required: ['calendarId', 'startDate', 'endDate'],
    },
    create_appointment: {
      description: 'Book an appointment',
      properties: {
        calendarId: { type: 'string' },
        contactId: { type: 'string' },
        startTime: { type: 'string', description: 'ISO datetime string' },
        endTime: { type: 'string', description: 'ISO datetime string' },
      },
      required: ['calendarId', 'contactId', 'startTime', 'endTime'],
    },
  }

  return tools
    .filter(t => t.action_type in TOOL_SCHEMAS)
    .map(t => {
      const schema = TOOL_SCHEMAS[t.action_type]!
      return {
        type: 'function' as const,
        function: {
          name: t.tool_name,
          description: (t.config.description as string | undefined) ?? schema.description,
          parameters: {
            type: 'object',
            properties: schema.properties,
            required: schema.required,
          },
        },
      }
    })
}

/**
 * Build a readable stream that calls the LLM and emits SSE events.
 * Pre-retrieves KB context, then streams tokens through a single controller.
 * Handles single tool call round-trip before streaming the final answer.
 */
export function createChatStream(params: CreateChatStreamParams): ReadableStream {
  const {
    sessionId,
    orgId,
    orgName,
    message,
    ctx,
    supabase,
    toolsWithCreds,
    onReplyChunk,
  } = params

  return new ReadableStream({
    async start(controller) {
      const encode = createEncoder()

      // Helper: enqueue a JSON SSE line
      const emit = (obj: object) => controller.enqueue(encode(obj))

      try {
        // Always emit session event first (D-02)
        emit({ event: 'session', sessionId })

        // Step A: Fetch provider keys (D-11)
        const openrouterKey = await getProviderKey('openrouter', orgId, supabase)
        const anthropicKey = await getProviderKey('anthropic', orgId, supabase)

        if (!openrouterKey && !anthropicKey) {
          // D-12: No keys — graceful degradation
          emit({ event: 'token', text: DEGRADATION_MESSAGE })
          onReplyChunk(DEGRADATION_MESSAGE)
          emit({ event: 'done' })
          controller.close()
          return
        }

        // Step B: Pre-retrieval KB injection (CHAT-02, Pattern 4)
        let kbContext = ''
        try {
          const kbResult = await queryKnowledge(message, orgId, supabase)
          if (kbResult !== FALLBACK_RESPONSE) {
            kbContext = `\n\nRelevant knowledge base content:\n${kbResult}`
          }
        } catch {
          // KB failure is non-fatal — continue without context
        }

        const systemPrompt = `You are a helpful assistant for ${orgName}. Answer questions accurately and concisely using the provided context. If you don't know the answer, say so.${kbContext}`

        // Step C: Build message history window (D-14)
        const historyWindow = ctx.messages.slice(-10)

        if (openrouterKey) {
          // OpenRouter path (D-11 first preference)
          await streamOpenRouter({
            apiKey: openrouterKey,
            systemPrompt,
            historyWindow,
            message,
            tools: buildOpenAiTools(toolsWithCreds),
            toolsWithCreds,
            orgId,
            supabase,
            emit,
            onReplyChunk,
          })
        } else {
          // Anthropic fallback path
          await streamAnthropic({
            apiKey: anthropicKey!,
            systemPrompt,
            historyWindow,
            message,
            tools: buildAnthropicTools(toolsWithCreds),
            toolsWithCreds,
            orgId,
            supabase,
            emit,
            onReplyChunk,
          })
        }

        emit({ event: 'done' })
      } catch (err) {
        console.error('[stream] Unhandled error:', err)
        emit({ event: 'token', text: 'An error occurred. Please try again.' })
        onReplyChunk('An error occurred. Please try again.')
        emit({ event: 'done' })
      } finally {
        controller.close()
      }
    },
  })
}

// ---------------------------------------------------------------------------
// OpenRouter streaming path
// ---------------------------------------------------------------------------

interface StreamOpenRouterParams {
  apiKey: string
  systemPrompt: string
  historyWindow: Array<{ role: 'user' | 'assistant'; content: string }>
  message: string
  tools: OpenAI.ChatCompletionTool[]
  toolsWithCreds: ToolWithCredentials[]
  orgId: string
  supabase: SupabaseClient<Database>
  emit: (obj: object) => void
  onReplyChunk: (chunk: string) => void
}

async function streamOpenRouter(p: StreamOpenRouterParams): Promise<void> {
  const client = new OpenAI({
    apiKey: p.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: p.systemPrompt },
    ...p.historyWindow.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: p.message },
  ]

  const streamParams: OpenAI.ChatCompletionCreateParamsStreaming = {
    model: 'anthropic/claude-haiku-4-5',
    max_tokens: 1024,
    stream: true,
    messages: openaiMessages,
    ...(p.tools.length > 0 ? { tools: p.tools } : {}),
  }

  const completion = await client.chat.completions.create(streamParams)

  let toolCallName = ''
  let toolCallArguments = ''
  let toolCallId = ''

  for await (const chunk of completion) {
    const choice = chunk.choices[0]
    if (!choice) continue
    const delta = choice.delta

    if (delta?.content) {
      p.emit({ event: 'token', text: delta.content })
      p.onReplyChunk(delta.content)
    }

    if (delta?.tool_calls?.[0]) {
      const tc = delta.tool_calls[0]
      if (tc.id) toolCallId = tc.id
      if (tc.function?.name) toolCallName = tc.function.name
      if (tc.function?.arguments) toolCallArguments += tc.function.arguments
    }

    if (choice.finish_reason === 'tool_calls' && toolCallName) {
      // Emit tool_call event (D-07)
      p.emit({ event: 'tool_call', name: toolCallName })

      let toolResult = ''
      try {
        const toolConfig = p.toolsWithCreds.find(t => t.tool_name === toolCallName)
        if (toolConfig) {
          const toolInput = JSON.parse(toolCallArguments || '{}') as Record<string, unknown>
          toolResult = await executeAction(
            toolConfig.action_type,
            toolInput,
            { apiKey: toolConfig.apiKey, locationId: toolConfig.locationId },
            { organizationId: p.orgId, supabase: p.supabase }
          )
        } else {
          toolResult = 'Tool not found'
        }
      } catch (err) {
        console.error('[stream/openrouter] tool call failed:', err)
        toolResult = 'Tool execution failed'
      }

      // Re-call with tool result to get final answer (single ReadableStream controller stays open)
      const messagesWithTool: OpenAI.ChatCompletionMessageParam[] = [
        ...openaiMessages,
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: toolCallId, type: 'function' as const, function: { name: toolCallName, arguments: toolCallArguments } }],
        },
        { role: 'tool', tool_call_id: toolCallId, content: toolResult },
      ]

      const finalStream = await client.chat.completions.create({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 1024,
        stream: true,
        messages: messagesWithTool,
      })

      for await (const finalChunk of finalStream) {
        const finalContent = finalChunk.choices[0]?.delta?.content
        if (finalContent) {
          p.emit({ event: 'token', text: finalContent })
          p.onReplyChunk(finalContent)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic fallback streaming path
// ---------------------------------------------------------------------------

interface StreamAnthropicParams {
  apiKey: string
  systemPrompt: string
  historyWindow: Array<{ role: 'user' | 'assistant'; content: string }>
  message: string
  tools: Anthropic.Tool[]
  toolsWithCreds: ToolWithCredentials[]
  orgId: string
  supabase: SupabaseClient<Database>
  emit: (obj: object) => void
  onReplyChunk: (chunk: string) => void
}

async function streamAnthropic(p: StreamAnthropicParams): Promise<void> {
  const client = new Anthropic({ apiKey: p.apiKey })

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...p.historyWindow.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: p.message },
  ]

  const streamParams: Anthropic.MessageStreamParams = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    system: p.systemPrompt,
    messages: anthropicMessages,
    ...(p.tools.length > 0 ? { tools: p.tools } : {}),
  }

  const msgStream = client.messages.stream(streamParams)

  let pendingToolName = ''

  for await (const event of msgStream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      pendingToolName = event.content_block.name
      p.emit({ event: 'tool_call', name: pendingToolName })
    }
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      p.emit({ event: 'token', text: event.delta.text })
      p.onReplyChunk(event.delta.text)
    }
  }

  const finalMsg = await msgStream.finalMessage()

  if (finalMsg.stop_reason === 'tool_use') {
    const toolUseBlock = finalMsg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (toolUseBlock) {
      let toolResult = ''
      try {
        const toolConfig = p.toolsWithCreds.find(t => t.tool_name === toolUseBlock.name)
        if (toolConfig) {
          toolResult = await executeAction(
            toolConfig.action_type,
            toolUseBlock.input as Record<string, unknown>,
            { apiKey: toolConfig.apiKey, locationId: toolConfig.locationId },
            { organizationId: p.orgId, supabase: p.supabase }
          )
        } else {
          toolResult = 'Tool not found'
        }
      } catch (err) {
        console.error('[stream/anthropic] tool call failed:', err)
        toolResult = 'Tool execution failed'
      }

      // Re-call with tool result for final answer
      const messagesWithTool: Anthropic.MessageParam[] = [
        ...anthropicMessages,
        { role: 'assistant', content: finalMsg.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: toolResult,
            },
          ],
        },
      ]

      const finalStream = client.messages.stream({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: p.systemPrompt,
        messages: messagesWithTool,
      })

      for await (const event of finalStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          p.emit({ event: 'token', text: event.delta.text })
          p.onReplyChunk(event.delta.text)
        }
      }
    }
  }
}
