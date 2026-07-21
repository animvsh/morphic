import { describe, expect, it } from 'vitest'

import { describesCurrentBeevrProduct } from './agent-harness-semantics'

describe('describesCurrentBeevrProduct', () => {
  it.each([
    'beevr is an AI brain for companies that connects tools and enables agents to reason',
    'beevr is an AI platform that connects to company tools to build a shared memory layer enabling agents to reason and act',
    'beevr is an agent infrastructure layer that gives AI agents memory and context',
    "beevr is a company's AI brain that connects its docs, chats, and CRM",
    'beevr is an agent infrastructure layer with shared memory and tool connectivity',
    'beevr is an AI knowledge platform for businesses'
  ])('accepts a grounded current-product description: %s', description => {
    expect(describesCurrentBeevrProduct(description)).toBe(true)
  })

  it.each([
    'capy is an unbiased news product that shows the same story from every side',
    'beevr is an affordable AI web search engine',
    'beevr makes honey for local grocery stores'
  ])('rejects an unrelated or stale product description: %s', description => {
    expect(describesCurrentBeevrProduct(description)).toBe(false)
  })
})
