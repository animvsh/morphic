import { describe, expect, it } from 'vitest'

import {
  buildChatRequestBody,
  resolveGuestRequestMessages
} from '@/lib/chat/request-contract'
import type { UIMessage } from '@/lib/types/ai'

const userMessage: UIMessage = {
  id: 'user-1',
  role: 'user',
  parts: [{ type: 'text', text: 'hello' }]
}

const assistantMessage: UIMessage = {
  id: 'assistant-1',
  role: 'assistant',
  parts: [{ type: 'text', text: 'hi' }]
}

describe('chat request contract', () => {
  it('always includes conversation history when the page believes the user is signed in', () => {
    const messages = [assistantMessage, userMessage]

    const body = buildChatRequestBody({
      messages,
      trigger: 'submit-message',
      chatId: 'chat-1',
      analyticsId: 'analytics-1',
      savedMessageCount: 2
    })

    expect(body.messages).toBe(messages)
    expect(body.message).toBe(userMessage)
  })

  it('falls back to the submitted message for an older cached client after its session expires', () => {
    expect(resolveGuestRequestMessages(undefined, userMessage)).toEqual([
      userMessage
    ])
  })

  it('prefers complete history when it is available', () => {
    const messages = [userMessage, assistantMessage]

    expect(resolveGuestRequestMessages(messages, userMessage)).toBe(messages)
  })
})
