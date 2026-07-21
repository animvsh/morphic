import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { buildResearchSearchContext } from '../build-research-search-context'

function message(role: UIMessage['role'], text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }]
  }
}

describe('buildResearchSearchContext', () => {
  it('keeps the resolved person and product in a pronoun follow-up', () => {
    const context = buildResearchSearchContext([
      message('user', 'what company does Animesh Alang currently run?'),
      message(
        'assistant',
        'He runs beevr, a company brain that connects business tools for agents.'
      ),
      message('user', 'what does it do?')
    ])

    expect(context).toContain('Animesh Alang')
    expect(context).toContain('beevr')
    expect(context).toContain('what does it do?')
  })

  it('returns undefined when no message has text', () => {
    expect(buildResearchSearchContext([])).toBeUndefined()
  })
})
