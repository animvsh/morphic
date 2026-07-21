import type { LangfuseSpan } from '@langfuse/tracing'
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing'
import type { UIMessage } from 'ai'
import {
  consumeStream,
  convertToModelMessages,
  pruneMessages,
  smoothStream
} from 'ai'

import {
  completeRequestEvent,
  countStepTools,
  failRequestEvent,
  firstTokenTransform,
  mergeToolCounts,
  type ToolCounts
} from '@/lib/admin/usage'
import { researcher } from '@/lib/agents/researcher'
import { removeRawFilesFromModelMessages } from '@/lib/attachments/message-context'
import {
  createPublicErrorResponse,
  serializePublicError
} from '@/lib/errors/public-error'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import {
  getMaxAllowedTokens,
  shouldTruncateMessages,
  truncateMessages
} from '../utils/context-window'
import { isUsageLogging, logUsage } from '../utils/usage-logging'

import { buildResearchSearchContext } from './helpers/build-research-search-context'
import { convertDataPart } from './helpers/convert-data-part'
import { reinforceConversationContext } from './helpers/reinforce-conversation-context'
import { stripReasoningParts } from './helpers/strip-reasoning-parts'
import { stripSpecFromMessages } from './helpers/strip-spec-from-messages'
import { BaseStreamConfig } from './types'

import { langfuseSpanProcessor } from '@/instrumentation'

type EphemeralStreamConfig = Pick<
  BaseStreamConfig,
  'model' | 'abortSignal' | 'searchMode' | 'requestEventId' | 'requestStartedAt'
> & {
  messages: UIMessage[]
  chatId?: string
}

export async function createEphemeralChatStreamResponse(
  config: EphemeralStreamConfig
): Promise<Response> {
  const {
    messages,
    model,
    abortSignal,
    searchMode,
    chatId,
    requestEventId,
    requestStartedAt
  } = config

  if (!messages || messages.length === 0) {
    return new Response('messages are required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  const executeStream = async (rootSpan?: LangfuseSpan): Promise<Response> => {
    // Real OTel trace ID, sent to the client in message metadata so feedback
    // scores can be attached to this trace later
    const parentTraceId = rootSpan?.traceId
    const toolCounts: ToolCounts = {
      toolCalls: 0,
      searchCalls: 0,
      fetchCalls: 0
    }

    const endTracing = async () => {
      if (rootSpan) {
        rootSpan.end()
        await langfuseSpanProcessor.forceFlush()
      }
    }

    try {
      const isOpenAI = `${model.providerId}:${model.id}`.startsWith('openai:')
      const messagesWithoutSpec = stripSpecFromMessages(
        removeRawFilesFromModelMessages(messages)
      )
      const messagesToConvert = isOpenAI
        ? stripReasoningParts(messagesWithoutSpec)
        : messagesWithoutSpec

      let modelMessages = await convertToModelMessages(messagesToConvert, {
        convertDataPart
      })

      modelMessages = pruneMessages({
        messages: modelMessages,
        reasoning: 'before-last-message',
        toolCalls: 'before-last-2-messages',
        emptyMessages: 'remove'
      })
      modelMessages = reinforceConversationContext(modelMessages)

      if (shouldTruncateMessages(modelMessages, model)) {
        const maxTokens = getMaxAllowedTokens(model)
        modelMessages = truncateMessages(modelMessages, maxTokens, model.id)
      }

      const researchAgent = researcher({
        model: `${model.providerId}:${model.id}`,
        modelConfig: model,
        searchMode,
        searchContext: buildResearchSearchContext(messages)
      })

      const modelId = `${model.providerId}:${model.id}`
      const result = await researchAgent.stream({
        // Keep every guest turn in the active prompt so follow-ups can refer
        // to the answer immediately above instead of behaving like a new chat.
        prompt: modelMessages,
        abortSignal,
        experimental_transform: [
          firstTokenTransform(requestEventId, requestStartedAt),
          smoothStream({ chunking: 'word' })
        ],
        onStepFinish: step => {
          mergeToolCounts(toolCounts, countStepTools(step.toolCalls))
          if (isUsageLogging()) {
            logUsage(
              { scope: 'step', modelId },
              step.usage,
              step.providerMetadata
            )
          }
        }
      })
      result.consumeStream()

      if (isUsageLogging()) {
        Promise.resolve(result.totalUsage)
          .then(usage => logUsage({ scope: 'total', modelId }, usage))
          .catch(() => {})
      }

      return result.toUIMessageStreamResponse({
        messageMetadata: ({ part }) => {
          if (part.type === 'start') {
            return {
              traceId: parentTraceId,
              searchMode,
              modelId: `${model.providerId}:${model.id}`
            }
          }
        },
        onFinish: async ({ responseMessage, isAborted }) => {
          try {
            await completeRequestEvent({
              eventId: requestEventId,
              startedAt: requestStartedAt,
              responseMessageId: responseMessage?.id,
              traceId: parentTraceId,
              usage: await Promise.resolve(result.totalUsage),
              tools: toolCounts,
              aborted: isAborted
            })
          } finally {
            await endTracing()
          }
        },
        onError: (error: unknown) => {
          void failRequestEvent({
            eventId: requestEventId,
            startedAt: requestStartedAt,
            traceId: parentTraceId,
            tools: toolCounts,
            error
          })
          console.error('Ephemeral stream response error:', error)
          return serializePublicError(error)
        },
        consumeSseStream: consumeStream
      })
    } catch (error) {
      await failRequestEvent({
        eventId: requestEventId,
        startedAt: requestStartedAt,
        traceId: parentTraceId,
        tools: toolCounts,
        error
      })
      await endTracing()
      console.error('Ephemeral stream execution error:', error)
      return createPublicErrorResponse(error, {
        status: 500,
        statusText: 'Internal Server Error'
      })
    }
  }

  if (!isTracingEnabled()) {
    return executeStream()
  }

  // Wrap execution in a root Langfuse observation so all spans share a
  // single trace
  return propagateAttributes(
    {
      traceName: 'research',
      userId: 'guest',
      ...(chatId && { sessionId: chatId }),
      metadata: {
        ...(chatId && { chatId }),
        userId: 'guest',
        modelId: `${model.providerId}:${model.id}`,
        trigger: 'submit-message'
      }
    },
    () =>
      startActiveObservation('research', span => executeStream(span), {
        endOnExit: false
      })
  )
}
