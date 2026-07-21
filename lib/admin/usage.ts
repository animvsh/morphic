import type { LanguageModelUsage } from 'ai'
import { createHash } from 'node:crypto'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'

import 'server-only'

export interface RequestEventInput {
  id: string
  userId?: string
  analyticsId?: string
  chatId?: string
  requestMessageId?: string
  queryText: string
  trigger: 'submit-message' | 'regenerate-message'
  searchMode: 'quick' | 'adaptive'
  providerId: string
  modelId: string
}

export interface ToolCounts {
  toolCalls: number
  searchCalls: number
  fetchCalls: number
}

const EMPTY_TOOL_COUNTS: ToolCounts = {
  toolCalls: 0,
  searchCalls: 0,
  fetchCalls: 0
}

function guestKey(analyticsId: string) {
  const salt =
    process.env.BROK_GUEST_CORRELATION_SALT ??
    process.env.INSFORGE_API_KEY ??
    'brok-local-guest-v1'
  return createHash('sha256').update(`${salt}:${analyticsId}`).digest('hex')
}

function safeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  const message = raw
    .replace(
      /(?:sk|pk|key|token|secret)[-_a-z0-9]*\s*[:=]\s*\S+/gi,
      '[redacted]'
    )
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .slice(0, 500)
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code).slice(0, 80)
      : 'stream_error'
  return { code, message }
}

async function failOpen(label: string, operation: () => Promise<unknown>) {
  try {
    await operation()
  } catch (error) {
    console.error(`Usage ledger ${label} failed:`, error)
  }
}

export async function createRequestEvent(input: RequestEventInput) {
  const startedAt = new Date()
  await failOpen('create', async () => {
    const client = getInsForgeAdminClient()
    const { error } = await client.database.from('brok_request_events').insert([
      {
        id: input.id,
        user_id: input.userId ?? null,
        guest_key:
          input.userId || !input.analyticsId
            ? null
            : guestKey(input.analyticsId),
        chat_id: input.chatId ?? null,
        request_message_id: input.requestMessageId ?? null,
        query_text: input.queryText,
        trigger: input.trigger,
        search_mode: input.searchMode,
        provider_id: input.providerId,
        model_id: input.modelId,
        status: 'started',
        started_at: startedAt.toISOString()
      }
    ])
    if (error) throw error
  })
  return startedAt.getTime()
}

export async function markRequestFirstToken(
  eventId: string | undefined,
  startedAt: number | undefined,
  observedAt = Date.now()
) {
  if (!eventId || !startedAt) return
  await failOpen('first token', async () => {
    const client = getInsForgeAdminClient()
    const now = new Date(observedAt)
    const { error } = await client.database
      .from('brok_request_events')
      .update({
        first_token_at: now.toISOString(),
        first_token_ms: Math.max(0, now.getTime() - startedAt)
      })
      .eq('id', eventId)
      .eq('status', 'started')
      .is('first_token_at', null)
    if (error) throw error
  })
}

export function firstTokenTransform(
  eventId: string | undefined,
  startedAt: number | undefined
) {
  let observed = false
  return () =>
    new TransformStream<any, any>({
      transform(chunk, controller) {
        if (
          !observed &&
          (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') &&
          chunk.text
        ) {
          observed = true
          const observedAt = Date.now()
          void markRequestFirstToken(eventId, startedAt, observedAt)
        }
        controller.enqueue(chunk)
      }
    })
}

export function countStepTools(
  toolCalls: ReadonlyArray<{ toolName?: string }> | undefined
): ToolCounts {
  return (toolCalls ?? []).reduce<ToolCounts>(
    (counts, call) => {
      const name = call.toolName ?? ''
      counts.toolCalls += 1
      if (/search/i.test(name)) counts.searchCalls += 1
      if (/fetch|retrieve|crawl|content/i.test(name)) counts.fetchCalls += 1
      return counts
    },
    { ...EMPTY_TOOL_COUNTS }
  )
}

export function mergeToolCounts(target: ToolCounts, source: ToolCounts) {
  target.toolCalls += source.toolCalls
  target.searchCalls += source.searchCalls
  target.fetchCalls += source.fetchCalls
}

export async function completeRequestEvent(options: {
  eventId?: string
  startedAt?: number
  responseMessageId?: string
  traceId?: string
  usage?: LanguageModelUsage
  tools?: ToolCounts
  aborted?: boolean
}) {
  if (!options.eventId) return
  const usage = options.usage
  const tools = options.tools ?? EMPTY_TOOL_COUNTS
  await failOpen(options.aborted ? 'abort' : 'complete', async () => {
    const client = getInsForgeAdminClient()
    const now = new Date()
    const { error } = await client.database
      .from('brok_request_events')
      .update({
        status: options.aborted ? 'aborted' : 'succeeded',
        response_message_id: options.responseMessageId ?? null,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        reasoning_tokens:
          usage?.outputTokenDetails?.reasoningTokens ??
          usage?.reasoningTokens ??
          null,
        cache_read_tokens:
          usage?.inputTokenDetails?.cacheReadTokens ??
          usage?.cachedInputTokens ??
          null,
        cache_write_tokens: usage?.inputTokenDetails?.cacheWriteTokens ?? null,
        total_tokens: usage?.totalTokens ?? null,
        search_calls: tools.searchCalls,
        fetch_calls: tools.fetchCalls,
        tool_calls: tools.toolCalls,
        completed_at: now.toISOString(),
        duration_ms: options.startedAt
          ? Math.max(0, now.getTime() - options.startedAt)
          : null,
        trace_id: options.traceId ?? null
      })
      .eq('id', options.eventId)
      .eq('status', 'started')
    if (error) throw error
  })
}

export async function failRequestEvent(options: {
  eventId?: string
  startedAt?: number
  error: unknown
  traceId?: string
  tools?: ToolCounts
}) {
  if (!options.eventId) return
  const failure = safeError(options.error)
  const tools = options.tools ?? EMPTY_TOOL_COUNTS
  await failOpen('failure', async () => {
    const client = getInsForgeAdminClient()
    const now = new Date()
    const { error } = await client.database
      .from('brok_request_events')
      .update({
        status: 'failed',
        error_code: failure.code,
        error_message: failure.message,
        search_calls: tools.searchCalls,
        fetch_calls: tools.fetchCalls,
        tool_calls: tools.toolCalls,
        completed_at: now.toISOString(),
        duration_ms: options.startedAt
          ? Math.max(0, now.getTime() - options.startedAt)
          : null,
        trace_id: options.traceId ?? null
      })
      .eq('id', options.eventId)
      .eq('status', 'started')
    if (error) throw error
  })
}
