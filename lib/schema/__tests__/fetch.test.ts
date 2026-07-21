import { describe, expect, it } from 'vitest'

import { fetchSchema } from '../fetch'

describe('fetchSchema', () => {
  it('accepts the native fetch modes', () => {
    expect(fetchSchema.parse({ url: 'https://example.com' }).type).toBe(
      'regular'
    )
    expect(
      fetchSchema.parse({ url: 'https://example.com/file.pdf', type: 'api' })
        .type
    ).toBe('api')
  })

  it('recovers when a model carries a search mode into the fetch tool', () => {
    expect(
      fetchSchema.parse({ url: 'https://example.com', type: 'optimized' }).type
    ).toBe('regular')
  })
})
