import { describe, expect, it } from 'vitest'

import {
  extractIdentityCompanyCandidates,
  extractPersonAnchor,
  groundIdentitySearchQuery
} from '@/lib/tools/search-query-grounding'

describe('identity search query grounding', () => {
  it('extracts the person from an identity question', () => {
    expect(
      extractPersonAnchor(
        'Who is Animesh Alang, and what does his current company Capy do?'
      )
    ).toBe('Animesh Alang')
  })

  it('supports lowercase names in an explicit who-is question', () => {
    expect(extractPersonAnchor('who is animesh alang?')).toBe('animesh alang')
  })

  it('grounds a generic company query with the exact person and recency', () => {
    expect(
      groundIdentitySearchQuery({
        query: 'Capy AI startup',
        searchContext:
          'Who is Animesh Alang, and what does his current company Capy do?',
        currentYear: 2026
      })
    ).toBe(
      'Capy AI startup "Animesh Alang" current 2026 founder company latest'
    )
  })

  it('does not duplicate an existing person or year', () => {
    expect(
      groundIdentitySearchQuery({
        query: '"Animesh Alang" Capy current 2026',
        searchContext:
          'Who is Animesh Alang, and what does his current company Capy do?',
        currentYear: 2026
      })
    ).toBe('"Animesh Alang" Capy current 2026 founder company latest')
  })

  it('quotes an unquoted person anchor for exact-name retrieval', () => {
    expect(
      groundIdentitySearchQuery({
        query: 'Animesh Alang founder company 2026',
        searchContext: 'Who is Animesh Alang and what is his current company?',
        currentYear: 2026
      })
    ).toBe('Animesh Alang founder company 2026 "Animesh Alang" latest')
  })

  it('leaves ordinary non-identity searches untouched', () => {
    expect(
      groundIdentitySearchQuery({
        query: 'best affordable laptops',
        searchContext: 'What are the best affordable laptops?',
        currentYear: 2026
      })
    ).toBe('best affordable laptops')
  })

  it('extracts competing company candidates from identity evidence', () => {
    expect(
      extractIdentityCompanyCandidates([
        'animesh alang · founder @ capy',
        'Alongside Animesh Alang, we built Beevr, an agent infrastructure layer.',
        'Animesh is now building beevr with his team.'
      ])
    ).toEqual(['capy', 'beevr'])
  })
})
