import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MiniMaxSearchProvider, rankCurrentIdentityResults } from '../minimax'

describe('MiniMaxSearchProvider', () => {
  const originalMiniMaxKey = process.env.MINIMAX_API_KEY
  const originalCompatibleKey = process.env.OPENAI_COMPATIBLE_API_KEY

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalMiniMaxKey === undefined) delete process.env.MINIMAX_API_KEY
    else process.env.MINIMAX_API_KEY = originalMiniMaxKey
    if (originalCompatibleKey === undefined)
      delete process.env.OPENAI_COMPATIBLE_API_KEY
    else process.env.OPENAI_COMPATIBLE_API_KEY = originalCompatibleKey
  })

  it('maps the official Web MCP response into Morphic search results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          organic: [
            {
              title: 'animesh alang - cs + business @ ucsc',
              link: 'https://www.linkedin.com/in/animesh-alang',
              snippet: 'Experience: Slug AI · Education: UC Santa Cruz',
              date: ''
            }
          ]
        }),
        { status: 200 }
      )
    )

    const result = await new MiniMaxSearchProvider().search(
      '"Animesh Alang"',
      10,
      'basic',
      [],
      []
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/coding_plan/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ q: '"Animesh Alang"' })
      })
    )
    expect(result).toMatchObject({
      query: '"Animesh Alang"',
      number_of_results: 1,
      images: [],
      results: [
        {
          title: 'animesh alang - cs + business @ ucsc',
          url: 'https://www.linkedin.com/in/animesh-alang',
          content: 'Experience: Slug AI · Education: UC Santa Cruz'
        }
      ]
    })
  })

  it('enforces Morphic domain filters locally', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          organic: [
            {
              title: 'Allowed',
              link: 'https://docs.example.com/person',
              snippet: 'Exact source'
            },
            {
              title: 'Excluded',
              link: 'https://social.example.net/person',
              snippet: 'Weak source'
            }
          ]
        }),
        { status: 200 }
      )
    )

    const result = await new MiniMaxSearchProvider().search(
      'person',
      10,
      'basic',
      ['example.com'],
      []
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.title).toBe('Allowed')
  })

  it('promotes recent first-party identity posts for current-company queries', () => {
    const ranked = rankCurrentIdentityResults(
      [
        {
          title: 'Older third-party launch recap',
          link: 'https://www.linkedin.com/posts/someone-else_launch-123',
          snippet:
            'Alongside Animesh Alang, we built Beevr as agent infrastructure.',
          date: '2 months ago'
        },
        {
          title: "animesh alang's Post",
          link: 'https://www.linkedin.com/posts/animesh-alang-232713132_beevr-456',
          snippet: "Beevr is your company's AI brain and answers with sources.",
          date: '1 week ago'
        },
        {
          title: "animesh alang's old Post",
          link: 'https://www.linkedin.com/posts/animesh-alang-232713132_slugai-789',
          snippet: 'Founder at Capy',
          date: '1 year ago'
        }
      ],
      '"Animesh Alang" Beevr current 2026 founder company latest'
    )

    expect(ranked[0]?.snippet).toContain("company's AI brain")
    expect(ranked[2]?.snippet).toBe('Founder at Capy')
  })

  it('preserves provider ranking for ordinary searches', () => {
    const items = [
      { title: 'First', link: 'https://example.com/1' },
      { title: 'Second', link: 'https://example.com/2', date: '1 day ago' }
    ]

    expect(rankCurrentIdentityResults(items, 'best laptops')).toEqual(items)
  })
})
