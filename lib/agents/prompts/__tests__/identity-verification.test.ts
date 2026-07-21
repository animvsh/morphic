import { describe, expect, it } from 'vitest'

import {
  getAdaptiveModePrompt,
  getIdentityVerificationGuidance,
  getQuickModePrompt
} from '../search-mode-prompts'

describe('identity verification guardrail', () => {
  it('requires exact-name evidence and forbids merging people', () => {
    const guidance = getIdentityVerificationGuidance()

    expect(guidance).toContain('full name in quotation marks')
    expect(guidance).toContain('Never combine jobs')
    expect(guidance).toContain('Search-result proximity is not evidence')
    expect(guidance).toContain('Keep the answer scoped')
    expect(guidance).toContain('incidental search results')
    expect(guidance).toContain('Do not repeat old product descriptions')
    expect(guidance).toContain('exact-name match alone is not enough')
    expect(guidance).toContain('not independent proof of employment')
    expect(guidance).toContain('count as one source')
    expect(guidance).toContain('second entity-resolution task')
    expect(guidance).toContain('descriptions are time-sensitive')
    expect(guidance).toContain('current company itself is uncertain')
    expect(guidance).toContain('preserve the concrete verified product')
    expect(guidance).toContain('business intelligence')
    expect(guidance).toContain('Never search a short or generic company')
    expect(guidance).toContain('Do not infer an official domain')
    expect(guidance).toContain('newer evidence conflicts with an older')
    expect(guidance).toContain('Resolve relative dates')
    expect(guidance).toContain('Historical product claims require')
    expect(guidance).toContain('identity_resolution')
    expect(guidance).toContain("user's wording as a claim to verify")
    expect(guidance).toContain('correct the premise plainly')
    expect(guidance).toContain('similarly named company')
    expect(guidance).toContain('Do not invent or expand a middle name')
    expect(guidance).toContain('Remove any claim that fails this check')
  })

  it('is active in both original Morphic research modes', () => {
    for (const prompt of [getQuickModePrompt(), getAdaptiveModePrompt()]) {
      expect(prompt).toContain('IDENTITY VERIFICATION (NON-NEGOTIABLE)')
      expect(prompt).toContain('entity-resolution task')
    }
  })
})
