import { beforeAll, describe, expect, it, vi } from 'vitest'

const createOpenAICompatible = vi.hoisted(() =>
  vi.fn(() => ({ languageModel: vi.fn() }))
)

vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible }))

describe('provider registry', () => {
  beforeAll(async () => {
    await import('../registry')
  })

  it('requests usage accounting from OpenAI-compatible streams', () => {
    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({ includeUsage: true })
    )
  })
})
