import { describe, expect, it } from 'vitest'

import { reinforceConversationContext } from '../reinforce-conversation-context'

describe('reinforceConversationContext', () => {
  it('attaches recent chat turns to the current follow-up', () => {
    const result = reinforceConversationContext([
      { role: 'user', content: 'who is animesh alang?' },
      {
        role: 'assistant',
        content: 'Animesh Alang is a UC Santa Cruz student.'
      },
      {
        role: 'user',
        content: 'what university did you just mention?'
      }
    ])

    const last = result.at(-1)
    expect(JSON.stringify(last?.content)).toContain('UC Santa Cruz')
    expect(JSON.stringify(last?.content)).toContain(
      'what university did you just mention?'
    )
  })

  it('leaves a first turn unchanged', () => {
    const messages = [{ role: 'user' as const, content: 'hello' }]
    expect(reinforceConversationContext(messages)).toEqual(messages)
  })
})
