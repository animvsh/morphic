import { describe, expect, test } from 'vitest'

import { buildIdentityResolution } from '@/lib/tools/identity-resolution'

// Regression test for ISSUE-004 found during the 2026-07-27 agent soak.
describe('current-company identity resolution', () => {
  test('does not select an acquired company mentioned beside current work', () => {
    const currentPost = {
      title: "animesh alang's post",
      url: 'https://www.linkedin.com/posts/animesh-alang-232713132_current-1',
      content:
        'beevr is an agent infrastructure layer for businesses. making ai useful, mostly. co-founder of dustico (acq by checkmarx) verifying ai. 1 month ago'
    }

    const resolution = buildIdentityResolution({
      person: 'Animesh Alang',
      candidates: [
        {
          company: 'dustico',
          results: [currentPost]
        },
        {
          company: 'beevr',
          results: [currentPost]
        },
        {
          company: 'capy',
          results: [
            {
              title: "animesh alang's older post",
              url: 'https://www.linkedin.com/posts/animesh-alang-232713132_older-1',
              content: 'founder @ capy. 7 months ago'
            }
          ]
        }
      ]
    })

    expect(resolution?.current_company_candidate).toBe('beevr')
    expect(
      resolution?.candidate_evidence.some(item => item.company === 'dustico')
    ).toBe(false)
  })
})
