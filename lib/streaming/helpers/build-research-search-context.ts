import type { UIMessage } from 'ai'

import { getTextFromParts } from '@/lib/utils/message-utils'

const MAX_CONTEXT_CHARACTERS = 6000
const MAX_MESSAGE_CHARACTERS = 2000

export function buildResearchSearchContext(
  messages: UIMessage[]
): string | undefined {
  const context = messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-4)
    .map(message => {
      const text = getTextFromParts(message.parts).slice(
        0,
        MAX_MESSAGE_CHARACTERS
      )
      if (!text) return ''
      return `${message.role === 'user' ? 'User' : 'Assistant'}: ${text}`
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(-MAX_CONTEXT_CHARACTERS)

  return context || undefined
}
