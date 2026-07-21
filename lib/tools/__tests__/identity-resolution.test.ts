import { describe, expect, it } from 'vitest'

import {
  buildIdentityResolution,
  constrainIdentityAttributionResults,
  enrichIdentityAttributionResults,
  extractAchievementPersonAnchor,
  shouldExpandIdentityCompanySearch
} from '@/lib/tools/identity-resolution'

describe('identity resolution summary', () => {
  it('selects the newest exact-author company evidence', () => {
    const resolution = buildIdentityResolution({
      person: 'Animesh Alang',
      candidates: [
        {
          company: 'capy',
          results: [
            {
              title: "animesh alang's Post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_capy-1',
              content: 'founder @ capy\n6 months ago'
            }
          ]
        },
        {
          company: 'beevr',
          results: [
            {
              title: "animesh alang's Post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_beevr-2',
              content: "beevr is your company's AI brain\n1 month ago"
            }
          ]
        }
      ]
    })

    expect(resolution?.current_company_candidate).toBe('beevr')
    expect(resolution?.candidate_evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ company: 'capy', age_days: 180 }),
        expect.objectContaining({ company: 'beevr', age_days: 30 })
      ])
    )
    expect(
      resolution?.candidate_evidence.find(item => item.company === 'capy')
        ?.excerpt
    ).toContain('intentionally omitted')
  })

  it('does not claim a resolution without two dated exact-author candidates', () => {
    expect(
      buildIdentityResolution({
        person: 'Ada Lovelace',
        candidates: [
          {
            company: 'example',
            results: [
              {
                title: 'Third party',
                url: 'https://example.com/profile',
                content: 'No exact-author evidence'
              }
            ]
          }
        ]
      })
    ).toBeUndefined()
  })

  it('ignores exact-author results that only ranked for a company query', () => {
    const resolution = buildIdentityResolution({
      person: 'Animesh Alang',
      candidates: [
        {
          company: 'capy',
          results: [
            {
              title: "animesh alang's unrelated Post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_hackathon-1',
              content: 'I built a hackathon project.\n1 month ago'
            },
            {
              title: "animesh alang's Capy Post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_capy-2',
              content: 'Building Capy.\n6 months ago'
            }
          ]
        },
        {
          company: 'beevr',
          results: [
            {
              title: "animesh alang's Beevr Post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_beevr-3',
              content: "Beevr is your company's brain.\n1 month ago"
            }
          ]
        }
      ]
    })

    expect(resolution?.current_company_candidate).toBe('beevr')
  })
})

describe('identity attribution evidence', () => {
  it('keeps only the winner section containing the exact person', () => {
    const [result] = constrainIdentityAttributionResults(
      [
        {
          title: 'Students create agentic AI at UC Santa Cruz hackathon',
          url: 'https://news.ucsc.edu/hack-a-claw',
          content:
            'Cloud Track winner: ClawForge, a tool for small businesses. Animesh Alang, Adithya Pradeep, Paras Gandhi, and Giwin Vincent Edwin Omesh. Edge Track winner: FactoryMind, a tool for autonomous robots. Dan Pham, Rohan S., Donovan Thomas, and Raeed Saad.'
        }
      ],
      'Animesh Alang'
    )

    expect(result?.content).toContain('Cloud Track winner: ClawForge')
    expect(result?.content).toContain('Animesh Alang')
    expect(result?.content).not.toContain('Edge Track winner: FactoryMind')
    expect(result?.content).not.toContain('Dan Pham')
  })

  it('drops achievement results that never name the person', () => {
    const results = constrainIdentityAttributionResults(
      [
        {
          title: 'Hack-a-Claw winners',
          url: 'https://facebook.com/example',
          content:
            'Edge Track winner FactoryMind by Dan Pham, Rohan S., Donovan Thomas, and Raeed Saad.'
        }
      ],
      'Animesh Alang'
    )

    expect(results).toEqual([])
  })

  it('expands companies only for explicit company questions', () => {
    expect(
      shouldExpandIdentityCompanySearch(
        'Who is Animesh Alang and what company does he currently run?'
      )
    ).toBe(true)
    expect(
      shouldExpandIdentityCompanySearch(
        'What did Animesh Alang win at his latest hackathon?'
      )
    ).toBe(false)
  })

  it('extracts a lowercase person from an achievement question', () => {
    expect(
      extractAchievementPersonAnchor(
        'what did animesh alang win at the latest hackathon?'
      )
    ).toBe('animesh alang')
  })

  it('enriches an authoritative event page before slicing the winner block', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        '<main>Cloud Track winner: ClawForge. Animesh Alang, Adithya Pradeep, Paras Gandhi, and Giwin Vincent Edwin Omesh. Edge Track winner: FactoryMind. Dan Pham and Rohan S.</main>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      )

    try {
      const [result] = await enrichIdentityAttributionResults(
        [
          {
            title: 'Hack-a-Claw results',
            url: 'https://news.ucsc.edu/hack-a-claw',
            content: 'Hackathon results were announced.'
          }
        ],
        'Animesh Alang'
      )

      expect(result?.content).toContain('Cloud Track winner: ClawForge')
      expect(result?.content).not.toContain('Edge Track winner: FactoryMind')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
