import { describe, expect, it } from 'vitest'

import { countStepTools, mergeToolCounts } from '../usage'

describe('request usage normalization', () => {
  it('counts search, fetch, and other tools once per call', () => {
    expect(
      countStepTools([
        { toolName: 'searchWeb' },
        { toolName: 'fetchContent' },
        { toolName: 'askQuestion' }
      ])
    ).toEqual({ toolCalls: 3, searchCalls: 1, fetchCalls: 1 })
  })

  it('aggregates tool totals across agent steps', () => {
    const total = { toolCalls: 0, searchCalls: 0, fetchCalls: 0 }
    mergeToolCounts(total, countStepTools([{ toolName: 'search' }]))
    mergeToolCounts(
      total,
      countStepTools([{ toolName: 'retrieveUrl' }, { toolName: 'todo' }])
    )
    expect(total).toEqual({ toolCalls: 3, searchCalls: 1, fetchCalls: 1 })
  })
})
