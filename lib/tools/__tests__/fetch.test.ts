import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/usage-logging', () => ({
  logToolPayload: vi.fn()
}))

vi.mock('@/lib/schema/fetch', () => ({
  fetchSchema: {}
}))

import { fetchTool } from '../fetch'

const originalJinaKey = process.env.JINA_API_KEY

describe('fetchTool', () => {
  beforeEach(() => {
    delete process.env.JINA_API_KEY
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalJinaKey === undefined) delete process.env.JINA_API_KEY
    else process.env.JINA_API_KEY = originalJinaKey
  })

  it('keeps the research stream alive when API extraction returns no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    const events = []
    const execute = fetchTool.execute as any
    for await (const event of execute(
      { url: 'https://example.com/document.pdf', type: 'api' },
      { toolCallId: 'fetch-1', messages: [] }
    )) {
      events.push(event)
    }

    expect(events).toEqual([
      { state: 'fetching', url: 'https://example.com/document.pdf' },
      {
        state: 'complete',
        query: 'https://example.com/document.pdf',
        images: [],
        results: [
          {
            title: 'Page unavailable',
            url: 'https://example.com/document.pdf',
            content: expect.stringContaining('Do not use it as evidence')
          }
        ]
      }
    ])
  })
})
