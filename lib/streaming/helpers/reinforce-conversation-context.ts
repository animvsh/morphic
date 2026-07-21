import type { ModelMessage } from 'ai'

const MAX_CONTEXT_CHARACTERS = 6000
const MAX_MESSAGE_CHARACTERS = 2000

/**
 * Keeps recent conversational context attached to the current user turn.
 *
 * Some OpenAI-compatible tool-loop providers collapse a multi-message prompt
 * to the latest user turn. Morphic still sends the full history; this compact
 * reinforcement keeps pronoun and "what did you just say" follow-ups reliable.
 */
export function reinforceConversationContext(
  messages: ModelMessage[]
): ModelMessage[] {
  if (messages.length < 2) return messages

  const last = messages.at(-1)
  if (!last || last.role !== 'user') return messages

  const recent = messages
    .slice(0, -1)
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-4)
    .map(message => {
      const text = getMessageText(message).slice(0, MAX_MESSAGE_CHARACTERS)
      if (!text) return ''
      const label = message.role === 'user' ? 'User' : 'Assistant'
      return `${label}: ${text}`
    })
    .filter(Boolean)

  if (recent.length === 0) return messages

  const context = recent.join('\n\n').slice(-MAX_CONTEXT_CHARACTERS)
  const reinforcedText = [
    'Recent conversation context from this same chat:',
    context,
    '',
    'Current user message:',
    getMessageText(last)
  ].join('\n')

  return [
    ...messages.slice(0, -1),
    { ...last, content: [{ type: 'text', text: reinforcedText }] }
  ]
}

function getMessageText(message: ModelMessage): string {
  if (typeof message.content === 'string') return message.content.trim()
  if (!Array.isArray(message.content)) return ''

  return message.content
    .flatMap(part =>
      part && typeof part === 'object' && part.type === 'text'
        ? [String(part.text ?? '')]
        : []
    )
    .join('\n')
    .trim()
}
