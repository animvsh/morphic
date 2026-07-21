import type { UIMessage } from '@/lib/types/ai'

type BuildChatRequestBodyOptions = {
  messages: UIMessage[]
  trigger: string
  messageId?: string
  chatId: string
  analyticsId?: string
  savedMessageCount: number
}

export function buildChatRequestBody({
  messages,
  trigger,
  messageId,
  chatId,
  analyticsId,
  savedMessageCount
}: BuildChatRequestBodyOptions) {
  const lastMessage = messages[messages.length - 1]
  const messageToRegenerate =
    trigger === 'regenerate-message'
      ? messages.find(message => message.id === messageId)
      : undefined

  return {
    trigger,
    chatId,
    messageId,
    analyticsId,
    // Always send the conversation. The server re-checks authentication on
    // every request, so a page whose session expired must still be able to
    // continue through the guest stream without changing request shape.
    messages,
    message:
      trigger === 'regenerate-message' && messageToRegenerate?.role === 'user'
        ? messageToRegenerate
        : trigger === 'submit-message'
          ? lastMessage
          : undefined,
    isNewChat:
      trigger === 'submit-message' &&
      messages.length === 1 &&
      savedMessageCount === 0
  }
}

export function resolveGuestRequestMessages<T>(
  messages: T[] | undefined,
  message: T | undefined
): T[] {
  if (Array.isArray(messages) && messages.length > 0) return messages
  return message ? [message] : []
}
