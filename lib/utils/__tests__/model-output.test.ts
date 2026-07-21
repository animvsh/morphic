import { describe, expect, it } from 'vitest'

import { cleanGeneratedTitle, stripThinkBlocks } from '../model-output'

describe('model output cleanup', () => {
  it('removes hidden MiniMax thinking blocks', () => {
    expect(
      stripThinkBlocks('<think>private working notes</think>\n\nFinal answer')
    ).toBe('Final answer')
  })

  it('hides unfinished thinking blocks while streaming', () => {
    expect(stripThinkBlocks('<think>private working notes')).toBe('')
  })

  it('uses one short clean line for chat titles', () => {
    expect(
      cleanGeneratedTitle(
        '<think>draft</think>\n\n## Quiet Monterey or Mendocino\nextra copy'
      )
    ).toBe('Quiet Monterey or Mendocino')
  })

  it('caps generated titles at ten words', () => {
    expect(
      cleanGeneratedTitle(
        'one two three four five six seven eight nine ten eleven twelve'
      )
    ).toBe('one two three four five six seven eight nine ten')
  })

  it('removes markdown decoration from generated titles', () => {
    expect(cleanGeneratedTitle('**Mendocino** is the quieter choice')).toBe(
      'Mendocino is the quieter choice'
    )
  })
})
